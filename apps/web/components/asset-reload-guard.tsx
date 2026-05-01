"use client";

import { useEffect } from "react";

export function AssetReloadGuard() {
  useEffect(() => {
    const key = `nova-asset-reload:${window.location.pathname}`;

    function reloadOnce() {
      if (window.sessionStorage.getItem(key)) return;

      window.sessionStorage.setItem(key, "1");
      window.location.reload();
    }

    function handleAssetError(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLScriptElement)) return;
      if (!target.src.includes("/_next/static/")) return;

      reloadOnce();
    }

    window.addEventListener("error", handleAssetError, true);
    return () => {
      window.removeEventListener("error", handleAssetError, true);
    };
  }, []);

  return null;
}
