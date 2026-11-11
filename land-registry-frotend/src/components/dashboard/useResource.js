import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small data-loading helper. `key` controls when the loader runs; the loader
 * itself is read through a ref so callers do not need to memoize it.
 */
export function useResource(loader, key = '', { enabled = true } = {}) {
  const loaderRef = useRef(loader);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Request failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        if (!enabled) {
          setLoading(false);
          return undefined;
        }
        setLoading(true);
        setError(null);
        return loaderRef.current();
      })
      .then((result) => {
        if (active && result !== undefined) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Request failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, enabled]);

  return { data, setData, loading, error, reload };
}
