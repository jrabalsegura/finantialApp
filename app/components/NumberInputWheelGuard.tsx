"use client";

import { useEffect } from "react";

export function NumberInputWheelGuard() {
  useEffect(() => {
    function preventFocusedNumberWheel(event: WheelEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const input = target.closest('input[type="number"]');

      if (input && document.activeElement === input) {
        event.preventDefault();
      }
    }

    document.addEventListener("wheel", preventFocusedNumberWheel, {
      passive: false
    });

    return () => {
      document.removeEventListener("wheel", preventFocusedNumberWheel);
    };
  }, []);

  return null;
}
