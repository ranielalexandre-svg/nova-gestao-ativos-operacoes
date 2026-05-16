const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3010";

const aliases = [
  ["/relatorios/consumo", "/operacao/relatorios/consumo"],
  ["/relatorios/disponibilidade", "/operacao/relatorios/disponibilidade"],
  ["/relatorios/performance", "/operacao/relatorios/performance"],
  ["/relatorios/monitoramento/automacoes", "/operacao/relatorios/monitoramento/automacoes"],
  ["/relatorios/monitoramento/export", "/operacao/relatorios/monitoramento/export"],
  ["/relatorios/monitoramento/export-jobs", "/operacao/relatorios/monitoramento/export-jobs"],
  ["/relatorios/monitoramento/templates", "/operacao/relatorios/monitoramento/templates"],
  ["/automacao/export", "/operacao/automacoes/export"],
  ["/equipamentos/cadastro", "/ativos/cadastro"],
  ["/equipamentos/nova", "/equipamentos/cadastro"],
  ["/equipamentos/ativo-teste-123", "/ativos/ativo-teste-123"],
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
  console.error(`Aliases profundos falharam: ${failures} erro(s).`);
  process.exit(1);
}

console.log(`Aliases profundos OK: ${aliases.length} redirects.`);
