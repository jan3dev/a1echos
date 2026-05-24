import { useCallback, useEffect, useMemo, useRef } from "react";

export interface ProgrammaticScrollGuard {
  begin: () => void;
  isActive: () => boolean;
}

export function useProgrammaticScrollGuard(
  durationMs = 600,
): ProgrammaticScrollGuard {
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const begin = useCallback(() => {
    activeRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      activeRef.current = false;
    }, durationMs);
  }, [durationMs]);

  const isActive = useCallback(() => activeRef.current, []);

  return useMemo(() => ({ begin, isActive }), [begin, isActive]);
}
