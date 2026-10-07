/**
 * Shared types of the MnemoScience screens. Types only, so the .tsx files
 * keep exporting components alone (Fast Refresh).
 */
import type { Key } from '../i18n/strings';
import type { DomainId, Entry, Unit } from '../sources/types';

/** The translator handed down from App. */
export type T = (key: Key, vars?: Record<string, string | number>) => string;

export type View =
  | { kind: 'home' }
  | { kind: 'domain'; domain: DomainId }
  | { kind: 'source'; domain: DomainId; sourceId: string };

/** A long step in progress, shown with what it measured so far. */
export type Job =
  | { kind: 'list'; startedAt: number }
  | { kind: 'one'; startedAt: number; title: string }
  | { kind: 'pack'; startedAt: number; label: string; cursor: number; startCursor: number; total: number; inVault: number };

/** The saved library: being read, read, or unreadable (and then nothing may be written over it). */
export type LibRead = { kind: 'reading' } | { kind: 'read' } | { kind: 'unreadable'; why: string };

/** What a source screen hands to App to put entries in memory. */
export interface ImportRequest {
  sourceId: string;
  /** Identifies the list for the resume point (`en|Category:Physics`, `11_Number_theory`…). */
  listKey: string;
  /** Human name of the list. */
  label: string;
  read: (entry: Entry, signal?: AbortSignal) => Promise<Unit>;
  /** Pause between entries in a long run (ms). */
  pauseMs?: number;
  /** The licence read live from the source, when it has one to read (OpenStax `md:license`). */
  licence?: string;
}

/** What every source panel receives. */
export interface PanelProps {
  t: T;
  lang: string;
  def: import('../domains').SourceDef;
  /** The resume points saved for this source. */
  packs: readonly import('../memory/library').PackEntry[];
  /** True while a job runs or the saved library was not read. */
  disabled: boolean;
  /** A fetch through the host, for the sources without CORS. */
  host: import('../sources/types').FetchText;
  onImport: (req: ImportRequest, entry: Entry) => void;
  onImportAll: (req: ImportRequest, entries: readonly Entry[]) => void;
}
