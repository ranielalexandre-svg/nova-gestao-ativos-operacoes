import { API_BASE_URL } from "@/lib/api";

export const WEB_ACCESS_COOKIE = "nova_access_token";

export type WebSessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
};

export type WebSession = {
  authenticated: boolean;
  user: WebSessionUser | null;
};

export class BackendHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BackendHttpError";
  }
}

export function normalizeRole(role: string) {
  return String(role || "").trim().toLowerCase();
}

function anonymousSession(): WebSession {
  return { authenticated: false, user: null };
}

function normalizeUserLike(payload: unknown): WebSession {
  if (!payload || typeof payload !== "object") {
    return anonymousSession();
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.authenticated === "boolean") {
    const user = record.user;
    if (!record.authenticated || !user || typeof user !== "object") {
      return anonymousSession();
    }

    const u = user as Record<string, unknown>;
    if (!u.id || !u.email || !u.name || !u.role) {
      return anonymousSession();
    }

    return {
      authenticated: true,
      user: {
        id: String(u.id),
        email: String(u.email),
        name: String(u.name),
        role: String(u.role),
        isActive: typeof u.isActive === "boolean" ? u.isActive : undefined,
      },
    };
  }

  if (record.id && record.email && record.name && record.role) {
    return {
      authenticated: true,
      user: {
        id: String(record.id),
        email: String(record.email),
        name: String(record.name),
        role: String(record.role),
        isActive: typeof record.isActive === "boolean" ? record.isActive : undefined,
      },
    };
  }

  return anonymousSession();
}

async function fetchJsonSafe(path: string, token: string) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function fetchBackendSessionFromToken(token: string): Promise<WebSession> {
  if (!token) {
    return anonymousSession();
  }

  const sessionPayload = await fetchJsonSafe("/auth/session", token);
  const session = normalizeUserLike(sessionPayload);
  if (session.authenticated) {
    return session;
  }

  const mePayload = await fetchJsonSafe("/auth/me", token);
  return normalizeUserLike(mePayload);
}

export async function callBackendLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({} as Record<string, unknown>));

  if (!response.ok) {
    throw new BackendHttpError(
      String((payload as Record<string, unknown>)?.message || "Falha no login"),
      response.status,
    );
  }

  const accessToken = String((payload as Record<string, unknown>)?.accessToken || "");
  if (!accessToken) {
    throw new Error("Backend não retornou accessToken");
  }

  const userPayload = (payload as Record<string, unknown>)?.user;
  const normalized = normalizeUserLike(userPayload);

  return {
    accessToken,
    user: normalized.user,
  };
}

export async function getServerWebSession(): Promise<WebSession> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get(WEB_ACCESS_COOKIE)?.value || "");
  return fetchBackendSessionFromToken(token);
}

export async function callBackendLogout(token: string) {
  if (!token) return;

  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  }).catch(() => undefined);
}
