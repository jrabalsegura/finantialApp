"use client";

import { useEffect, useState } from "react";

/** Shows the error left by `withErrorFeedback` and clears its cookie. */
export function FlashMessage({
  cookieName,
  value
}: {
  cookieName: string;
  value: string | undefined;
}) {
  const [dismissed, setDismissed] = useState<string>();
  const message = value?.slice(value.indexOf("|") + 1);

  useEffect(() => {
    if (value) document.cookie = `${cookieName}=; Max-Age=0; path=/`;
  }, [cookieName, value]);

  if (!value || !message || dismissed === value) return null;

  return (
    <div className="sticky top-0 z-50 px-4 pt-3" role="alert">
      <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 shadow-sm">
        <p className="flex-1">{message}</p>
        <button
          aria-label="Cerrar aviso"
          className="text-rose-700 hover:text-rose-950"
          onClick={() => setDismissed(value)}
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
