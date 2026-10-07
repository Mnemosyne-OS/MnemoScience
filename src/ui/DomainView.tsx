/**
 * DomainView — one sub-domain: a tile per wired source, with its size, its
 * licence in the source's own words, its language, and what is in memory.
 */
import { S } from './styles';
import { DOMAIN_ICONS, sourcesOf } from '../domains';
import { memoryLine, sizeLine } from './labels';
import type { DomainId } from '../sources/types';
import { sourceSummary, type LibraryState } from '../memory/library';
import type { LibRead, T } from './types';

/** One sub-domain: a tile per wired source. */
export function DomainView({ t, lang, domain, lib, libRead, onBack, onOpen }: {
  t: T;
  lang: string;
  domain: DomainId;
  lib: LibraryState;
  libRead: LibRead;
  onBack: () => void;
  onOpen: (sourceId: string) => void;
}) {
  const sources = sourcesOf(domain);
  return (
    <>
      <div><button style={S.link} onClick={onBack}>{t('nav.back')}</button></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 32, lineHeight: 1 }} aria-hidden="true">{DOMAIN_ICONS[domain]}</span>
        <div style={S.countryName}>{t(`domain.${domain}` as const)}</div>
      </div>
      <div style={S.grid}>
        {sources.map((s) => {
          const sum = sourceSummary(lib, s.id);
          return (
            <button key={s.id} style={S.countryCard} onClick={() => onOpen(s.id)}>
              <span style={S.small}>{t(`kind.${s.kind}` as const)}</span>
              <span style={S.countryName}>{s.name}</span>
              <span style={S.small}>{t('source.langs', { langs: s.langs.map((l) => l.toUpperCase()).join(' · ') })}</span>
              <span style={S.small}>{sizeLine(t, lang, s)}</span>
              <span style={S.small}>{t('source.licence', { licence: s.licence ?? t('licence.arxiv') })}</span>
              <span style={S.small}>{memoryLine(t, lang, sum, libRead)}</span>
            </button>
          );
        })}
      </div>
      <p style={S.small}>{t('chat.hint')}</p>
    </>
  );
}
