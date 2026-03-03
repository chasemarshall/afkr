import { useState, useCallback } from 'react';

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const prefixedKey = `afkr:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(prefixedKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors or SSR environments without localStorage
    }
    return defaultValue;
  });

  const setPersisted = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof newValue === 'function'
            ? (newValue as (prev: T) => T)(prev)
            : newValue;

        try {
          localStorage.setItem(prefixedKey, JSON.stringify(resolved));
        } catch {
          // ignore quota errors
        }

        return resolved;
      });
    },
    [prefixedKey],
  );

  return [value, setPersisted];
}
