/**
 * strings.ts — everything MnemoScience says, in the languages it says it in.
 *
 * Same contract as MnemoLaw: the host broadcasts its language, a key missing
 * from a locale falls back to English key by key, and an unknown placeholder
 * stays visible. en / fr / es are written; de / pt / ru / zh read English.
 *
 * The science texts themselves are never translated: a memory quotes its
 * source verbatim. Licences are shown in the source's own words, in English
 * when the source writes them in English.
 */

export const LANGS = ['en', 'fr', 'es', 'de', 'pt', 'ru', 'zh'] as const;
export type Lang = (typeof LANGS)[number];

const en = {
  'app.subtitle': 'Science texts, in your memory',
  'app.quote': 'MnemoScience copies texts from their sources and names each source. It does not check or rewrite them.',

  'home.lead': 'Choose a field. Each source keeps its licence and its date, and every memory ends with the line that says where it comes from.',
  'home.sources': '{n} sources',
  'home.reading': 'Reading what is already in memory…',
  'home.nothingYet': 'Nothing in memory yet',
  'home.unreadable': 'What is in memory could not be read',
  'lib.unreadable': 'The saved list of what is in memory could not be read: {why}. Nothing will be written until it is read.',
  'lib.reading': 'Reading what is already in memory… Nothing can be put in memory before that.',
  'lib.blocked': 'What is in memory could not be read, so nothing can be written now (it would erase the resume points).',
  'home.inMemory': '{n} entries in memory · last on {date}',

  'domain.physics': 'Physics',
  'domain.chemistry': 'Chemistry',
  'domain.biology': 'Biology',
  'domain.mathematics': 'Mathematics',
  'domain.astronomy': 'Astronomy',
  'domain.history': 'History of science',

  'kind.openstax': 'OpenStax textbook',
  'kind.wikipedia': 'Encyclopedia, by category',
  'kind.planetmath': 'Mathematics encyclopedia',
  'kind.mactutor': 'Biographies of mathematicians',
  'kind.oeis': 'Integer sequences',
  'kind.arxiv': 'Preprint abstracts',

  'size.modules': '{n} modules (sections of the book)',
  'size.biographies': '{n} biographies',
  'size.preprints': '{n} preprints in the category',
  'size.classes': '{n} classes of the MSC',
  'size.category': 'Size read from the category when it opens',
  'size.search': 'By search, the first {max} results',

  'source.langs': 'Language: {langs}',
  'source.licence': 'Licence: {licence}',
  'source.site': 'See the source',
  'licence.arxiv': 'per article, not given by the arXiv API; see each article page',

  'nav.back': '← Back',
  'chat.hint': 'To ask a question in your own words: open the chat and tick the field under Knowledge in its scope.',

  'lib.retry': 'Retry',

  'list.loading': 'Reading the list…',
  'list.failed': 'The list could not be read: {why}',
  'list.count': '{n} entries in this list',
  'list.importAll': 'Put all {n} in memory',
  'list.resume': 'Resume ({cursor} of {total} done)',
  'list.importOne': 'Put in memory',
  'list.filter': 'Filter this list',
  'list.none': 'No entry matches “{q}”.',
  'list.more': 'Showing the first {shown} of {n}. Refine the filter to see the others.',
  'list.loadMore': 'Load more',

  'pack.progress': 'Started: {cursor} of {total} read, {inVault} in memory, {refused} refused by the source, {failed} refused by the memory.',
  'pack.done': 'Done: {inVault} in memory, {refused} refused by the source, {failed} refused by the memory.',

  'job.one': 'Reading “{title}”… {elapsed}',
  'job.pack': '{label}: {cursor} of {total}, {inVault} in memory · {elapsed}',
  'job.eta': 'about {left} left',
  'job.stop': 'Stop',

  'import.failed': 'It did not work: {why}',
  'import.noKnowledgeRoot': 'Choose where knowledge goes in the Hub that just opened, then try again.',
  'import.doneOne': '“{title}” is in memory.',
  'import.partOne': '“{title}”: the memory refused at least one part, so it is not counted.',
  'import.refusedOne': '“{title}”: the source gave nothing to keep.',
  'import.stopped': 'Stopped. What was written stays; the next press resumes at the next entry.',
  'import.finished': 'Finished: {inVault} entries in memory, {refused} refused by the source, {failed} refused by the memory.',

  'openstax.licenceLive': 'Licence read from the book file: {licence}',
  'openstax.noLicence': 'the book file states none',
  'openstax.pushed': 'Repository last updated on {date}',
  'openstax.noDate': 'The repository date could not be read; memories will carry no date.',
  'openstax.quota': 'The repository date costs one GitHub request per book, out of 60 an hour without an account.',
  'openstax.titles': 'Module titles from the list built on {date}; each text is read live.',

  'wiki.lang': 'Wikipedia in',
  'wiki.subcats': '{n} sub-categories:',
  'wiki.capped': 'This category is large: only its first {max} members are listed.',

  'pm.stale': 'PlanetMath is no longer updated: most of its repositories were last changed in 2018.',
  'pm.quota': 'Opening a class asks GitHub once. Without an account GitHub allows 60 requests an hour.',
  'pm.class': 'Class of the Mathematics Subject Classification',
  'pm.choose': 'Choose a class',
  'pm.pushed': 'Repository last pushed on {date} (measured on 2026-10-04)',
  'pm.remaining': 'GitHub requests left this hour: {n}',
  'pm.remainingUnknown': 'GitHub did not say how many requests are left this hour.',
  'pm.truncated': 'GitHub cut this list: some entries are missing.',
  'pm.rateLimit': 'GitHub limit reached for this hour. Try again later.',
  'pm.rateLimitAt': 'GitHub limit reached for this hour. Try again after {at}.',

  'mactutor.date': 'The date of a biography is the “Last Update” the page states. Without it, the memory carries no date.',

  'oeis.cap': 'The OEIS shows the first {max} results of a search without an account.',
  'oeis.placeholder': 'Search the OEIS (words, terms, A-number)',
  'oeis.search': 'Search',
  'oeis.none': 'The OEIS found nothing for “{q}”.',
  'oeis.refused': 'The OEIS refused this search (HTTP 403).',
  'oeis.end': 'End of the results the OEIS shows ({n}).',

  'arxiv.note': 'Abstracts only, newest first. The arXiv API gives no licence: each article sets its own.',
  'arxiv.total': '{n} preprints in {cat}',

  'footer.folder': 'Copies are kept in {folder}',
  'footer.noFolder': 'Copies are kept in your knowledge folder from the first text you put in memory.',
  'footer.open': 'Open the folder',
};

export type Key = keyof typeof en;
type Dict = Partial<Record<Key, string>>;

const fr: Dict = {
  'app.subtitle': 'Des textes de science, dans ta mémoire',
  'app.quote': 'MnemoScience copie des textes depuis leurs sources et nomme chaque source. Il ne les vérifie pas et ne les réécrit pas.',

  'home.lead': 'Choisis un domaine. Chaque source garde sa licence et sa date, et chaque mémoire finit par la ligne qui dit d’où elle vient.',
  'home.sources': '{n} sources',
  'home.reading': 'Lecture de ce qui est déjà en mémoire…',
  'home.nothingYet': 'Rien en mémoire pour l’instant',
  'home.unreadable': 'Ce qui est en mémoire n’a pas pu être lu',
  'lib.unreadable': 'La liste enregistrée de ce qui est en mémoire n’a pas pu être lue : {why}. Rien ne sera écrit tant qu’elle n’est pas lue.',
  'lib.reading': 'Lecture de ce qui est déjà en mémoire… Rien ne peut être versé avant.',
  'lib.blocked': 'Ce qui est en mémoire n’a pas pu être lu, donc rien ne peut être écrit pour l’instant (cela effacerait les points de reprise).',
  'home.inMemory': '{n} entrées en mémoire · dernière le {date}',

  'domain.physics': 'Physique',
  'domain.chemistry': 'Chimie',
  'domain.biology': 'Biologie',
  'domain.mathematics': 'Mathématiques',
  'domain.astronomy': 'Astronomie',
  'domain.history': 'Histoire des sciences',

  'kind.openstax': 'Manuel OpenStax',
  'kind.wikipedia': 'Encyclopédie, par catégorie',
  'kind.planetmath': 'Encyclopédie de mathématiques',
  'kind.mactutor': 'Biographies de mathématiciens',
  'kind.oeis': 'Suites d’entiers',
  'kind.arxiv': 'Résumés de prépublications',

  'size.modules': '{n} modules (sections du livre)',
  'size.biographies': '{n} biographies',
  'size.preprints': '{n} prépublications dans la catégorie',
  'size.classes': '{n} classes de la MSC',
  'size.category': 'Taille lue dans la catégorie à l’ouverture',
  'size.search': 'Par recherche, les {max} premiers résultats',

  'source.langs': 'Langue : {langs}',
  'source.licence': 'Licence : {licence}',
  'source.site': 'Voir la source',
  'licence.arxiv': 'par article, non donnée par l’API arXiv ; voir la page de chaque article',

  'nav.back': '← Retour',
  'chat.hint': 'Pour poser une question avec tes mots : ouvre le chat et coche le domaine sous Connaissances dans sa portée.',

  'lib.retry': 'Réessayer',

  'list.loading': 'Lecture de la liste…',
  'list.failed': 'La liste n’a pas pu être lue : {why}',
  'list.count': '{n} entrées dans cette liste',
  'list.importAll': 'Verser les {n} en mémoire',
  'list.resume': 'Reprendre ({cursor} sur {total} faites)',
  'list.importOne': 'Verser en mémoire',
  'list.filter': 'Filtrer cette liste',
  'list.none': 'Aucune entrée ne correspond à « {q} ».',
  'list.more': 'Les {shown} premières sur {n}. Affine le filtre pour voir les autres.',
  'list.loadMore': 'En charger plus',

  'pack.progress': 'Commencé : {cursor} sur {total} lues, {inVault} en mémoire, {refused} refusées par la source, {failed} refusées par la mémoire.',
  'pack.done': 'Terminé : {inVault} en mémoire, {refused} refusées par la source, {failed} refusées par la mémoire.',

  'job.one': 'Lecture de « {title} »… {elapsed}',
  'job.pack': '{label} : {cursor} sur {total}, {inVault} en mémoire · {elapsed}',
  'job.eta': 'encore environ {left}',
  'job.stop': 'Arrêter',

  'import.failed': 'Ça n’a pas marché : {why}',
  'import.noKnowledgeRoot': "Choisis où ranger les connaissances dans le Hub qui vient de s'ouvrir, puis réessaie.",
  'import.doneOne': '« {title} » est en mémoire.',
  'import.partOne': '« {title} » : la mémoire a refusé au moins une partie, l’entrée n’est donc pas comptée.',
  'import.refusedOne': '« {title} » : la source n’a rien donné à garder.',
  'import.stopped': 'Arrêté. Ce qui est écrit reste ; le prochain appui reprend à l’entrée suivante.',
  'import.finished': 'Terminé : {inVault} entrées en mémoire, {refused} refusées par la source, {failed} refusées par la mémoire.',

  'openstax.licenceLive': 'Licence lue dans le fichier du livre : {licence}',
  'openstax.noLicence': 'le fichier du livre n’en indique aucune',
  'openstax.pushed': 'Dépôt mis à jour le {date}',
  'openstax.noDate': 'La date du dépôt n’a pas pu être lue ; les mémoires n’auront pas de date.',
  'openstax.quota': 'La date du dépôt coûte une requête GitHub par livre, sur 60 par heure sans compte.',
  'openstax.titles': 'Titres des modules tirés de la liste construite le {date} ; chaque texte est lu en direct.',

  'wiki.lang': 'Wikipédia en',
  'wiki.subcats': '{n} sous-catégories :',
  'wiki.capped': 'Cette catégorie est grande : seuls ses {max} premiers membres sont listés.',

  'pm.stale': 'PlanetMath n’est plus mis à jour : la plupart de ses dépôts datent de 2018.',
  'pm.quota': 'Ouvrir une classe interroge GitHub une fois. Sans compte, GitHub permet 60 requêtes par heure.',
  'pm.class': 'Classe de la Mathematics Subject Classification',
  'pm.choose': 'Choisis une classe',
  'pm.pushed': 'Dépôt mis à jour le {date} (mesuré le 04/10/2026)',
  'pm.remaining': 'Requêtes GitHub restantes cette heure : {n}',
  'pm.remainingUnknown': 'GitHub n’a pas dit combien de requêtes il reste cette heure.',
  'pm.truncated': 'GitHub a coupé cette liste : il manque des entrées.',
  'pm.rateLimit': 'Limite GitHub atteinte pour cette heure. Réessaie plus tard.',
  'pm.rateLimitAt': 'Limite GitHub atteinte pour cette heure. Réessaie après {at}.',

  'mactutor.date': 'La date d’une biographie est le « Last Update » écrit sur la page. Sans lui, la mémoire n’a pas de date.',

  'oeis.cap': 'Sans compte, l’OEIS montre les {max} premiers résultats d’une recherche.',
  'oeis.placeholder': 'Chercher dans l’OEIS (mots, termes, numéro A)',
  'oeis.search': 'Chercher',
  'oeis.none': 'L’OEIS n’a rien trouvé pour « {q} ».',
  'oeis.refused': 'L’OEIS a refusé cette recherche (HTTP 403).',
  'oeis.end': 'Fin des résultats que l’OEIS montre ({n}).',

  'arxiv.note': 'Résumés seulement, les plus récents d’abord. L’API arXiv ne donne aucune licence : chaque article a la sienne.',
  'arxiv.total': '{n} prépublications dans {cat}',

  'footer.folder': 'Les copies sont rangées dans {folder}',
  'footer.noFolder': 'Les copies sont rangées dans ton dossier des connaissances dès le premier texte versé en mémoire.',
  'footer.open': 'Ouvrir le dossier',
};

const es: Dict = {
  'app.subtitle': 'Textos de ciencia, en tu memoria',
  'app.quote': 'MnemoScience copia textos de sus fuentes y nombra cada fuente. No los comprueba ni los reescribe.',

  'home.lead': 'Elige un campo. Cada fuente conserva su licencia y su fecha, y cada recuerdo termina con la línea que dice de dónde viene.',
  'home.sources': '{n} fuentes',
  'home.reading': 'Leyendo lo que ya está en memoria…',
  'home.nothingYet': 'Nada en memoria por ahora',
  'home.unreadable': 'No se pudo leer lo que hay en memoria',
  'lib.unreadable': 'No se pudo leer la lista guardada de lo que hay en memoria: {why}. No se escribirá nada hasta leerla.',
  'lib.reading': 'Leyendo lo que ya está en memoria… No se puede guardar nada antes.',
  'lib.blocked': 'No se pudo leer lo que hay en memoria, así que no se puede escribir nada por ahora (borraría los puntos de reanudación).',
  'home.inMemory': '{n} entradas en memoria · la última el {date}',

  'domain.physics': 'Física',
  'domain.chemistry': 'Química',
  'domain.biology': 'Biología',
  'domain.mathematics': 'Matemáticas',
  'domain.astronomy': 'Astronomía',
  'domain.history': 'Historia de la ciencia',

  'kind.openstax': 'Libro de texto OpenStax',
  'kind.wikipedia': 'Enciclopedia, por categoría',
  'kind.planetmath': 'Enciclopedia de matemáticas',
  'kind.mactutor': 'Biografías de matemáticos',
  'kind.oeis': 'Sucesiones de enteros',
  'kind.arxiv': 'Resúmenes de preprints',

  'size.modules': '{n} módulos (secciones del libro)',
  'size.biographies': '{n} biografías',
  'size.preprints': '{n} preprints en la categoría',
  'size.classes': '{n} clases de la MSC',
  'size.category': 'Tamaño leído en la categoría al abrirla',
  'size.search': 'Por búsqueda, los {max} primeros resultados',

  'source.langs': 'Idioma: {langs}',
  'source.licence': 'Licencia: {licence}',
  'source.site': 'Ver la fuente',
  'licence.arxiv': 'por artículo, la API de arXiv no la da; ver la página de cada artículo',

  'nav.back': '← Volver',
  'chat.hint': 'Para hacer una pregunta con tus palabras: abre el chat y marca el campo en Conocimientos de su alcance.',

  'lib.retry': 'Reintentar',

  'list.loading': 'Leyendo la lista…',
  'list.failed': 'No se pudo leer la lista: {why}',
  'list.count': '{n} entradas en esta lista',
  'list.importAll': 'Guardar las {n} en memoria',
  'list.resume': 'Reanudar ({cursor} de {total} hechas)',
  'list.importOne': 'Guardar en memoria',
  'list.filter': 'Filtrar esta lista',
  'list.none': 'Ninguna entrada coincide con «{q}».',
  'list.more': 'Las {shown} primeras de {n}. Afina el filtro para ver las demás.',
  'list.loadMore': 'Cargar más',

  'pack.progress': 'Empezado: {cursor} de {total} leídas, {inVault} en memoria, {refused} rechazadas por la fuente, {failed} rechazadas por la memoria.',
  'pack.done': 'Terminado: {inVault} en memoria, {refused} rechazadas por la fuente, {failed} rechazadas por la memoria.',

  'job.one': 'Leyendo «{title}»… {elapsed}',
  'job.pack': '{label}: {cursor} de {total}, {inVault} en memoria · {elapsed}',
  'job.eta': 'faltan unos {left}',
  'job.stop': 'Detener',

  'import.failed': 'No funcionó: {why}',
  'import.noKnowledgeRoot': 'Elige dónde guardar los conocimientos en el Hub que se acaba de abrir y vuelve a intentarlo.',
  'import.doneOne': '«{title}» está en memoria.',
  'import.partOne': '«{title}»: la memoria rechazó al menos una parte, así que no se cuenta.',
  'import.refusedOne': '«{title}»: la fuente no dio nada que guardar.',
  'import.stopped': 'Detenido. Lo escrito se queda; la próxima pulsación sigue en la entrada siguiente.',
  'import.finished': 'Terminado: {inVault} entradas en memoria, {refused} rechazadas por la fuente, {failed} rechazadas por la memoria.',

  'openstax.licenceLive': 'Licencia leída en el archivo del libro: {licence}',
  'openstax.noLicence': 'el archivo del libro no indica ninguna',
  'openstax.pushed': 'Repositorio actualizado el {date}',
  'openstax.noDate': 'No se pudo leer la fecha del repositorio; los recuerdos no llevarán fecha.',
  'openstax.quota': 'La fecha del repositorio cuesta una petición a GitHub por libro, de 60 por hora sin cuenta.',
  'openstax.titles': 'Títulos de los módulos tomados de la lista construida el {date}; cada texto se lee en directo.',

  'wiki.lang': 'Wikipedia en',
  'wiki.subcats': '{n} subcategorías:',
  'wiki.capped': 'Esta categoría es grande: solo se listan sus {max} primeros miembros.',

  'pm.stale': 'PlanetMath ya no se actualiza: la mayoría de sus repositorios son de 2018.',
  'pm.quota': 'Abrir una clase consulta GitHub una vez. Sin cuenta, GitHub permite 60 peticiones por hora.',
  'pm.class': 'Clase de la Mathematics Subject Classification',
  'pm.choose': 'Elige una clase',
  'pm.pushed': 'Repositorio actualizado el {date} (medido el 04/10/2026)',
  'pm.remaining': 'Peticiones a GitHub que quedan esta hora: {n}',
  'pm.remainingUnknown': 'GitHub no dijo cuántas peticiones quedan esta hora.',
  'pm.truncated': 'GitHub cortó esta lista: faltan entradas.',
  'pm.rateLimit': 'Límite de GitHub alcanzado para esta hora. Vuelve a intentarlo más tarde.',
  'pm.rateLimitAt': 'Límite de GitHub alcanzado para esta hora. Vuelve a intentarlo después de las {at}.',

  'mactutor.date': 'La fecha de una biografía es el «Last Update» que indica la página. Sin él, el recuerdo no lleva fecha.',

  'oeis.cap': 'Sin cuenta, la OEIS muestra los {max} primeros resultados de una búsqueda.',
  'oeis.placeholder': 'Buscar en la OEIS (palabras, términos, número A)',
  'oeis.search': 'Buscar',
  'oeis.none': 'La OEIS no encontró nada para «{q}».',
  'oeis.refused': 'La OEIS rechazó esta búsqueda (HTTP 403).',
  'oeis.end': 'Fin de los resultados que muestra la OEIS ({n}).',

  'arxiv.note': 'Solo resúmenes, los más recientes primero. La API de arXiv no da licencia: cada artículo tiene la suya.',
  'arxiv.total': '{n} preprints en {cat}',

  'footer.folder': 'Las copias se guardan en {folder}',
  'footer.noFolder': 'Las copias se guardan en tu carpeta de conocimientos desde el primer texto que guardas en memoria.',
  'footer.open': 'Abrir la carpeta',
};

/** de / pt / ru / zh are not written yet: those locales read English. */
const DICTS: Record<Lang, Dict> = { en, fr, es, de: {}, pt: {}, ru: {}, zh: {} };

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

/** One string, in one language, with `{placeholders}` filled. A missing key reads English. */
export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const s = DICTS[lang]?.[key] ?? en[key];
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** For the parity test: every written locale and its dictionary. */
export const WRITTEN: Record<'en' | 'fr' | 'es', Dict> = { en, fr, es };
