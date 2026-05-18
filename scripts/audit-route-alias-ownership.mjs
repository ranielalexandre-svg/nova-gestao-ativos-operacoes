import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const nextConfig = readFileSync("apps/web/next.config.mjs", "utf8");

function routeToAppFile(route) {
  const clean = route.replace(/^\/+/, "");
  const candidates = [
    `apps/web/app/${clean}/page.tsx`,
    `apps/web/app/${clean}/route.ts`,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function extractRedirects(configText) {
  const redirects = [];
  const blocks = [...configText.matchAll(/source:\s*"([^"]+)"[\s\S]*?destination:\s*"([^"]+)"/g)];

  for (const match of blocks) {
    redirects.push({
      source: match[1],
      destination: match[2],
      file: routeToAppFile(match[1]),
    });
  }

  return redirects;
}

function classifyFile(file) {
  if (!file || !existsSync(file)) {
    return {
      exists: false,
      type: "redirect-only",
      lines: 0,
      reason: "sem arquivo no App Router; compatibilidade vive no next.config.mjs",
    };
  }

  const text = readFileSync(file, "utf8");
  const lines = text.splitlines?.() ?? text.split(/\r?\n/);
  const trimmed = text.trim();

  const isTiny = lines.length <= 80;
  const isRedirect =
    trimmed.includes("redirect(") ||
    trimmed.includes("NextResponse.redirect");

  const isReexport =
    /^export\s+\{[\s\S]*\}\s+from\s+["'][^"']+["'];?\s*$/m.test(trimmed) ||
    /^export\s+\{\s*default\s*\}\s+from\s+["'][^"']+["'];?\s*$/m.test(trimmed);

  const hasOwnUi =
    trimmed.includes("return (") ||
    trimmed.includes("<Nova") ||
    trimmed.includes("<main") ||
    trimmed.includes("apiJson") ||
    trimmed.includes("fetch(");

  if (isRedirect && isTiny) {
    return {
      exists: true,
      type: "shadowed-simple-redirect",
      lines: lines.length,
      reason: "arquivo parece redirect simples e tambem existe no next.config.mjs",
    };
  }

  if (isReexport && isTiny) {
    return {
      exists: true,
      type: "shadowed-reexport",
      lines: lines.length,
      reason: "arquivo parece re-export simples e tambem existe no next.config.mjs",
    };
  }

  if (hasOwnUi) {
    return {
      exists: true,
      type: "source-candidate",
      lines: lines.length,
      reason: "arquivo tem implementacao propria; nao remover sem inverter dono tecnico",
    };
  }

  return {
    exists: true,
    type: "manual-review",
    lines: lines.length,
    reason: "arquivo existe, mas nao caiu em regra segura",
  };
}

const redirects = extractRedirects(nextConfig);

const audited = redirects.map((item) => ({
  ...item,
  classification: classifyFile(item.file),
}));

const shadowed = audited.filter((item) =>
  ["shadowed-simple-redirect", "shadowed-reexport"].includes(item.classification.type),
);

const sourceCandidates = audited.filter((item) => item.classification.type === "source-candidate");

const outPath = "docs/auditoria-local/route-alias-ownership.json";
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), audited, shadowed, sourceCandidates }, null, 2));

console.log(`Auditoria de aliases: ${audited.length} redirects mapeados.`);
console.log(`Arquivos sombra candidatos a remocao segura: ${shadowed.length}.`);
console.log(`Rotas com implementacao propria sob redirect: ${sourceCandidates.length}.`);
console.log(`Relatorio: ${outPath}`);

if (sourceCandidates.length > 0) {
  console.log("");
  console.log("Implementacoes proprias sob redirect:");
  for (const item of sourceCandidates) {
    console.log(` - ${item.source} -> ${item.destination} | ${item.file} | ${item.classification.lines} linhas`);
  }
}

if (shadowed.length > 0) {
  console.log("");
  console.log("Sombras simples candidatas a PR de remocao:");
  for (const item of shadowed) {
    console.log(` - ${item.source} -> ${item.destination} | ${item.file} | ${item.classification.type}`);
  }
}
