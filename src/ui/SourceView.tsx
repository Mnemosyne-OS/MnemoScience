/**
 * SourceView — one source: what it is (licence in its own words, language,
 * size), the running job, and its list through the panel of its kind.
 */
import { S } from './styles';
import { sizeLine } from './labels';
import { OpenStaxPanel } from './OpenStaxPanel';
import { WikipediaPanel } from './WikipediaPanel';
import { PlanetMathPanel } from './PlanetMathPanel';
import { MacTutorPanel } from './MacTutorPanel';
import { OeisPanel } from './OeisPanel';
import { ArxivPanel } from './ArxivPanel';
import { formatDuration, remainingSeconds } from '../memory/eta';
import type { SourceDef } from '../domains';
import type { LibraryState } from '../memory/library';
import type { Entry, FetchText } from '../sources/types';
import type { ImportRequest, Job, LibRead, PanelProps, T } from './types';

/** One source: what it is, the running job, and its list. */
export function SourceView(props: {
  t: T;
  lang: string;
  def: SourceDef;
  lib: LibraryState;
  libRead: LibRead;
  job: Job | null;
  now: number;
  notice: string[];
  host: FetchText;
  onBack: () => void;
  onOpenSite: (url: string) => void;
  onImport: (req: ImportRequest, entry: Entry) => void;
  onImportAll: (req: ImportRequest, entries: readonly Entry[]) => void;
  onStop: () => void;
}) {
  const { t, lang, def, job, now } = props;
  const seconds = job ? Math.max(0, Math.round((now - job.startedAt) / 1000)) : 0;
  const panel: PanelProps = {
    t, lang, def,
    packs: props.lib.packs.filter((p) => p.sourceId === def.id),
    disabled: !!job || props.libRead.kind !== 'read',
    host: props.host,
    onImport: props.onImport,
    onImportAll: props.onImportAll,
  };

  return (
    <>
      <div><button style={S.link} disabled={!!job} onClick={props.onBack}>{t('nav.back')}</button></div>
      <section style={S.card}>
        <div style={S.small}>{t(`kind.${def.kind}` as const)}</div>
        <div style={S.countryName}>{def.name}</div>
        <div style={S.small}>{t('source.langs', { langs: def.langs.map((l) => l.toUpperCase()).join(' · ') })} · {sizeLine(t, lang, def)}</div>
        <div style={S.small}>{t('source.licence', { licence: def.licence ?? t('licence.arxiv') })}</div>
        <button style={S.link} onClick={() => props.onOpenSite(def.home)}>{t('source.site')}</button>
      </section>

      {props.libRead.kind !== 'read' && <div style={S.small}>{t(props.libRead.kind === 'reading' ? 'lib.reading' : 'lib.blocked')}</div>}

      {job && job.kind !== 'list' && (
        <section style={S.card} aria-live="polite">
          <div>
            {job.kind === 'one' && t('job.one', { title: job.title, elapsed: formatDuration(seconds) })}
            {job.kind === 'pack' && (() => {
              const left = remainingSeconds(job.cursor - job.startCursor, job.total - job.startCursor, (now - job.startedAt) / 1000);
              const line = t('job.pack', {
                label: job.label, cursor: job.cursor.toLocaleString(lang), total: job.total.toLocaleString(lang),
                inVault: job.inVault.toLocaleString(lang), elapsed: formatDuration(seconds),
              });
              return left === null ? line : `${line} · ${t('job.eta', { left: formatDuration(left) })}`;
            })()}
          </div>
          <button style={{ ...S.ghost, alignSelf: 'flex-start' }} onClick={props.onStop}>{t('job.stop')}</button>
        </section>
      )}

      {props.notice.length > 0 && <section style={S.card} role="status">{props.notice.map((n, i) => <div key={i}>{n}</div>)}</section>}

      {def.kind === 'openstax' && <OpenStaxPanel {...panel} />}
      {def.kind === 'wikipedia' && <WikipediaPanel {...panel} />}
      {def.kind === 'planetmath' && <PlanetMathPanel {...panel} />}
      {def.kind === 'mactutor' && <MacTutorPanel {...panel} />}
      {def.kind === 'oeis' && <OeisPanel {...panel} />}
      {def.kind === 'arxiv' && <ArxivPanel {...panel} />}

      <p style={S.small}>{t('chat.hint')}</p>
    </>
  );
}
