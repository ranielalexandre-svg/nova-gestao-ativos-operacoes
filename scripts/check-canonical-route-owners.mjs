import { existsSync, readFileSync } from "node:fs";

const canonicalFiles = [
  {
    file: "apps/web/app/ativos/cadastro/page.tsx",
    forbidden: "../../equipamentos/cadastro/page",
  },
  {
    file: "apps/web/app/ativos/[id]/page.tsx",
    forbidden: "../../equipamentos/[id]/page",
  },
  {
    file: "apps/web/app/operacao/automacoes/export/route.ts",
    forbidden: "../../../automacao/export/route",
  },
];

const removedLegacyFiles = [
  "apps/web/app/equipamentos/cadastro/page.tsx",
  "apps/web/app/equipamentos/[id]/page.tsx",
  "apps/web/app/automacao/export/route.ts",
];

let failures = 0;

for (const item of canonicalFiles) {
  const text = readFileSync(item.file, "utf8");
  if (text.includes(item.forbidden)) {
    console.error(`Rota canonica ainda depende de legado: ${item.file} -> ${item.forbidden}`);
    failures += 1;
  }
}

for (const file of removedLegacyFiles) {
  if (existsSync(file)) {
    console.error(`Legado tecnico ainda existe e deve ficar apenas no next.config.mjs: ${file}`);
    failures += 1;
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("Donos canonicos OK: ativos/* e operacao/automacoes/export sao fontes reais; legados tecnicos foram removidos.");
