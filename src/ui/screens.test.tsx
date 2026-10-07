import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Home } from './Home';
import { DomainView } from './DomainView';
import { SourceView } from './SourceView';
import { Footer } from './Footer';
import { EntryList } from './EntryList';
import { OeisPanel } from './OeisPanel';
import { ArxivPanel } from './ArxivPanel';
import oeisCore from '../sources/fixtures/oeis-core.json';
import { translate, type Key } from '../i18n/strings';
import { EMPTY_LIBRARY, newPack, withPack } from '../memory/library';
import { sourceById, sourcesOf } from '../domains';
import feed from '../sources/fixtures/arxiv-hist-ph.xml?raw';

// The real 3-second arXiv gap is tested on a fake clock in arxiv.test.ts; here it would only slow the screens down.
vi.mock('../sources/arxiv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sources/arxiv')>()),
  arxivThrottle: <T,>(fn: () => Promise<T>) => fn(),
}));

const READ = { kind: 'read' } as const;
const t = (key: Key, vars?: Record<string, string | number>) => translate('en', key, vars);

describe('Home', () => {
  it('shows the six fields and says in words that nothing is in memory yet', () => {
    render(<Home t={t} lang="en" lib={EMPTY_LIBRARY} libRead={READ} onOpen={vi.fn()} />);
    for (const name of ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Astronomy', 'History of science']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Nothing in memory yet')).toHaveLength(6);
    expect(screen.queryByText(/Philosophy/)).not.toBeInTheDocument();
  });

  it('says what a field holds, from the saved packs', () => {
    const def = sourceById('openstax:astronomy-2e')!;
    const lib = withPack(EMPTY_LIBRARY, { ...newPack(def, 'book', 'Astronomy 2e', 199, new Date()), inVault: 12, updatedAt: '2026-10-04T08:00:00Z' });
    render(<Home t={t} lang="en" lib={lib} libRead={READ} onOpen={vi.fn()} />);
    expect(screen.getByText(/^12 entries in memory/)).toBeInTheDocument();
  });

  it('a library that could not be read is said unreadable, never "nothing"', () => {
    render(<Home t={t} lang="en" lib={EMPTY_LIBRARY} libRead={{ kind: 'unreadable', why: 'TIMEOUT' }} onOpen={vi.fn()} />);
    expect(screen.queryByText('Nothing in memory yet')).not.toBeInTheDocument();
    expect(screen.getAllByText('What is in memory could not be read')).toHaveLength(6);
  });

  it('does not claim "nothing" before the saved state is read', () => {
    render(<Home t={t} lang="en" lib={EMPTY_LIBRARY} libRead={{ kind: 'reading' }} onOpen={vi.fn()} />);
    expect(screen.queryByText('Nothing in memory yet')).not.toBeInTheDocument();
  });
});

describe('DomainView', () => {
  it('lists only wired sources, each with its licence in its own words', () => {
    render(<DomainView t={t} lang="en" domain="history" lib={EMPTY_LIBRARY} libRead={READ} onBack={vi.fn()} onOpen={vi.fn()} />);
    expect(sourcesOf('history').map((s) => s.kind)).toEqual(['wikipedia', 'mactutor', 'arxiv']);
    expect(screen.getByText(/the text of MacTutor by JOC\/EFR is licensed under/)).toBeInTheDocument();
    expect(screen.getByText(/per article, not given by the arXiv API/)).toBeInTheDocument();
    expect(screen.getByText('3,334 biographies')).toBeInTheDocument();
  });
});

describe('SourceView without a working bridge (permission refused)', () => {
  const def = sourceById('arxiv:physics.hist-ph')!;
  const base = {
    t, lang: 'en', def, lib: EMPTY_LIBRARY, libRead: READ, job: null, now: 0, notice: [],
    onBack: vi.fn(), onOpenSite: vi.fn(), onImport: vi.fn(), onImportAll: vi.fn(), onStop: vi.fn(),
  };

  it('says why the list is missing', async () => {
    const host = vi.fn(async () => { throw new Error('PERMISSION_DENIED: vault:read'); });
    render(<SourceView {...base} host={host} />);
    await waitFor(() => expect(screen.getByText('The list could not be read: PERMISSION_DENIED: vault:read')).toBeInTheDocument());
  });

  it('lists the entries but keeps every import button off while a job runs', async () => {
    const host = vi.fn(async () => feed);
    render(<SourceView {...base} job={{ kind: 'one', startedAt: 0, title: 'x' }} host={host} />);
    await waitFor(() => expect(screen.getByText("On Gauge Gravity's 'Hypermomentum Challenge' to the Geometric Trinity")).toBeInTheDocument());
    for (const b of screen.getAllByRole('button', { name: 'Put in memory' })) expect(b).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Put all 3 in memory' })).toBeDisabled();
  });

  it('keeps every import button off while the saved library is not read', async () => {
    const host = vi.fn(async () => feed);
    render(<SourceView {...base} libRead={{ kind: 'unreadable', why: 'X' }} host={host} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Put in memory' }).length).toBe(3));
    for (const b of screen.getAllByRole('button', { name: 'Put in memory' })) expect(b).toBeDisabled();
    expect(screen.getByText(t('lib.blocked'))).toBeInTheDocument();
  });

  it('hands one entry to the import once the library is read', async () => {
    const host = vi.fn(async () => feed);
    const onImport = vi.fn();
    render(<SourceView {...base} onImport={onImport} host={host} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Put in memory' })[0]).toBeEnabled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Put in memory' })[0]!);
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'arxiv:physics.hist-ph' }), expect.objectContaining({ key: '2609.38292v1' }));
    const unit = await onImport.mock.calls[0]![0].read(onImport.mock.calls[0]![1]);
    expect(unit.licence).toMatch(/per article/);
  });
});

describe('Footer', () => {
  it('offers no folder to choose or change, only to open the one the host named', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<Footer t={t} folder={null} onOpenFolder={onOpen} />);
    expect(screen.getByText(t('footer.noFolder'))).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<Footer t={t} folder="D:\\Knowledge\\mnemo-science" onOpenFolder={onOpen} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open the folder' }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('EntryList', () => {
  const def = sourceById('openstax:astronomy-2e')!;
  const entries = [{ key: 'm1', title: 'One' }, { key: 'm2', title: 'Two' }];
  const req = { sourceId: def.id, listKey: 'book', label: 'Astronomy 2e', read: vi.fn() };

  it('offers no "put all" on a list already finished', () => {
    const pack = { ...newPack(def, 'book', 'Astronomy 2e', 2, new Date()), cursor: 2, inVault: 2 };
    render(<EntryList t={t} lang="en" entries={entries} req={req} pack={pack} disabled={false} onImport={vi.fn()} onImportAll={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Put all|Resume/ })).not.toBeInTheDocument();
    expect(screen.getByText(/^Done: 2 in memory/)).toBeInTheDocument();
  });

  it('offers to resume a list started before', () => {
    const pack = { ...newPack(def, 'book', 'Astronomy 2e', 2, new Date()), cursor: 1, inVault: 1 };
    render(<EntryList t={t} lang="en" entries={entries} req={req} pack={pack} disabled={false} onImport={vi.fn()} onImportAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Resume (1 of 2 done)' })).toBeInTheDocument();
  });
});

describe('stable list keys (the resume point must survive "Load more" and a new day)', () => {
  it('OEIS: one key per search', async () => {
    const onImportAll = vi.fn();
    const def = sourceById('oeis')!;
    const host = vi.fn(async () => JSON.stringify(oeisCore));
    render(<OeisPanel t={t} lang="en" def={def} packs={[]} disabled={false} host={host} onImport={vi.fn()} onImportAll={onImportAll} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Put all 2 in memory' }));
    expect(onImportAll.mock.calls[0]![0].listKey).toBe('q=keyword:core');
  });

  it('arXiv: one key per category', async () => {
    const onImportAll = vi.fn();
    const def = sourceById('arxiv:physics.hist-ph')!;
    render(<ArxivPanel t={t} lang="en" def={def} packs={[]} disabled={false} host={vi.fn(async () => feed)} onImport={vi.fn()} onImportAll={onImportAll} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Put all 3 in memory' }));
    expect(onImportAll.mock.calls[0]![0].listKey).toBe('newest');
  });
});
