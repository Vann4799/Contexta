"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

// Fourteen columns inside a 300px card leaves ~21px per target, far under a thumb. Dragging
// across the chart scrubs the selection instead, so accuracy comes from the gesture rather
// than the hit box. Pair with `touch-pan-y` so vertical page scroll still wins.
export function useScrub(
  hostRef: RefObject<HTMLElement | null>,
  count: number,
  onSelect: (index: number) => void
): {
  scrubProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  consumeScrub: () => boolean;
} {
  const drag = useRef({ down: false, x: 0, scrubbed: false });

  const pick = useCallback(
    (clientX: number) => {
      const el = hostRef.current;
      if (!el || count === 0) return;
      const rect = el.getBoundingClientRect();
      const i = Math.floor(((clientX - rect.left) / rect.width) * count);
      onSelect(Math.max(0, Math.min(count - 1, i)));
    },
    [hostRef, count, onSelect]
  );

  return {
    scrubProps: {
      onPointerDown: (e) => {
        drag.current = { down: true, x: e.clientX, scrubbed: false };
      },
      onPointerMove: (e) => {
        if (!drag.current.down) return;
        if (!drag.current.scrubbed && Math.abs(e.clientX - drag.current.x) < 8) return;
        drag.current.scrubbed = true;
        pick(e.clientX);
      },
      onPointerUp: () => {
        drag.current.down = false;
      },
      onPointerCancel: () => {
        drag.current.down = false;
      },
    },
    // A scrub has already set the selection; the click that follows would toggle it straight off.
    consumeScrub: () => {
      if (!drag.current.scrubbed) return false;
      drag.current.scrubbed = false;
      return true;
    },
  };
}
