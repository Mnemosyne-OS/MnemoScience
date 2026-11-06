/**
 * MnemoScience's agent actions (doc 149): the manifest's declaration passes the HOST's own check,
 * every declared action has its handler (a declared action without one would be offered to
 * agents and fail), and the fields it declares are the home screen's own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentActionsFromManifest } from '../../../infinity-edition/src/main/plugins/cartridgeAgentActions';
import { ALL_SOURCES } from '../domains';
import { FIELDS } from './scienceAgent';

const root = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'ui', 'scienceAgent.ts'), 'utf8');
const block = source.slice(source.indexOf('// agent-actions:begin'), source.indexOf('// agent-actions:end'));
const handlers = [...block.matchAll(/^ {4}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

function declared() {
  const r = agentActionsFromManifest(manifest);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("MnemoScience's agent actions", () => {
  it("pass the host's check of the manifest", () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(3);
    expect([...handlers].sort()).toEqual(declared().map((a) => a.id).sort());
  });

  it('nothing spends credits, and nothing imports', () => {
    expect(declared().filter((a) => a.effect === 'spend')).toEqual([]);
    expect(declared().map((a) => a.id).sort()).toEqual(['back', 'open', 'openSite', 'sources', 'status', 'stop']);
  });

  it('declares voice sentences in French, English and Spanish', () => {
    const vc = (manifest as { voiceCommands?: Record<string, string[]> }).voiceCommands;
    for (const lang of ['fr', 'en', 'es']) expect(vc?.[lang]?.length).toBeGreaterThanOrEqual(5);
  });

  it('declares the home screen\'s fields, every one of them holding a source', () => {
    for (const a of declared()) if (a.params.field) expect(a.params.field).toMatchObject({ enum: [...FIELDS] });
    expect([...new Set(ALL_SOURCES.map((s) => s.domain))].sort()).toEqual([...FIELDS].sort());
  });
});
