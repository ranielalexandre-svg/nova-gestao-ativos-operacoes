#!/usr/bin/env node

const WEB_BASE_URL = process.env.WEB_BASE_URL || "http://127.0.0.1:3010";
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000";

const webRoutes = [
  "/",
  "/login",
  "/dashboard",

  "/alertas",
  "/alertas/novo",
  "/ativos",
  "/ativos/starlinks",
  "/equipamentos",
  "/equipamentos/starlinks",
  "/parceiros",
  "/contratos",
  "/usuarios",
  "/chamados",
  "/excecoes",
  "/excecoes/nova",
  "/unidades",

  "/operacao",
  "/operacao/atividade",
  "/operacao/fila",
  "/operacao/excecoes",
  "/operacao/sla",
  "/operacao/automacoes",
  "/operacao/importacao",

  "/monitoramento",
  "/monitoramento/fontes",
  "/monitoramento/mapas",
  "/monitoramento/sensores",

  "/relatorios",
  "/relatorios/monitoramento",

  "/integracoes",
  "/automacao",

  "/administracao/automacoes",
  "/administracao/sla",
  "/administracao/importacao",
  "/administracao/reconciliacao",

  "/configuracoes",
  "/importacao",
  "/reconciliacao",
  "/reconciliacao-central",
];

const redirectTargets = ["/login", "/dashboard", "/", ...webRoutes];

async function request(url, init = {}) {
  return fetch(url, {
    redirect: "manual",
    headers: {
      "User-Agent": "nova-smoke-routes/2.0",
      ...(init.headers || {}),
    },
    ...init,
  });
}

function redirectPath(location) {
  if (!location) return "";
  try {
    return new URL(location, WEB_BASE_URL).pathname;
  } catch {
    return location;
  }
}

function isExpectedWebStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return true;
  }

  if ([302, 303, 307, 308].includes(response.status)) {
    const path = redirectPath(response.headers.get("location"));
    return redirectTargets.some((target) => path === target || path.startsWith(`${target}/`));
  }

  return false;
}

async function checkWebRoute(route) {
  const url = new URL(route, WEB_BASE_URL).toString();
  const response = await request(url);
  const location = response.headers.get("location");

  if (!isExpectedWebStatus(response)) {
    throw new Error(
      `Unexpected WEB response for ${route}: status=${response.status} location=${location ?? "-"}`
    );
  }

  console.log(
    `WEB ${route.padEnd(38)} -> ${response.status}${location ? ` ${location}` : ""}`
  );
}

async function checkApiEndpoint(label, path, expectedStatuses) {
  const url = new URL(path, API_BASE_URL).toString();
  const response = await request(url);

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Unexpected API response for ${path}: status=${response.status}; expected=${expectedStatuses.join(",")}`
    );
  }

  console.log(`API ${label.padEnd(36)} -> ${response.status}`);
}

async function main() {
  console.log(`WEB_BASE_URL=${WEB_BASE_URL}`);
  console.log(`API_BASE_URL=${API_BASE_URL}`);

  for (const route of webRoutes) {
    await checkWebRoute(route);
  }

  await checkApiEndpoint("/health", "/health", [200]);
  await checkApiEndpoint("/auth/session", "/auth/session", [200, 401]);

  console.log(`Smoke routes passed. web=${webRoutes.length} api=2`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
