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
    return operationalNarrativeRedirects;
  },
  allowedDevOrigins,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
