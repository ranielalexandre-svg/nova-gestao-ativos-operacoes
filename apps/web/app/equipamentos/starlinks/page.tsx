import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  DenseTable,
  EmptyState,
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
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type StarlinkRow = {
  id: string;
  type: string;
  manufacturer: string;
  model: string;
  technology: string;
  assetTag: string;
  serial: string | null;
  unitId: string;
  partnerId: string;
  status: string;
  criticality: string;
  installedAt: string | null;
  createdAt: string;
  city: string | null;
  unitName: string;
  partnerName: string;
  documents: unknown[];
};

function norm(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function statusTone(value: string) {
  const normalized = norm(value);
  if (["active", "ativo", "em operação"].includes(normalized)) return "success";
  if (["repair", "manutenção", "degraded"].includes(normalized)) return "attention";
  if (["retired", "inativo", "inactive"].includes(normalized)) return "subtle";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function StarlinksPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/equipamentos/starlinks");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const status = readStringParam(params, "status", "all");
  const role = normalizeRole(session.user?.role || "");
  const isAdmin = role === "admin";

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
  const withSerial = filtered.filter((item) => item.serial).length;
  const cities = new Set(filtered.map((item) => item.city).filter(Boolean)).size;

  return (
    <AppShell
      title="Equipamentos / Starlinks"
      subtitle="Subgrupo de equipamentos satelitais."
    ><RegistryHero
        eyebrow="Equipamentos"
        title="Starlinks"
        description="Filtro operacional dos kits Starlink dentro do inventário técnico."
        actions={
          <div className="flex flex-wrap gap-2"><Link
              href="/export/starlinks"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"
            >
              Exportar CSV
            </Link>
            {isAdmin ? (
              <Link
                href="/operacao/importacao?resource=starlinks"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
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
          { label: "Cidades", value: cities, meta: "cobertura do recorte", tone: "neutral" },
        ]}
        noteTitle="Contrato com o legado"
        noteCopy="Esta tela reduz risco de troca para quem já procurava Starlink como módulo separado, sem duplicar cadastro no banco."
      /><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Filtros"
          title="Encontrar kit por unidade, parceiro ou serial"
          description="Para editar cadastro, abra o equipamento vinculado."
          actions={
            <Link
              href="/equipamentos/starlinks"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        /><form method="GET" className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]"><input
            name="q"
            defaultValue={q}
            placeholder="Buscar por kit, serial, unidade, parceiro ou cidade"
            className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
          /><select
            name="status"
            defaultValue={status}
            className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
          ><option value="all">Todos os status</option><option value="active">Ativos</option><option value="stock">Estoque</option><option value="repair">Reparo</option><option value="retired">Retirados</option></select><button className="rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-95">
            Filtrar
          </button></form></Surface><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Frota"
          title="Kits Starlink"
          description={`${filtered.length} kit(s) no recorte atual.`}
          compact
        /><div className="mt-5">
          {filtered.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Kit</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Status</th><TableActionHeader /></tr></TableHead><tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"><TableCell><Link href={`/equipamentos/${item.id}`} className="font-medium text-white hover:text-sky-100">
                          {item.assetTag}
                        </Link><div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                          {item.model || item.manufacturer} · {item.technology}
                        </div></TableCell><TableCell><Link href={`/unidades/${item.unitId}`} className="font-medium text-slate-100 hover:text-sky-100">
                          {item.unitName}
                        </Link><div className="mt-1 text-xs text-slate-500">{item.city || "sem cidade"}</div></TableCell><TableCell className="text-slate-300">{item.partnerName}</TableCell><TableCell className="text-slate-300">{item.serial || "-"}</TableCell><TableCell><TonePill tone={statusTone(item.status)}>{item.status || "sem status"}</TonePill><div className="mt-1 text-xs text-slate-500">desde {formatDate(item.installedAt || item.createdAt)}</div></TableCell><TableActionCell><TableActionLink href={`/equipamentos/${item.id}`}>
                          Abrir ativo
                        </TableActionLink></TableActionCell></tr>
                  ))}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum Starlink encontrado"
              description="Ajuste os filtros ou importe a planilha de Starlinks pela central de importação."
              action={
                isAdmin ? (
                  <Link href="/operacao/importacao?resource=starlinks" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
                    Ir para importação
                  </Link>
                ) : null
              }
            />
          )}
        </div></Surface></AppShell>
  );
}
