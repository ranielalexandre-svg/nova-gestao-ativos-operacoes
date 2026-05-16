const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3010";

const aliases = [
  ["/relatorios", "/operacao/relatorios"],
  ["/relatorios/monitoramento", "/operacao/relatorios/monitoramento"],
  ["/integracoes", "/monitoramento/fontes"],
  ["/automacao", "/operacao/automacoes"],
  ["/administracao/automacoes", "/operacao/automacoes"],
  ["/administracao/sla", "/operacao/sla"],
  ["/administracao/importacao", "/operacao/importacao"],
  ["/administracao/reconciliacao", "/operacao/reconciliacao"],
  ["/importacao", "/operacao/importacao"],
  ["/reconciliacao", "/operacao/reconciliacao"],
  ["/reconciliacao-central", "/operacao/reconciliacao"],
  ["/sensores", "/monitoramento/sensores"],
  ["/equipamentos", "/ativos"],
  ["/equipamentos/starlinks", "/ativos/starlinks"],
];

let failures = 0;

for (const [source, expectedTarget] of aliases) {
  const response = await fetch(new URL(source, WEB_BASE_URL), { redirect: "manual" });
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
  console.error(`Aliases canonicos falharam: ${failures} erro(s).`);
  process.exit(1);
}

console.log(`Aliases canonicos OK: ${aliases.length} redirects.`);
