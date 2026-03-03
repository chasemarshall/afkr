import { useState, useCallback } from 'react';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const prefixedKey = `afkr:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(prefixedKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors
    }
    return defaultValue;
  });

  const setPersisted = useCallback(
    (newValue: T) => {
      setValue(newValue);
      try {
        localStorage.setItem(prefixedKey, JSON.stringify(newValue));
      } catch {
        // ignore quota errors
      }
    },
    [prefixedKey]
  );

  return [value, setPersisted];
}
