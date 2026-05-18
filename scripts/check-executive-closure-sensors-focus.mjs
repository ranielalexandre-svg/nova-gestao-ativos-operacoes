import { existsSync, readFileSync } from "node:fs";

const report = readFileSync("apps/web/app/operacao/relatorio-turno/page.tsx", "utf8");
const sensors = readFileSync("apps/web/components/sensores/nova-sensores-view.tsx", "utf8");

const cssPath = [
  "apps/web/app/globals.css",
  "apps/web/styles/globals.css",
].find((file) => existsSync(file));

const css = cssPath ? readFileSync(cssPath, "utf8") : "";

const checks = [
  {
    ok: report.includes("nova-turno-collapsible"),
    message: "Relatorio do turno deve colapsar rastro e dados usados na lateral.",
  },
  {
    ok: !report.includes("rows={11}"),
    message: "Descricao do fechamento nao deve voltar a dominar a lateral.",
  },
  {
    ok: report.includes("Rastro resumido") && report.includes("Atualizações"),
    message: "Relatorio deve manter rastro e atualizacoes como apoio compacto.",
  },
  {
    ok: sensors.includes("bindingMode"),
    message: "Sensores deve ter modo de pendencias de vinculo.",
  },
  {
    ok: sensors.includes("Pendências de vínculo por unidade"),
    message: "Sensores deve narrar pendencias de vinculo quando nao houver hosts.",
  },
  {
    ok: sensors.includes("Vínculo pendente") && sensors.includes("aguardando correlação de host"),
    message: "Painel de cobertura deve virar chamada de vinculo pendente.",
  },
  {
    ok: css.includes("PR61 - fechamento executivo e sensores sem vínculo"),
    message: "CSS do ajuste executivo PR61 deve existir.",
  },
];

const failures = checks.filter((check) => !check.ok);

if (failures.length > 0) {
  console.error("PR61 incompleto:");
  for (const failure of failures) {
    console.error(` - ${failure.message}`);
  }
  process.exit(1);
}

console.log("PR61 OK: fechamento executivo compacto e sensores orientados a vínculo.");
