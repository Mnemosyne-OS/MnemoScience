/**
 * Home — one tile per sub-domain, each saying what is already in memory.
 *
 * The count and the date come from the cartridge's durable state. A domain
 * with nothing in it says so in words: never a "0" that could read as a
 * measured count of a source.
 */
import { S } from './styles';
import { DOMAIN_ICONS, sourcesOf } from '../domains';
import { DOMAINS, type DomainId } from '../sources/types';
import { domainSummary, type LibraryState } from '../memory/library';
import { memoryLine } from './labels';
import type { LibRead, T } from './types';

/** The home screen: one tile per sub-domain. */
export function Home({ t, lang, lib, libRead, onOpen }: {
  t: T;
  lang: string;
  lib: LibraryState;
  libRead: LibRead;
  onOpen: (domain: DomainId) => void;
}) {
  return (
    <>
      <p style={S.p}>{t('home.lead')}</p>
      <div style={S.grid}>
        {DOMAINS.map((d) => {
          const sum = domainSummary(lib, d);
          return (
            <button key={d} style={S.countryCard} onClick={() => onOpen(d)}>
              <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">{DOMAIN_ICONS[d]}</span>
              <span style={S.countryName}>{t(`domain.${d}` as const)}</span>
              <span style={S.small}>{t('home.sources', { n: sourcesOf(d).length })}</span>
              <span style={S.small}>
                {memoryLine(t, lang, sum, libRead)}
              </span>
            </button>
          );
        })}
      </div>
      <p style={S.small}>{t('chat.hint')}</p>
    </>
  );
}
