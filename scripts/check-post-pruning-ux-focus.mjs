import { existsSync, readFileSync } from "node:fs";

const report = readFileSync("apps/web/app/operacao/relatorio-turno/page.tsx", "utf8");
const automations = readFileSync("apps/web/app/operacao/automacoes/page.tsx", "utf8");
const sensors = readFileSync("apps/web/components/sensores/nova-sensores-view.tsx", "utf8");

const cssPath = [
  "apps/web/app/globals.css",
  "apps/web/styles/globals.css",
].find((file) => existsSync(file));

const css = cssPath ? readFileSync(cssPath, "utf8") : "";

const hasSelfLink =
  report.includes('href="/operacao/relatorio-turno"') &&
  report.includes("Relatório do turno");

const checks = [
  {
    ok: report.includes("Fechamento do turno operacional"),
    message: "Relatorio do turno deve ter titulo mais curto e operacional.",
  },
  {
    ok: !report.includes("Relatório executivo do turno e pós-incidente"),
    message: "Titulo longo antigo do relatorio nao deve voltar.",
  },
  {
    ok: !hasSelfLink,
    message: "Topo do relatorio nao deve ter botao para a propria pagina.",
  },
  {
    ok: automations.includes("runs.slice(0, 5)") && automations.includes("Math.max(0, 6 - runEntries.length)"),
    message: "Automacoes deve limitar eventos recentes para reduzir ruido visual.",
  },
  {
    ok: sensors.includes("Unidades NOC por vínculo e saúde"),
    message: "Sensores deve enfatizar vinculo e saude, nao tabela bruta.",
  },
  {
    ok: css.includes("PR60 - ajuste fino visual pós-poda"),
    message: "CSS de densidade visual pos-poda deve existir.",
  },
  {
    ok: report.includes("nova-turno-collapsible"),
    message: "Relatorio deve manter rastro e dados usados como apoio compacto.",
  },
  {
    ok: sensors.includes("bindingMode"),
    message: "Sensores deve manter leitura de pendencias de vinculo quando nao houver hosts.",
  },
];

const failures = checks.filter((check) => !check.ok);

if (failures.length > 0) {
  console.error("Ajuste visual pos-poda incompleto:");
  for (const failure of failures) {
    console.error(` - ${failure.message}`);
  }
  process.exit(1);
}

console.log("UX pos-poda OK: relatorio compacto, automacoes menos ruidosa e sensores com leitura NOC mais clara.");
