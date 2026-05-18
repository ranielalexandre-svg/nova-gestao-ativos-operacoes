import { existsSync, readFileSync } from "node:fs";

const forbidden = [
  "apps/web/app/equipamentos/cadastro/page.tsx",
  "apps/web/app/equipamentos/[id]/page.tsx",
  "apps/web/app/automacao/export/route.ts",
  "apps/web/app/administracao/sla/page.tsx",
  "apps/web/app/administracao/importacao/page.tsx",
  "apps/web/app/operacao/excecoes/nova/page.tsx",
  "apps/web/app/relatorios/monitoramento/templates/route.ts",
  "apps/web/app/relatorios/monitoramento/export-jobs/route.ts",
  "apps/web/app/relatorios/monitoramento/automacoes/route.ts",
  "apps/web/app/operacao/comunicacao-turno/page.tsx",
  "apps/web/app/operacao/auditoria-operacional/page.tsx",
  "apps/web/app/operacao/pos-incidente/page.tsx",
  "apps/web/app/operacao/evidencias/page.tsx",
  "apps/web/app/relatorios/monitoramento/export/route.ts",
];

const requiredScripts = [
  "scripts/check-operational-compat-routes.mjs",
  "scripts/check-canonical-route-aliases.mjs",
  "scripts/check-deep-canonical-route-aliases.mjs",
  "scripts/check-create-route-aliases.mjs",
  "scripts/check-no-shadowed-alias-pages.mjs",
  "scripts/check-canonical-route-owners.mjs",
  "scripts/check-operational-cockpit-focus.mjs",
  "scripts/check-technical-legacy-runtime.mjs",
  "scripts/audit-route-alias-ownership.mjs",
];

const nextConfig = readFileSync("apps/web/next.config.mjs", "utf8");

const requiredRedirects = [
  'source: "/equipamentos/cadastro"',
  'destination: "/ativos/cadastro"',
  'source: "/equipamentos/:assetId"',
  'destination: "/ativos/:assetId"',
  'source: "/automacao/export"',
  'destination: "/operacao/automacoes/export"',
  'source: "/operacao/evidencias"',
  'destination: "/operacao/relatorio-turno"',
];

let failures = 0;

for (const file of forbidden) {
  if (existsSync(file)) {
    console.error(`Arquivo legado proibido voltou: ${file}`);
    failures += 1;
  }
}

for (const file of requiredScripts) {
  if (!existsSync(file)) {
    console.error(`Verificador obrigatorio ausente: ${file}`);
    failures += 1;
  }
}

for (const snippet of requiredRedirects) {
  if (!nextConfig.includes(snippet)) {
    console.error(`Redirect obrigatorio ausente em next.config.mjs: ${snippet}`);
    failures += 1;
  }
}


const auditReport = JSON.parse(readFileSync("docs/auditoria-local/route-alias-ownership.json", "utf8"));

if ((auditReport.shadowed?.length ?? 0) > 0) {
  console.error(`Auditoria ainda encontrou ${auditReport.shadowed.length} sombra(s) removiveis.`);
  failures += 1;
}

if ((auditReport.sourceCandidates?.length ?? 0) > 0) {
  console.error(`Auditoria encontrou ${auditReport.sourceCandidates.length} rota(s) com implementacao propria sob redirect.`);
  failures += 1;
}

if (failures > 0) {
  process.exit(1);
}

console.log("Fechamento da poda OK: legados removidos, redirects preservados e verificadores presentes.");
