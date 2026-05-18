import { existsSync, readFileSync } from "node:fs";

const page = readFileSync("apps/web/app/operacao/automacoes/page.tsx", "utf8");

const cssPath = [
  "apps/web/app/globals.css",
  "apps/web/styles/globals.css",
].find((file) => existsSync(file));

const css = cssPath ? readFileSync(cssPath, "utf8") : "";

const checks = [
  {
    ok: page.includes("Histórico resumido"),
    message: "Automacoes deve nomear o historico como resumo, nao como tabela longa principal.",
  },
  {
    ok: page.includes("runs.slice(0, 4).map"),
    message: "Historico de automacoes deve limitar a 4 execucoes visiveis.",
  },
  {
    ok: !page.includes("runs.slice(0, 8).map"),
    message: "Historico antigo com 8 execucoes nao deve voltar.",
  },
  {
    ok: page.includes("Últimas 4 execuções; exporte para auditoria completa."),
    message: "Historico deve orientar exportacao para auditoria completa.",
  },
  {
    ok: css.includes("PR63 - histórico compacto de automações"),
    message: "CSS do historico compacto deve existir.",
  },
];

const failures = checks.filter((check) => !check.ok);

if (failures.length > 0) {
  console.error("PR63 incompleto:");
  for (const failure of failures) {
    console.error(` - ${failure.message}`);
  }
  process.exit(1);
}

console.log("PR63 OK: historico de automacoes compacto e menos ruidoso.");
