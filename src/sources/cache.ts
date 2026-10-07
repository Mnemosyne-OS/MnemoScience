/**
 * cache — answers that do not change within a session (rule 15): a book's
 * plan, a repository's push date, a PlanetMath tree, the MacTutor index.
 *
 * A failed call is NOT kept: the next open tries again (a GitHub quota spent
 * at 10:00 is back at 11:00).
 */
const store = new Map<string, Promise<unknown>>();

/** The session answer for `key`, loading it once; a failure is forgotten so the next call retries. */
export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = load();
  store.set(key, p);
  p.catch((err) => {
    store.delete(key);
    console.warn('[mnemo-science] not cached, will retry next time:', key, err);
  });
  return p;
}
