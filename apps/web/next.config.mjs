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

const createLegacyAliasRedirects = [
  {
    source: "/alertas/novo",
    destination: "/alertas/cadastro",
    permanent: false,
  },
  {
    source: "/ativos/nova",
    destination: "/ativos/cadastro",
    permanent: false,
  },
  {
    source: "/chamados/novo",
    destination: "/chamados/cadastro",
    permanent: false,
  },
  {
    source: "/contratos/novo",
    destination: "/contratos/cadastro",
    permanent: false,
  },
  {
    source: "/excecoes/nova",
    destination: "/operacao/excecoes/cadastro",
    permanent: false,
  },
  {
    source: "/operacao/excecoes/nova",
    destination: "/operacao/excecoes/cadastro",
    permanent: false,
  },
  {
    source: "/manutencoes/nova",
    destination: "/manutencoes/cadastro",
    permanent: false,
  },
  {
    source: "/ocorrencias/nova",
    destination: "/ocorrencias/cadastro",
    permanent: false,
  },
  {
    source: "/parceiros/nova",
    destination: "/parceiros/cadastro",
    permanent: false,
  },
  {
    source: "/unidades/nova",
    destination: "/unidades/cadastro",
    permanent: false,
  },
  {
    source: "/usuarios/nova",
    destination: "/usuarios/cadastro",
    permanent: false,
  },
];

const deepLegacyAliasRedirects = [
  {
    source: "/relatorios/consumo",
    destination: "/operacao/relatorios/consumo",
    permanent: false,
  },
  {
    source: "/relatorios/disponibilidade",
    destination: "/operacao/relatorios/disponibilidade",
    permanent: false,
  },
  {
    source: "/relatorios/performance",
    destination: "/operacao/relatorios/performance",
    permanent: false,
  },
  {
    source: "/relatorios/monitoramento/automacoes",
    destination: "/operacao/relatorios/monitoramento/automacoes",
    permanent: false,
  },
  {
    source: "/relatorios/monitoramento/export",
    destination: "/operacao/relatorios/monitoramento/export",
    permanent: false,
  },
  {
    source: "/relatorios/monitoramento/export-jobs",
    destination: "/operacao/relatorios/monitoramento/export-jobs",
    permanent: false,
  },
  {
    source: "/relatorios/monitoramento/templates",
    destination: "/operacao/relatorios/monitoramento/templates",
    permanent: false,
  },
  {
    source: "/automacao/export",
    destination: "/operacao/automacoes/export",
    permanent: false,
  },
  {
    source: "/equipamentos/cadastro",
    destination: "/ativos/cadastro",
    permanent: false,
  },
  {
    source: "/equipamentos/nova",
    destination: "/equipamentos/cadastro",
    permanent: false,
  },
  {
    source: "/equipamentos/:assetId",
    destination: "/ativos/:assetId",
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
    return [...operationalNarrativeRedirects, ...legacyAliasRedirects, ...createLegacyAliasRedirects, ...deepLegacyAliasRedirects];
  },
  allowedDevOrigins,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
