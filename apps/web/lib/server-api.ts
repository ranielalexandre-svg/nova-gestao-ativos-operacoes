import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api";
import { WEB_ACCESS_COOKIE } from "@/lib/web-session";

export async function getAccessToken() {
  const cookieStore = await cookies();
  return decodeURIComponent(cookieStore.get(WEB_ACCESS_COOKIE)?.value || "");
}

export async function apiFetch(path: string, init: RequestInit = {}, authenticated = true) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});

  if (authenticated) {
    if (!token) {
      throw new Error("Sessão ausente");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message = String(payload?.message || message);
    } catch {}
    throw new Error(message);
  }

  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const response = await apiFetch(path, init, authenticated);
  return response.json() as Promise<T>;
}
