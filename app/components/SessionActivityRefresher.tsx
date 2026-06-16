"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const ACTIVITY_PING_INTERVAL_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = [
  "focus",
  "input",
  "keydown",
  "pointerdown",
  "scroll",
  "touchstart"
];

export function SessionActivityRefresher() {
  const inFlightRef = useRef(false);
  const lastPingAtRef = useRef(Date.now());
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/login")) {
      return;
    }

    function refreshSession() {
      const now = Date.now();

      if (
        document.visibilityState === "hidden" ||
        inFlightRef.current ||
        now - lastPingAtRef.current < ACTIVITY_PING_INTERVAL_MS
      ) {
        return;
      }

      inFlightRef.current = true;
      lastPingAtRef.current = now;

      fetch("/api/session/refresh", {
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true
      })
        .then((response) => {
          if (response.redirected && isLoginUrl(response.url)) {
            window.location.assign(response.url);
          }
        })
        .catch(() => {
          // The next authenticated request will redirect to login if renewal failed.
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, refreshSession, { passive: true });
    });
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, refreshSession);
      });
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname]);

  return null;
}

function isLoginUrl(value: string): boolean {
  try {
    return new URL(value, window.location.origin).pathname.startsWith("/login");
  } catch {
    return false;
  }
}
