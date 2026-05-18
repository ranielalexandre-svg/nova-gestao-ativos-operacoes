import { readFileSync } from "node:fs";

const page = readFileSync("apps/web/app/operacao/page.tsx", "utf8");
const watchlist = readFileSync("apps/web/components/unit-watchlist-panel.tsx", "utf8");

const checks = [
  {
    ok: page.includes("const nextActions = ["),
    message: "Cockpit deve ter nextActions para orientar proxima acao.",
  },
  {
    ok: page.includes("O que fazer agora"),
    message: "Painel lateral deve ser proxima acao, nao mini-menu.",
  },
  {
    ok: page.includes("limit={5}") && page.includes("onlyActionable"),
    message: "Watchlist da operacao deve ser limitada e acionavel.",
  },
  {
    ok: watchlist.includes("onlyActionable?: boolean") && watchlist.includes("isActionableWatchItem"),
    message: "UnitWatchlistPanel deve aceitar filtro acionavel.",
  },
  {
    ok: !page.includes("Workspaces da operação"),
    message: "Texto antigo de mini-menu nao deve voltar ao cockpit.",
  },
];

const failures = checks.filter((item) => !item.ok);

if (failures.length > 0) {
  console.error("Cockpit operacional ainda esta pouco focado:");
  for (const failure of failures) {
    console.error(` - ${failure.message}`);
  }
  process.exit(1);
}

console.log("Cockpit operacional focado: watchlist acionavel, proximas acoes e apoio compacto.");
