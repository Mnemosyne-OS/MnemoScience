import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import feed from './sources/fixtures/arxiv-hist-ph.xml?raw';

// A fake bridge: every host call goes through `invoke` (or a method), recorded here.
const calls: { action: string; payload?: unknown }[] = [];
const behaviour = { stateGet: 'fail' as 'fail' | 'ok', pack: 'ok' as 'ok' | 'noRoot' };
const PACK_FOLDER = 'D:\\Knowledge\\mnemo-science';

vi.mock('./sdk/mnemo-sdk', () => ({
  onHostConfig: () => () => undefined,
  MnemoCartridgeSDK: class {
    async invoke(action: string, payload?: unknown) {
      calls.push({ action, payload });
      if (action === 'state.get') {
        if (behaviour.stateGet === 'fail') throw new Error('PERMISSION_DENIED');
        // A library saved before the packs: its folder must never be written to again.
        return { state: { library: { folder: 'C:\\Docs\\MnemoScience', packs: [] } } };
      }
      if (action === 'vault.pack.ensure') {
        if (behaviour.pack === 'noRoot') throw new Error('NO_KNOWLEDGE_ROOT');
        return { vault: 'KP-MNEMO-SCIENCE-HISTORY-OF-SCIENCE', folder: PACK_FOLDER, created: true };
      }
      if (action === 'social.fetch') return { body: feed };
      return { success: true };
    }
    async ensureSandbox() { calls.push({ action: 'ensureSandbox' }); return { vault: 'APP_SCIENCE', unlocked: false }; }
    async describeVaultTile() { calls.push({ action: 'describeVaultTile' }); return { success: true }; }
    async selectFolder() { calls.push({ action: 'dialog.selectFolder' }); return 'C:\\Picked'; }
    async writeFile(path: string) { calls.push({ action: 'writeFile', payload: path }); return { success: true }; }
    async openInOS() { return { success: true }; }
  },
}));

// The useI18n hook imports onHostConfig from the package itself.
vi.mock('@mnemosyne_os/cartridge-sdk', () => ({ onHostConfig: () => () => undefined }));

// The real 3-second arXiv gap is tested on a fake clock in arxiv.test.ts.
vi.mock('./sources/arxiv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sources/arxiv')>()),
  arxivThrottle: <T,>(fn: () => Promise<T>) => fn(),
}));

import App from './App';

beforeEach(() => {
  calls.length = 0;
  behaviour.stateGet = 'fail';
  behaviour.pack = 'ok';
});

/** Opens History of science › arXiv and presses "Put in memory" on the first entry. */
async function importFirstArxivEntry() {
  render(<App />);
  await waitFor(() => expect(screen.getAllByText('Nothing in memory yet')).toHaveLength(6));
  fireEvent.click(screen.getByText('History of science'));
  fireEvent.click(screen.getByText('arXiv physics.hist-ph'));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Put in memory' })[0]).toBeEnabled());
  fireEvent.click(screen.getAllByRole('button', { name: 'Put in memory' })[0]!);
}

describe('App with a bridge whose state.get fails', () => {
  it('writes NOTHING over the unread library, says so, and offers a retry', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be read: PERMISSION_DENIED/));
    expect(screen.getAllByText('What is in memory could not be read')).toHaveLength(6);
    expect(screen.queryByText('Nothing in memory yet')).not.toBeInTheDocument();
    expect(calls.some((c) => c.action === 'state.set')).toBe(false);

    behaviour.stateGet = 'ok';
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getAllByText('Nothing in memory yet')).toHaveLength(6));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('App and the Memory Packs', () => {
  it('boots no sandbox vault', async () => {
    behaviour.stateGet = 'ok';
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Nothing in memory yet')).toHaveLength(6));
    expect(calls.some((c) => c.action === 'ensureSandbox' || c.action === 'describeVaultTile')).toBe(false);
  });

  it('an import never asks for a folder and writes under the folder of vault.pack.ensure', async () => {
    behaviour.stateGet = 'ok';
    await importFirstArxivEntry();
    await waitFor(() => expect(screen.getByText(/is in memory\.$/)).toBeInTheDocument());

    expect(calls.some((c) => c.action === 'dialog.selectFolder')).toBe(false);
    const ensure = calls.find((c) => c.action === 'vault.pack.ensure');
    expect(ensure?.payload).toEqual({ pack: 'history-of-science', lexicalOnly: false });

    const written = calls.filter((c) => c.action === 'writeFile').map((c) => String(c.payload));
    expect(written.length).toBeGreaterThan(0);
    for (const path of written) expect(path.startsWith(PACK_FOLDER)).toBe(true);
    expect(written.some((p) => p.startsWith('C:\\Docs'))).toBe(false);

    const ingests = calls.filter((c) => c.action === 'mnemosyne.ingest');
    expect(ingests.length).toBeGreaterThan(0);
    for (const c of ingests) expect((c.payload as { vault: string }).vault).toBe('KP-MNEMO-SCIENCE-HISTORY-OF-SCIENCE');

    // The footer now names the pack folder, not the folder of the old library.
    expect(screen.getByText(`Copies are kept in ${PACK_FOLDER}`)).toBeInTheDocument();
  });

  it('with no knowledge folder chosen, says to choose it in the Hub and writes nothing', async () => {
    behaviour.stateGet = 'ok';
    behaviour.pack = 'noRoot';
    await importFirstArxivEntry();
    await waitFor(() => expect(screen.getByText('Choose where knowledge goes in the Hub that just opened, then try again.')).toBeInTheDocument());
    expect(calls.some((c) => c.action === 'writeFile' || c.action === 'mnemosyne.ingest' || c.action === 'dialog.selectFolder')).toBe(false);
  });
});
