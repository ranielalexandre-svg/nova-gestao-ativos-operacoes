#!/usr/bin/env node

const WEB_BASE_URL = process.env.WEB_BASE_URL || "http://127.0.0.1:3010";
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000";
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_ROUTE_TIMEOUT_MS || 30000);
const HEARTBEAT_MS = Number(process.env.SMOKE_HEARTBEAT_MS || 5000);

const cadastroRoutes = [
  "/alertas/cadastro",
  "/ativos/cadastro",
  "/chamados/cadastro",
  "/contratos/cadastro",
  "/equipamentos/cadastro",
  "/excecoes/cadastro",
  "/manutencoes/cadastro",
  "/ocorrencias/cadastro",
  "/parceiros/cadastro",
  "/unidades/cadastro",
  "/usuarios/cadastro",
];

const legacyCadastroRedirects = [
  ["/alertas/novo", "/alertas/cadastro"],
  ["/ativos/nova", "/ativos/cadastro"],
  ["/chamados/novo", "/chamados/cadastro"],
  ["/contratos/novo", "/contratos/cadastro"],
  ["/equipamentos/nova", "/equipamentos/cadastro"],
  ["/excecoes/nova", "/operacao/excecoes/cadastro"],
  ["/manutencoes/nova", "/manutencoes/cadastro"],
  ["/ocorrencias/nova", "/ocorrencias/cadastro"],
  ["/parceiros/nova", "/parceiros/cadastro"],
  ["/unidades/nova", "/unidades/cadastro"],
  ["/usuarios/nova", "/usuarios/cadastro"],
];

const webRoutes = [
  "/",
  "/login",
  "/dashboard",

  "/alertas",
  "/ativos",
  "/ativos/starlinks",
  "/equipamentos",
  "/equipamentos/starlinks",
  "/parceiros",
  "/contratos",
  "/usuarios",
  "/chamados",
  "/excecoes",
  "/unidades",

  ...cadastroRoutes,

  "/operacao",
  "/operacao/pendencias",
  "/operacao/handoff",
  "/operacao/war-room",
  "/operacao/atividade",
  "/operacao/fila",
  "/operacao/excecoes",
  "/operacao/sla",
  "/operacao/automacoes",
  "/operacao/importacao",
  "/operacao/reconciliacao",

  "/monitoramento",
  "/monitoramento/fontes",
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

const heavyWebRoutes = [
  "/monitoramento/mapas",
];

if (process.env.SMOKE_INCLUDE_HEAVY === "1") {
  webRoutes.push(...heavyWebRoutes);
}

const redirectTargets = ["/login", "/dashboard", "/", ...webRoutes];

function elapsedMs(startedAt) {
  return `${Date.now() - startedAt}ms`;
}

function stepLabel(kind, index, total, route) {
  return `${kind} [${String(index).padStart(2, "0")}/${String(total).padStart(2, "0")}] ${route.padEnd(38)}`;
}

async function request(url, init = {}) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const label = init.label || url;

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const heartbeat = setInterval(() => {
    console.log(`... ainda aguardando ${label} (${elapsedMs(startedAt)})`);
  }, HEARTBEAT_MS);

  try {
    return await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "nova-smoke-routes/3.0",
        ...(init.headers || {}),
      },
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms for ${label}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
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

async function checkWebRoute(route, index, total) {
  const label = stepLabel("WEB", index, total, route);
  const url = new URL(route, WEB_BASE_URL).toString();
  const startedAt = Date.now();

  console.log(`${label} ... iniciando`);
  const response = await request(url, { label });
  const location = response.headers.get("location");

  if (!isExpectedWebStatus(response)) {
    throw new Error(
      `Unexpected WEB response for ${route}: status=${response.status} location=${location ?? "-"}`
    );
  }

  console.log(`${label} -> ${response.status}${location ? ` ${location}` : ""} (${elapsedMs(startedAt)})`);
}

async function checkLegacyCadastroRedirect(route, expectedTarget, index, total) {
  const label = stepLabel("LEGACY", index, total, route);
  const url = new URL(route, WEB_BASE_URL).toString();
  const startedAt = Date.now();

  console.log(`${label} ... iniciando`);
  const response = await request(url, { label });
  const location = response.headers.get("location");
  const path = redirectPath(location);

  if (![302, 303, 307, 308].includes(response.status) || path !== expectedTarget) {
    throw new Error(
      `Unexpected legacy cadastro redirect for ${route}: status=${response.status} location=${location ?? "-"} expected=${expectedTarget}`
    );
  }

  console.log(`${label} -> ${response.status} ${location} legacy=${expectedTarget} (${elapsedMs(startedAt)})`);
}

async function checkApiEndpoint(label, path, expectedStatuses, index, total) {
  const step = stepLabel("API", index, total, label);
  const url = new URL(path, API_BASE_URL).toString();
  const startedAt = Date.now();

  console.log(`${step} ... iniciando`);
  const response = await request(url, { label: step });

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Unexpected API response for ${path}: status=${response.status}; expected=${expectedStatuses.join(",")}`
    );
  }

  console.log(`${step} -> ${response.status} (${elapsedMs(startedAt)})`);
}

async function main() {
  console.log(`WEB_BASE_URL=${WEB_BASE_URL}`);
  console.log(`API_BASE_URL=${API_BASE_URL}`);
  console.log(`SMOKE_ROUTE_TIMEOUT_MS=${REQUEST_TIMEOUT_MS}`);
  console.log(`SMOKE_HEARTBEAT_MS=${HEARTBEAT_MS}`);
  console.log(`SMOKE_INCLUDE_HEAVY=${process.env.SMOKE_INCLUDE_HEAVY === "1" ? "1" : "0"}`);

  for (const [index, route] of webRoutes.entries()) {
    await checkWebRoute(route, index + 1, webRoutes.length);
  }

  for (const [index, [route, expectedTarget]] of legacyCadastroRedirects.entries()) {
    await checkLegacyCadastroRedirect(route, expectedTarget, index + 1, legacyCadastroRedirects.length);
  }

  await checkApiEndpoint("/health", "/health", [200], 1, 2);
  await checkApiEndpoint("/auth/session", "/auth/session", [200, 401], 2, 2);

  console.log(
    `Smoke routes passed. web=${webRoutes.length} legacy=${legacyCadastroRedirects.length} api=2`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
