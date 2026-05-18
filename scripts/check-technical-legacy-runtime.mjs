const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3010";

const redirects = [
  ["/equipamentos/cadastro", "/ativos/cadastro"],
  ["/equipamentos/ativo-teste-123", "/ativos/ativo-teste-123"],
  ["/automacao/export", "/operacao/automacoes/export"],
];

const canonicalNo500 = [
  "/operacao/automacoes/export",
];

let failures = 0;

for (const [source, expectedTarget] of redirects) {
  const response = await fetch(new URL(source, WEB_BASE_URL), { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const okStatus = response.status === 307 || response.status === 308;
  const okLocation = location.includes(expectedTarget);
  const suffix = okStatus && okLocation ? "OK" : "FALHOU";

  console.log(`${source} -> ${response.status} ${location} ${suffix}`);

  if (!okStatus || !okLocation) failures += 1;
}

for (const route of canonicalNo500) {
  const response = await fetch(new URL(route, WEB_BASE_URL), { redirect: "manual" });
  const ok = response.status < 500;
  const suffix = ok ? "OK" : "FALHOU";

  console.log(`${route} -> ${response.status} ${suffix}`);

  if (!ok) failures += 1;
}

if (failures > 0) {
  console.error(`Runtime de legados tecnicos falhou: ${failures} erro(s).`);
  process.exit(1);
}

console.log("Runtime de legados tecnicos OK: redirects e canonicos sem 500.");
