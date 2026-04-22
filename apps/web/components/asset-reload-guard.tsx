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

    function hardenLoginForm() {
      if (window.location.pathname !== "/login") return;

      const form = document.querySelector("form");
      if (!(form instanceof HTMLFormElement)) return;

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/dashboard";
      form.method = "post";
      form.action = `/api/auth/web-session?next=${encodeURIComponent(next)}`;

      const emailInput = form.querySelector('input[type="email"]');
      if (emailInput instanceof HTMLInputElement) {
        emailInput.name = "email";
      }

      const passwordInput = form.querySelector('input[type="password"], input[autocomplete="current-password"]');
      if (passwordInput instanceof HTMLInputElement) {
        passwordInput.name = "password";
      }

      if (!form.querySelector('input[name="next"]')) {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "next";
        hidden.value = next;
        form.prepend(hidden);
      }

      if (form.dataset.novaLoginGuard === "true") return;

      form.dataset.novaLoginGuard = "true";
      form.addEventListener("submit", async (event) => {
        const currentEmailInput = form.querySelector('input[type="email"]');
        const currentPasswordInput = form.querySelector('input[type="password"], input[autocomplete="current-password"]');
        if (!(currentEmailInput instanceof HTMLInputElement) || !(currentPasswordInput instanceof HTMLInputElement)) {
          return;
        }

        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = true;
        }

        try {
          const response = await fetch("/api/auth/web-session", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: currentEmailInput.value,
              password: currentPasswordInput.value,
            }),
          });
          const payload = await response.json().catch(() => null);

          if (response.ok && payload?.authenticated) {
            window.location.assign(next);
            return;
          }

          showLoginError(form, payload?.message || "Nao foi possivel entrar. Confira e-mail e senha.");
        } catch {
          showLoginError(form, "Nao foi possivel entrar agora. Tente novamente.");
        } finally {
          if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = false;
          }
        }
      });
    }

    function showLoginError(form: HTMLFormElement, message: string) {
      let alert = form.querySelector<HTMLElement>('[data-nova-login-error="true"]');
      if (!alert) {
        alert = document.createElement("div");
        alert.dataset.novaLoginError = "true";
        alert.setAttribute("role", "alert");
        alert.setAttribute("aria-live", "polite");
        alert.className =
          "rounded-[14px] border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100";
        form.append(alert);
      }

      alert.textContent = message;
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
      hardenLoginForm();
      void verifyStaticStyles();
    }, 750);

    hardenLoginForm();
    window.addEventListener("error", handleAssetError, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", handleAssetError, true);
    };
  }, []);

  return null;
}
