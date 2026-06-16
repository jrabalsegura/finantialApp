"use client";

import { useEffect, useRef } from "react";

type RecentTransactionEditDetailsProps = {
  children: React.ReactNode;
  summary: React.ReactNode;
};

export function RecentTransactionEditDetails({
  children,
  summary
}: RecentTransactionEditDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const details = detailsRef.current;

      if (
        !details?.open ||
        !(event.target instanceof Node) ||
        details.contains(event.target)
      ) {
        return;
      }

      details.open = false;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details
      className="relative text-sm"
      ref={detailsRef}
      onSubmitCapture={() => {
        if (detailsRef.current) {
          detailsRef.current.open = false;
        }
      }}
    >
      {summary}
      {children}
    </details>
  );
}
