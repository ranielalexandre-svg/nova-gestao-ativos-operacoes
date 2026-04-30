import { NextResponse } from "next/server";
import {
  callBackendLogin,
  callBackendLogout,
  BackendHttpError,
  fetchBackendSessionFromToken,
  WEB_ACCESS_COOKIE,
  type WebSession,
} from "@/lib/web-session";

export const dynamic = "force-dynamic";

function shouldUseSecureCookie(request: Request) {
  const forced = process.env.WEB_SESSION_COOKIE_SECURE;
  if (forced === "true") return true;
  if (forced === "false") return false;

  const proto = request.headers.get("x-forwarded-proto") || "";
  if (proto.toLowerCase().includes("https")) return true;

  const origin = request.headers.get("origin") || "";
  if (origin.startsWith("https://")) return true;

  const referer = request.headers.get("referer") || "";
  if (referer.startsWith("https://")) return true;

  return false;
}

function buildCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

function readAccessTokenFromCookieHeader(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const parts = cookieHeader ? cookieHeader.split(/;\s*/) : [];
  const item = parts.find((part) => part.startsWith(`${WEB_ACCESS_COOKIE}=`));
  return item ? decodeURIComponent(item.split("=").slice(1).join("=")) : "";
}

function isJsonRequest(request: Request) {
  return (request.headers.get("content-type") || "")
    .toLowerCase()
    .includes("application/json");
}

function safeRedirectUrl(request: Request, value: string) {
  const base = new URL(request.url);
  const fallback = new URL("/dashboard", base);

  if (!value) return fallback;

  try {
    const url = new URL(value, base);
    if (url.origin !== base.origin) return fallback;
    return url;
  } catch {
    return fallback;
  }
}

function loginErrorUrl(request: Request, message: string, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  if (next) url.searchParams.set("next", next);
  return url;
}

function authErrorMessage(error: unknown) {
  if (error instanceof BackendHttpError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : "";

  if (
    message.toLowerCase().includes("fetch failed") ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("econnrefused")
  ) {
    return "API indisponível. Aguarde alguns segundos e tente novamente.";
  }

  return message || "Falha ao criar sessão web";
}

export async function GET(request: Request) {
  try {
    const token = readAccessTokenFromCookieHeader(request);
    const session = await fetchBackendSessionFromToken(token);

    return NextResponse.json(session, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, user: null },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function POST(request: Request) {
  const jsonRequest = isJsonRequest(request);
  let next = new URL(request.url).searchParams.get("next") || "";

  try {
    let body: {
      accessToken?: string;
      email?: string;
      password?: string;
      next?: string;
    };

    if (jsonRequest) {
      body = (await request.json().catch(() => ({}))) as typeof body;
    } else {
      const formData = await request.formData();
      body = {
        accessToken: String(formData.get("accessToken") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        next: String(formData.get("next") || ""),
      };
    }

    next = String(body.next || next || "/dashboard");

    let accessToken = String(body.accessToken || "");
    let sessionFromLogin: WebSession | null = null;

    if (!accessToken) {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");

      if (!email || !password) {
        if (!jsonRequest) {
          return NextResponse.redirect(
            loginErrorUrl(request, "Credenciais ausentes", next),
            303,
          );
        }

        return NextResponse.json(
          { authenticated: false, message: "Credenciais ausentes" },
          { status: 400 },
        );
      }

      const login = await callBackendLogin(email, password);
      accessToken = login.accessToken;
      sessionFromLogin = login.user ? { authenticated: true, user: login.user } : null;
    }

    const session = sessionFromLogin || await fetchBackendSessionFromToken(accessToken);

    if (!session.authenticated || !session.user) {
      const denied = jsonRequest
        ? NextResponse.json(
            { authenticated: false, message: "sessão inválida" },
            { status: 401 },
          )
        : NextResponse.redirect(loginErrorUrl(request, "Sessão inválida", next), 303);
      denied.cookies.set(WEB_ACCESS_COOKIE, "", {
        ...buildCookieOptions(request),
        maxAge: 0,
      });
      return denied;
    }

    const response = jsonRequest
      ? NextResponse.json(session)
      : NextResponse.redirect(safeRedirectUrl(request, next), 303);
    response.cookies.set(
      WEB_ACCESS_COOKIE,
      encodeURIComponent(accessToken),
      buildCookieOptions(request),
    );
    return response;
  } catch (error) {
    const message = authErrorMessage(error);
    const status = error instanceof BackendHttpError ? error.status : 500;

    if (!jsonRequest) {
      return NextResponse.redirect(loginErrorUrl(request, message, next), 303);
    }

    return NextResponse.json(
      {
        authenticated: false,
        message,
      },
      { status },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const token = readAccessTokenFromCookieHeader(request);
    await callBackendLogout(token);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(WEB_ACCESS_COOKIE, "", {
      ...buildCookieOptions(request),
      maxAge: 0,
    });
    return response;
  } catch {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(WEB_ACCESS_COOKIE, "", {
      ...buildCookieOptions(request),
      maxAge: 0,
    });
    return response;
  }
}
