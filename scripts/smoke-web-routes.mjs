#!/usr/bin/env node

const WEB_BASE_URL = process.env.WEB_BASE_URL || "http://127.0.0.1:3010";
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000";

const webRoutes = [
  "/",
  "/login",
  "/dashboard",
  "/alertas",
  "/ativos",
  "/ativos/starlinks",
  "/parceiros",
  "/contratos",
  "/usuarios",
  "/chamados",
  "/excecoes",
  "/unidades",
];

const expectedRedirectTargets = ["/login", "/dashboard"];

async function request(url) {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": "nova-smoke-routes/1.0",
    },
  });
}

function isExpectedWebStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return true;
  }

  if ([302, 307, 308].includes(response.status)) {
    const location = response.headers.get("location") || "";
    return expectedRedirectTargets.some((target) => location.startsWith(target));
  }

  return false;
}

async function checkWebRoute(route) {
  const url = new URL(route, WEB_BASE_URL).toString();
  const response = await request(url);

  if (!isExpectedWebStatus(response)) {
    const location = response.headers.get("location");
    throw new Error(
      `Unexpected WEB response for ${route}: status=${response.status} location=${location ?? "-"}`
    );
  }

  const location = response.headers.get("location");
  console.log(
    `WEB ${route.padEnd(18)} -> ${response.status}${location ? ` ${location}` : ""}`
  );
}

async function checkApiSession() {
  const url = new URL("/auth/session", API_BASE_URL).toString();
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": "nova-smoke-routes/1.0",
    },
  });

  if (![200, 401].includes(response.status)) {
    throw new Error(`Unexpected API /auth/session status=${response.status}`);
  }

  console.log(`API /auth/session     -> ${response.status}`);
}

async function main() {
  console.log(`WEB_BASE_URL=${WEB_BASE_URL}`);
  console.log(`API_BASE_URL=${API_BASE_URL}`);

  for (const route of webRoutes) {
    await checkWebRoute(route);
  }

  await checkApiSession();

  console.log("Smoke routes passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
