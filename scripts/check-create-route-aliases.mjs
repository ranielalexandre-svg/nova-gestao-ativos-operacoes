const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3010";

const aliases = [
  ["/alertas/novo", "/alertas/cadastro"],
  ["/ativos/nova", "/ativos/cadastro"],
  ["/chamados/novo", "/chamados/cadastro"],
  ["/contratos/novo", "/contratos/cadastro"],
  ["/equipamentos/nova", "/equipamentos/cadastro"],
  ["/excecoes/nova", "/operacao/excecoes/cadastro"],
  ["/operacao/excecoes/nova", "/operacao/excecoes/cadastro"],
  ["/manutencoes/nova", "/manutencoes/cadastro"],
  ["/ocorrencias/nova", "/ocorrencias/cadastro"],
  ["/parceiros/nova", "/parceiros/cadastro"],
  ["/unidades/nova", "/unidades/cadastro"],
  ["/usuarios/nova", "/usuarios/cadastro"],
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
  console.error(`Aliases de criacao falharam: ${failures} erro(s).`);
  process.exit(1);
}

console.log(`Aliases de criacao OK: ${aliases.length} redirects.`);
