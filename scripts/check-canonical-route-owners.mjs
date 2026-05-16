import { readFileSync } from "node:fs";

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

const legacyFiles = [
  {
    file: "apps/web/app/equipamentos/cadastro/page.tsx",
    required: "../../ativos/cadastro/page",
  },
  {
    file: "apps/web/app/equipamentos/[id]/page.tsx",
    required: "../../ativos/[id]/page",
  },
  {
    file: "apps/web/app/automacao/export/route.ts",
    required: "../../operacao/automacoes/export/route",
  },
];

let failures = 0;

for (const item of canonicalFiles) {
  const text = readFileSync(item.file, "utf8");
  if (text.includes(item.forbidden)) {
    console.error(`Rota canonica ainda depende de legado: ${item.file} -> ${item.forbidden}`);
    failures += 1;
  }
}

for (const item of legacyFiles) {
  const text = readFileSync(item.file, "utf8");
  if (!text.includes(item.required)) {
    console.error(`Legado nao reexporta a rota canonica esperada: ${item.file} -> ${item.required}`);
    failures += 1;
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("Donos canonicos OK: ativos/* e operacao/automacoes/export sao fontes reais.");
