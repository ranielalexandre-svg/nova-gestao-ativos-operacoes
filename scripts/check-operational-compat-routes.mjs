const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3010";

const routes = [
  ["/operacao/evidencias", "/operacao/relatorio-turno"],
  ["/operacao/evidencias/export", "/operacao/relatorio-turno/export"],
  ["/operacao/pos-incidente", "/operacao/war-room"],
  ["/operacao/pos-incidente/export", "/operacao/war-room/export"],
  ["/operacao/auditoria-operacional", "/operacao/atividade"],
  ["/operacao/auditoria-operacional/export", "/operacao/atividade"],
  ["/operacao/comunicacao-turno", "/operacao/handoff"],
  ["/operacao/comunicacao-turno/export", "/operacao/handoff/export"],
];

let failures = 0;

for (const [source, expectedTarget] of routes) {
  const url = new URL(source, WEB_BASE_URL);
  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";

  const okStatus = response.status === 307 || response.status === 308;
  const okLocation = location.includes(expectedTarget);

  const suffix = okStatus && okLocation ? "OK" : "FALHOU";
  console.log(`${source} -> ${response.status} ${location} ${suffix}`);

  if (!okStatus || !okLocation) {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`Compatibilidade de rotas falhou: ${failures} erro(s).`);
  process.exit(1);
}

console.log(`Compatibilidade de rotas operacionais OK: ${routes.length} redirects.`);
