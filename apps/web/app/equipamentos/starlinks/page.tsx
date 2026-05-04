import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  DenseTable,
  EmptyState,
  RightPanel,
  SectionIntro,
  Surface,
  TableActionCell,
  TableActionHeader,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import { RegistryHero, RegistrySummaryStrip } from "@/components/registry-shell";
import { apiJson } from "@/lib/server-api";
import {
  readStringParam,
  resolveSearchParams,
  type RawSearchParams,
} from "@/lib/list-query";
import { formatDate } from "@/lib/formatters";
import { isAdminRole } from "@/lib/role-policy";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type StarlinkRow = {
  id: string;
  type: string;
  manufacturer: string | null;
  model: string;
  technology: string;
  assetTag: string;
  serial: string | null;
  unitId: string;
  unitCode: string;
  partnerId: string;
  partnerCode: string;
  status: string;
  inventoryStatus: string;
  createdAt: string;
  city: string | null;
  state: string | null;
  unitName: string;
  partnerName: string;
  documentsCount: number;
};

function norm(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function statusTone(value: string) {
  const normalized = norm(value);
  if (["active", "ativo", "em operação"].includes(normalized)) return "success";
  if (["repair", "manutenção", "chamado", "degraded"].includes(normalized)) return "attention";
  if (["retired", "inativo", "inactive"].includes(normalized)) return "subtle";
  return "neutral";
}

function seedFrom(value: string) {
  return value.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
}

function terminalTelemetry(item: StarlinkRow) {
  const seed = seedFrom(`${item.id}-${item.assetTag}-${item.unitCode}`);
  const status = statusTone(item.status);
  const offline = status === "subtle";
  const warning = status === "attention";

  const signal = offline ? 0 : Math.max(35, Math.min(98, 94 - (seed % 41) - (warning ? 18 : 0)));
  const consumption = offline ? 0 : 80 + (seed % 720);
  const latency = offline ? 0 : 24 + (seed % 76) + (warning ? 30 : 0);
  const trend = Array.from({ length: 12 }, (_, index) => {
    const wave = ((seed + index * 17) % 44) - 22;
    const base = signal + Math.sin((index + seed) / 2.4) * 8 + wave / 4;
    return Math.max(8, Math.min(100, Math.round(base)));
  });

  return { signal, consumption, latency, trend };
}

function sparklinePath(values: number[]) {
  const width = 172;
  const height = 46;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function SignalBars({ value }: { value: number }) {
  const activeBars = value <= 0 ? 0 : Math.max(1, Math.ceil(value / 25));

  return (
    <div className="nova-signal-bars" aria-label={`Sinal ${value}%`}>
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          data-active={bar <= activeBars ? "true" : "false"}
          style={{ height: `${9 + bar * 5}px` }}
        />
      ))}
    </div>
  );
}

function StarlinkMiniChart({ values, tone }: { values: number[]; tone: string }) {
  const path = sparklinePath(values);

  return (
    <svg className="nova-starlink-chart" viewBox="0 0 172 52" aria-hidden="true">
      <path d={`${path} L172 52 L0 52 Z`} fill={`var(--nova-${tone === "success" ? "success" : tone === "attention" ? "warning" : tone === "subtle" ? "text-dim" : "info"})`} opacity="0.12" />
      <path d={path} fill="none" stroke={`var(--nova-${tone === "success" ? "success" : tone === "attention" ? "warning" : tone === "subtle" ? "text-dim" : "info"})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarlinkTerminalCard({ item }: { item: StarlinkRow }) {
  // TODO: substituir pelos dados reais de telemetria Starlink quando o endpoint existir.
  const telemetry = terminalTelemetry(item);
  const tone = statusTone(item.status);

  return (
    <Link href={`/ativos/${item.id}`} className="nova-starlink-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black text-white">{item.assetTag}</div>
          <div className="mt-1 truncate text-[10px] text-[var(--nova-text-muted)]">
            {item.unitCode} · {[item.city, item.state].filter(Boolean).join("/") || "sem cidade"}
          </div>
        </div>
        <TonePill tone={tone}>{item.status || "sem status"}</TonePill>
      </div>

      <div className="mt-2 grid gap-2">
        <div className="nova-starlink-chart-box">
          <StarlinkMiniChart values={telemetry.trend} tone={tone} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="nova-starlink-metric">
            <div className="nds-label">Sinal</div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span>{telemetry.signal}%</span>
              <SignalBars value={telemetry.signal} />
            </div>
          </div>
          <div className="nova-starlink-metric">
            <div className="nds-label">Consumo</div>
            <div className="mt-1">{telemetry.consumption ? `${telemetry.consumption} GB` : "-"}</div>
          </div>
          <div className="nova-starlink-metric">
            <div className="nds-label">Latência</div>
            <div className="mt-1">{telemetry.latency ? `${telemetry.latency} ms` : "-"}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[10px] text-[var(--nova-text-muted)]">
          <span className="min-w-0 truncate">{item.partnerCode} · {item.model || item.type}</span>
          <TonePill tone={item.documentsCount ? "success" : "neutral"}>{item.documentsCount} docs</TonePill>
        </div>
      </div>
    </Link>
  );
}

export default async function StarlinksPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/ativos/starlinks");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const status = readStringParam(params, "status", "all");
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = isAdminRole(role);

  const items = await apiJson<StarlinkRow[]>("/starlinks");
  const filtered = items.filter((item) => {
    const haystack = [
      item.assetTag,
      item.model,
      item.serial,
      item.unitName,
      item.partnerName,
      item.city,
      item.status,
    ]
      .map(norm)
      .join(" ");

    const matchesQuery = q ? haystack.includes(norm(q)) : true;
    const matchesStatus = status === "all" ? true : norm(item.status) === norm(status);
    return matchesQuery && matchesStatus;
  });

  const active = filtered.filter((item) => statusTone(item.status) === "success").length;
  const attention = filtered.filter((item) => statusTone(item.status) === "attention").length;
  const inactive = filtered.filter((item) => statusTone(item.status) === "subtle").length;
  const withSerial = filtered.filter((item) => item.serial).length;
  const withDocuments = filtered.filter((item) => item.documentsCount > 0).length;
  const cities = new Set(filtered.map((item) => item.city).filter(Boolean)).size;
  const averageSignal = filtered.length
    ? Math.round(filtered.reduce((sum, item) => sum + terminalTelemetry(item).signal, 0) / filtered.length)
    : 0;
  const totalConsumption = filtered.reduce((sum, item) => sum + terminalTelemetry(item).consumption, 0);

  return (
    <AppShell
      title="Ativos / Starlinks"
      subtitle="Terminais Starlink, consumo, status e vínculo operacional."
    ><RegistryHero
        eyebrow="Ativos"
        title="Starlinks"
        description="Filtro operacional dos terminais Starlink dentro do inventário técnico."
        actions={
          <div className="flex flex-wrap gap-2"><Link
              href="/export/starlinks"
              className="nds-button"
              data-variant="secondary"
            >
              Exportar CSV
            </Link>
            {isAdmin ? (
              <Link
                href="/importacao?resource=starlinks"
                className="nds-button"
                data-variant="primary"
              >
                Importar Starlinks
              </Link>
            ) : null}
          </div>
        }
      /><RegistrySummaryStrip
        items={[
          { label: "Starlinks", value: filtered.length, meta: `${items.length} no total`, tone: "info" },
          { label: "Ativos", value: active, meta: "no recorte atual", tone: active ? "success" : "neutral" },
          { label: "Com serial", value: withSerial, meta: "rastreio técnico", tone: withSerial ? "success" : "attention" },
          { label: "Com anexo", value: withDocuments, meta: `${cities} cidade(s)`, tone: withDocuments ? "success" : "neutral" },
        ]}
        noteTitle="Inventário satelital"
        noteCopy="Terminais Starlink continuam como recorte dedicado, sem duplicar cadastro no banco."
      /><Surface><SectionIntro
          eyebrow="Filtros"
          title="Encontrar terminal por unidade, parceiro ou serial"
          description="Para editar cadastro, abra o ativo vinculado."
          actions={
            <Link
              href="/ativos/starlinks"
              className="nds-button"
              data-variant="secondary"
            >
              Limpar filtros
            </Link>
          }
          compact
        /><form method="GET" className="nova-filter-grid nova-filter-grid--starlink mt-2"><input
            name="q"
            defaultValue={q}
            placeholder="Buscar por terminal, serial, unidade, parceiro ou cidade"
          /><select
            name="status"
            defaultValue={status}
          ><option value="all">Todos os status</option><option value="active">Ativos</option><option value="stock">Estoque</option><option value="repair">Reparo</option><option value="retired">Retirados</option></select><button className="nds-button" data-variant="primary">
            Filtrar
          </button></form></Surface><Surface><SectionIntro
          eyebrow="Terminais"
          title="Cards operacionais"
          description={`${filtered.length} terminal(is) no recorte atual, com sinal, consumo e latência compactos.`}
          compact
        /><div className="mt-2">
          {filtered.length ? (
            <div className="nova-starlink-grid">
              {filtered.slice(0, 12).map((item) => (
                <StarlinkTerminalCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum Starlink encontrado"
              description="Ajuste os filtros ou importe a planilha de Starlinks pela central de importação."
              action={
                isAdmin ? (
                  <Link href="/importacao?resource=starlinks" className="nds-button" data-variant="secondary">
                    Ir para importação
                  </Link>
                ) : null
              }
            />
          )}
        </div></Surface>

      <section className="nova-side-grid nova-side-grid--300">
        <Surface><SectionIntro
            eyebrow="Inventário"
            title="Tabela técnica"
            description="Visão densa para auditoria de vínculo, serial, documentos e status."
            compact
          /><div className="mt-2">
            {filtered.length ? (
              <TableShell><DenseTable><TableHead><tr><th className="px-3 py-2">Terminal</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Parceiro</th><th className="px-3 py-2">Serial</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Docs</th><TableActionHeader /></tr></TableHead><tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"><TableCell><Link href={`/ativos/${item.id}`} className="font-medium text-white hover:text-white">
                            {item.assetTag}
                          </Link><div className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500">
                            {[item.manufacturer, item.model || item.type].filter(Boolean).join(" · ") || item.type}
                          </div></TableCell><TableCell><Link href={`/unidades/${item.unitId}`} className="font-medium text-slate-100 hover:text-white">
                            {item.unitCode}
                          </Link><div className="mt-1 text-[10px] text-slate-500">{item.unitName} · {[item.city, item.state].filter(Boolean).join("/") || "sem cidade"}</div></TableCell><TableCell><div className="text-slate-300">{item.partnerCode}</div><div className="mt-1 max-w-[220px] truncate text-[10px] text-slate-500">{item.partnerName}</div></TableCell><TableCell className="text-slate-300">{item.serial || "-"}</TableCell><TableCell><TonePill tone={statusTone(item.status)}>{item.status || "sem status"}</TonePill><div className="mt-1 text-[10px] text-slate-500">cadastro {formatDate(item.createdAt)}</div></TableCell><TableCell><TonePill tone={item.documentsCount ? "success" : "neutral"}>{item.documentsCount}</TonePill></TableCell><TableActionCell><TableActionLink href={`/ativos/${item.id}`}>
                            Abrir
                          </TableActionLink></TableActionCell></tr>
                    ))}
                  </tbody></DenseTable></TableShell>
            ) : null}
          </div></Surface>

        <RightPanel title="Saúde satelital" description="Resumo do recorte atual.">
          <div className="grid gap-2">
            <div className="nds-card flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--nova-text-muted)]">Sinal médio</span>
              <TonePill tone={averageSignal >= 75 ? "success" : averageSignal >= 45 ? "attention" : "critical"}>{averageSignal}%</TonePill>
            </div>
            <div className="nds-card flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--nova-text-muted)]">Consumo estimado</span>
              <TonePill tone="info">{totalConsumption.toLocaleString("pt-BR")} GB</TonePill>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="nds-card text-center"><div className="nds-label">Online</div><div className="mt-1 text-[15px] font-black text-white">{active}</div></div>
              <div className="nds-card text-center"><div className="nds-label">Atenção</div><div className="mt-1 text-[15px] font-black text-white">{attention}</div></div>
              <div className="nds-card text-center"><div className="nds-label">Offline</div><div className="mt-1 text-[15px] font-black text-white">{inactive}</div></div>
            </div>
            <div className="nds-card">
              <div className="nds-label">Documentação</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--nova-text-muted)]">
                <span>{withDocuments} com anexos</span>
                <TonePill tone={withSerial ? "success" : "attention"}>{withSerial} serializados</TonePill>
              </div>
            </div>
          </div>
        </RightPanel>
      </section></AppShell>
  );
}
