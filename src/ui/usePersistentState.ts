import { useEffect, useState } from "react";

/**
 * State kept in localStorage so a half-planned week survives a refresh.
 * Storage can throw (private browsing, blocked cookies), so every access is
 * guarded and the app simply falls back to in-memory state.
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable, so keep going without persistence */
    }
  }, [key, value]);

  return [value, setValue];
}
