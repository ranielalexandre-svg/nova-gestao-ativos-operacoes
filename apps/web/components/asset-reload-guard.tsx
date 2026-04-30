"use client";

import { useEffect } from "react";

export function AssetReloadGuard() {
  useEffect(() => {
    const key = `nova-asset-reload:${window.location.pathname}`;

    function enableCriticalCss() {
      const link = document.getElementById("nova-critical-css");
      if (link instanceof HTMLLinkElement) {
        link.media = "all";
      }
    }

    function reloadOnce() {
      if (window.sessionStorage.getItem(key)) return;

      window.sessionStorage.setItem(key, "1");
      window.location.reload();
    }

    function handleAssetError(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLLinkElement) && !(target instanceof HTMLScriptElement)) return;

      const url = target instanceof HTMLLinkElement ? target.href : target.src;
      if (!url.includes("/_next/static/")) return;

      if (target instanceof HTMLLinkElement) {
        enableCriticalCss();
        return;
      }

      reloadOnce();
    }

    async function verifyStaticStyles() {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/_next/static/"]'),
      );

      for (const link of links) {
        try {
          const response = await fetch(link.href, {
            method: "HEAD",
            cache: "no-store",
          });

          if (!response.ok) {
            enableCriticalCss();
            return;
          }
        } catch {
          enableCriticalCss();
          return;
        }
      }
    }

    const timer = window.setTimeout(() => {
      void verifyStaticStyles();
    }, 750);

    window.addEventListener("error", handleAssetError, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", handleAssetError, true);
    };
  }, []);

  return null;
}
