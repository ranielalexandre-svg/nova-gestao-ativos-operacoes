import { existsSync } from "node:fs";

const forbiddenFiles = [
  "apps/web/app/administracao/sla/page.tsx",
  "apps/web/app/administracao/importacao/page.tsx",
  "apps/web/app/relatorios/monitoramento/automacoes/page.tsx",
  "apps/web/app/relatorios/monitoramento/export/route.ts",
  "apps/web/app/relatorios/monitoramento/export-jobs/page.tsx",
  "apps/web/app/relatorios/monitoramento/templates/page.tsx",
  "apps/web/app/operacao/excecoes/nova/page.tsx",
  "apps/web/app/automacao/export/route.ts",
  "apps/web/app/equipamentos/[id]/page.tsx",
  "apps/web/app/equipamentos/cadastro/page.tsx",
];

const leftovers = forbiddenFiles.filter((file) => existsSync(file));

if (leftovers.length > 0) {
  console.error("Arquivos de alias eclipsados ainda existem:");
  for (const file of leftovers) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}

console.log(`Rotas alias e legados tecnicos removidos: ${forbiddenFiles.length} arquivos ausentes.`);
