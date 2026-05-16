const operationalNarrativeRedirects = [
  {
    source: "/operacao/evidencias",
    destination: "/operacao/relatorio-turno",
    permanent: false,
  },
  {
    source: "/operacao/pos-incidente",
    destination: "/operacao/war-room",
    permanent: false,
  },
  {
    source: "/operacao/auditoria-operacional",
    destination: "/operacao/atividade",
    permanent: false,
  },
  {
    source: "/operacao/comunicacao-turno",
    destination: "/operacao/handoff",
    permanent: false,
  },
];

const legacyAliasRedirects = [
  {
    source: "/relatorios",
    destination: "/operacao/relatorios",
    permanent: false,
  },
  {
    source: "/relatorios/monitoramento",
    destination: "/operacao/relatorios/monitoramento",
    permanent: false,
  },
  {
    source: "/integracoes",
    destination: "/monitoramento/fontes",
    permanent: false,
  },
  {
    source: "/automacao",
    destination: "/operacao/automacoes",
    permanent: false,
  },
  {
    source: "/administracao/automacoes",
    destination: "/operacao/automacoes",
    permanent: false,
  },
  {
    source: "/administracao/sla",
    destination: "/operacao/sla",
    permanent: false,
  },
  {
    source: "/administracao/importacao",
    destination: "/operacao/importacao",
    permanent: false,
  },
  {
    source: "/administracao/reconciliacao",
    destination: "/operacao/reconciliacao",
    permanent: false,
  },
  {
    source: "/importacao",
    destination: "/operacao/importacao",
    permanent: false,
  },
  {
    source: "/reconciliacao",
    destination: "/operacao/reconciliacao",
    permanent: false,
  },
  {
    source: "/reconciliacao-central",
    destination: "/operacao/reconciliacao",
    permanent: false,
  },
  {
    source: "/sensores",
    destination: "/monitoramento/sensores",
    permanent: false,
  },
  {
    source: "/equipamentos",
    destination: "/ativos",
    permanent: false,
  },
  {
    source: "/equipamentos/starlinks",
    destination: "/ativos/starlinks",
    permanent: false,
  },
];

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import("next").NextConfig} */
const nextConfig = {
  async redirects() {
    return [...operationalNarrativeRedirects, ...legacyAliasRedirects];
  },
  allowedDevOrigins,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
