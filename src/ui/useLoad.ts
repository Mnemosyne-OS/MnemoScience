/**
 * useLoad — the three states of a data view (rule 11): loading, error, data.
 * The last answer wins: a slower earlier call never overwrites a newer one,
 * and nothing is set after the view is gone.
 */
import { useEffect, useState } from 'react';

/** The three states of a loaded value. */
export type Loaded<T> = { kind: 'loading' } | { kind: 'error'; why: string } | { kind: 'ready'; data: T };

/** Runs `load` whenever `deps` change; null `load` = nothing to load. The last call wins. */
export function useLoad<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]): Loaded<T> | null {
  const [state, setState] = useState<Loaded<T> | null>(null);
  useEffect(() => {
    if (!load) { setState(null); return; }
    let alive = true;
    setState({ kind: 'loading' });
    load()
      .then((data) => { if (alive) setState({ kind: 'ready', data }); })
      .catch((err) => {
        console.error('[mnemo-science] list failed', err);
        if (alive) setState({ kind: 'error', why: err instanceof Error ? err.message : String(err) });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
