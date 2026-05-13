#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function getBranch() {
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim() || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

function walk(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage", "generated"].includes(entry.name)) {
        continue;
      }

      walk(full, predicate, acc);
      continue;
    }

    if (predicate(full)) {
      acc.push(full.replaceAll("\\", "/"));
    }
  }

  return acc.sort();
}

function apiGroupFor(file) {
  const parts = file.split("/");
  return parts.length <= 4 ? "(root)" : parts[3] || "(root)";
}

function webGroupFor(file) {
  const relative = file.replace("apps/web/app/", "");
  const first = relative.split("/")[0];

  if (first === "api") return "api routes";
  if (first === "attachments") return "attachments";
  if (first === "export") return "export";
  if (["layout.tsx", "page.tsx"].includes(first)) return "(root)";

  return first;
}

function table(rows, headers, mapper) {
  const lines = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const row of rows) {
    lines.push(`| ${mapper(row).join(" | ")} |`);
  }

  return lines.join("\n");
}

const apiFiles = walk("apps/api/src", (file) =>
  /\.(module|controller|service)\.ts$/.test(file)
);

const apiSpecs = [
  ...walk("apps/api/src", (file) => /\.spec\.ts$/.test(file)),
  ...walk("apps/api/test", (file) => /\.e2e-spec\.ts$/.test(file)),
];

const webRoutes = walk("apps/web/app", (file) =>
  /(page\.tsx|layout\.tsx|route\.ts)$/.test(file)
);

const webComponents = walk("apps/web/components", (file) =>
  /\.(tsx|ts)$/.test(file)
);

const apiModules = new Map();

for (const file of apiFiles) {
  const moduleName = apiGroupFor(file);

  if (!apiModules.has(moduleName)) {
    apiModules.set(moduleName, {
      moduleName,
      modules: [],
      controllers: [],
      services: [],
      specs: [],
      status: "sem teste direto",
      priority: "baixa",
    });
  }

  const item = apiModules.get(moduleName);

  if (file.endsWith(".module.ts")) item.modules.push(file);
  if (file.endsWith(".controller.ts")) item.controllers.push(file);
  if (file.endsWith(".service.ts")) item.services.push(file);
}

for (const spec of apiSpecs) {
  const moduleName = spec.startsWith("apps/api/test/")
    ? "e2e"
    : apiGroupFor(spec);

  if (!apiModules.has(moduleName)) {
    apiModules.set(moduleName, {
      moduleName,
      modules: [],
      controllers: [],
      services: [],
      specs: [],
      status: "teste avulso",
      priority: "baixa",
    });
  }

  apiModules.get(moduleName).specs.push(spec);
}

for (const item of apiModules.values()) {
  const hasController = item.controllers.length > 0;
  const hasService = item.services.length > 0;
  const hasSpec = item.specs.length > 0;

  if (hasSpec) {
    item.status = "com teste";
    item.priority = "baixa";
  } else if (hasController && hasService) {
    item.status = "sem teste de controller/service";
    item.priority = "alta";
  } else if (hasService) {
    item.status = "sem teste de service";
    item.priority = "média";
  } else if (hasController) {
    item.status = "sem teste de controller";
    item.priority = "baixa";
  } else {
    item.status = "sem teste direto";
    item.priority = "baixa";
  }
}

const webGroups = new Map();

for (const file of webRoutes) {
  const group = webGroupFor(file);

  if (!webGroups.has(group)) {
    webGroups.set(group, {
      group,
      pages: [],
      routes: [],
      layouts: [],
      priority: "média",
    });
  }

  const item = webGroups.get(group);

  if (file.endsWith("page.tsx")) item.pages.push(file);
  if (file.endsWith("route.ts")) item.routes.push(file);
  if (file.endsWith("layout.tsx")) item.layouts.push(file);
}

for (const item of webGroups.values()) {
  const total = item.pages.length + item.routes.length + item.layouts.length;

  if (
    [
      "dashboard",
      "ativos",
      "contratos",
      "parceiros",
      "usuarios",
      "chamados",
      "excecoes",
      "unidades",
    ].includes(item.group)
  ) {
    item.priority = "alta";
  } else if (total >= 4) {
    item.priority = "média";
  } else {
    item.priority = "baixa";
  }
}

const apiModuleRows = [...apiModules.values()].sort((a, b) =>
  a.moduleName.localeCompare(b.moduleName)
);

const webRows = [...webGroups.values()].sort((a, b) =>
  a.group.localeCompare(b.group)
);

const highApi = apiModuleRows.filter((item) => item.priority === "alta");
const mediumApi = apiModuleRows.filter((item) => item.priority === "média");
const highWeb = webRows.filter((item) => item.priority === "alta");

let md = "";

md += "# Auditoria local de módulos\n\n";
md += "Branch: repositório local\n";
md += "Atualizado em: gerado por `corepack pnpm audit:modules`\n\n";

md += "## Resumo executivo\n\n";
md += `- Arquivos estruturais da API encontrados: ${apiFiles.length}\n`;
md += `- Testes API existentes: ${apiSpecs.length}\n`;
md += `- Grupos/módulos API mapeados: ${apiModuleRows.length}\n`;
md += `- Rotas Web mapeadas: ${webRoutes.length}\n`;
md += `- Componentes Web mapeados: ${webComponents.length}\n`;
md += `- Módulos API de prioridade alta sem teste direto: ${highApi.length}\n`;
md += `- Grupos Web de prioridade alta: ${highWeb.length}\n\n`;

md += "## Prioridades recomendadas\n\n";

md += "### API - prioridade alta\n\n";
md += highApi.length
  ? highApi.map((item) => `- ${item.moduleName}: ${item.status}`).join("\n")
  : "- Nenhuma prioridade alta sem teste direto encontrada.";
md += "\n\n";

md += "### API - prioridade média\n\n";
md += mediumApi.length
  ? mediumApi.map((item) => `- ${item.moduleName}: ${item.status}`).join("\n")
  : "- Nenhuma prioridade média sem teste direto encontrada.";
md += "\n\n";

md += "### Web - prioridade alta\n\n";
md += highWeb.length
  ? highWeb
      .map(
        (item) =>
          `- ${item.group}: ${item.pages.length} page(s), ${item.routes.length} route handler(s)`
      )
      .join("\n")
  : "- Nenhuma prioridade alta encontrada.";
md += "\n\n";

md += "## Matriz API\n\n";
md += table(
  apiModuleRows,
  ["Módulo", "Controllers", "Services", "Specs", "Status", "Prioridade"],
  (item) => [
    item.moduleName,
    String(item.controllers.length),
    String(item.services.length),
    String(item.specs.length),
    item.status,
    item.priority,
  ]
);
md += "\n\n";

md += "## Matriz Web\n\n";
md += table(
  webRows,
  ["Grupo", "Pages", "Route handlers", "Layouts", "Prioridade"],
  (item) => [
    item.group,
    String(item.pages.length),
    String(item.routes.length),
    String(item.layouts.length),
    item.priority,
  ]
);
md += "\n\n";

md += "## API - arquivos mapeados\n\n";
for (const item of apiModuleRows) {
  md += `### ${item.moduleName}\n\n`;

  for (const file of [
    ...item.modules,
    ...item.controllers,
    ...item.services,
    ...item.specs,
  ]) {
    md += `- ${file}\n`;
  }

  md += "\n";
}

md += "## Web - rotas mapeadas\n\n";
for (const item of webRows) {
  md += `### ${item.group}\n\n`;

  for (const file of [...item.layouts, ...item.pages, ...item.routes]) {
    md += `- ${file}\n`;
  }

  md += "\n";
}

md += "## Web - componentes mapeados\n\n";
for (const file of webComponents) {
  md += `- ${file}\n`;
}

fs.writeFileSync("docs/auditoria-local/revisao-modulos.md", md);
