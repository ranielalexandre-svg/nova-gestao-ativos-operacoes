import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListPagination } from "@/components/list-pagination";
import {
  DenseTable,
  EmptyState,
  SectionIntro,
  Surface,
  TableActionCell,
  TableActionLink,
  TableCell,
  TableHead,
  TableShell,
  TonePill,
} from "@/components/ops-ui";
import {
  RegistryHero,
  RegistrySummaryStrip,
} from "@/components/registry-shell";
import { apiJson } from "@/lib/server-api";
import {
  getLegacyPartnerDeskForPartners,
  type LegacyPartnerDeskItem,
} from "@/lib/legacy-catalog";
import {
  buildApiQuery,
  readPositiveIntParam,
  readStringParam,
  resolveSearchParams,
  type PaginatedResponse,
  type RawSearchParams,
} from "@/lib/list-query";
import { getServerWebSession, normalizeRole } from "@/lib/web-session";

type PartnerRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count: { units: number };
};

function FieldLabel({
  htmlFor,
  label,
}: {
  htmlFor: string;
  label: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
      {label}
    </label>
  );
}

function firstPhones(item?: LegacyPartnerDeskItem) {
  if (!item?.phones.length) return "Sem telefone legado";
  return item.phones.slice(0, 2).join(" · ");
}

function contactCaption(item?: LegacyPartnerDeskItem) {
  if (!item?.contactName) return "Contato principal não encontrado";
  return [item.contactName, item.contactRole].filter(Boolean).join(" · ");
}

export default async function ParceirosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const session = await getServerWebSession();

  if (!session.authenticated) {
    redirect("/login?next=/parceiros");
  }

  const params = await resolveSearchParams(searchParams);
  const q = readStringParam(params, "q");
  const active = readStringParam(params, "active", "true");
  const sortBy = readStringParam(params, "sortBy", "createdAt");
  const sortDir = readStringParam(params, "sortDir", "desc");
  const page = readPositiveIntParam(params, "page", 1);
  const pageSize = readPositiveIntParam(params, "pageSize", 10);
  const isAdmin = normalizeRole(session.user?.role || "") === "admin";

  const response = await apiJson<PaginatedResponse<PartnerRow>>(
    `/partners${buildApiQuery({
      q,
      active: active !== "all" ? active : undefined,
      sortBy,
      sortDir,
      page,
      pageSize,
    })}`,
  );

  const legacyDesk = await getLegacyPartnerDeskForPartners(
    response.items.map((partner) => ({
      id: partner.id,
      code: partner.code,
      name: partner.name,
    })),
  );
  const legacyByPartnerId = legacyDesk.items;
  const activeOnPage = response.items.filter((partner) => partner.isActive).length;
  const withContactOnPage = response.items.filter(
    (partner) => legacyByPartnerId[partner.id]?.phones.length,
  ).length;
  const withCoverageOnPage = response.items.filter(
    (partner) => legacyByPartnerId[partner.id]?.coverage,
  ).length;
  const backupCoverageOnPage = response.items.reduce(
    (sum, partner) => sum + (legacyByPartnerId[partner.id]?.backupUnitCount || 0),
    0,
  );

  return (
    <AppShell
      title="Parceiros"
      subtitle="Cadastro de parceiros."
    ><RegistryHero
        eyebrow="Partner Desk"
        title="Parceiros"
        description="Cadastro de parceiros."
        actions={
          isAdmin ? (
            <Link
              href="/parceiros/nova"
              className="inline-flex h-11 items-center justify-center rounded-[14px] border border-sky-500/28 bg-sky-500/14 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/18"
            >
              Novo parceiro
            </Link>
          ) : null
        }
      /><RegistrySummaryStrip
        items={[
          {
            label: "Parceiros",
            value: response.meta.total,
            meta: "resultado filtrado",
            tone: "info",
          },
          {
            label: "Ativos",
            value: activeOnPage,
            meta: "nesta página",
            tone: activeOnPage ? "success" : "neutral",
          },
          {
            label: "Com contato",
            value: withContactOnPage,
            meta: "telefone legado disponível",
            tone: withContactOnPage ? "success" : "attention",
          },
          {
            label: "Cobertura",
            value: withCoverageOnPage,
            meta: `${backupCoverageOnPage} unidade(s) em contingência`,
            tone: backupCoverageOnPage ? "attention" : "neutral",
          },
        ]}
        noteTitle="Tabela primeiro"
        noteCopy="Lista de parceiros e novo cadastro."
      /><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Filtros"
          title="Consulta"
          actions={
            <Link
              href="/parceiros"
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            >
              Limpar filtros
            </Link>
          }
          compact
        /><form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><div className="grid gap-2 xl:col-span-2"><FieldLabel htmlFor="partners-q" label="Busca" /><input
              id="partners-q"
              name="q"
              defaultValue={q}
              placeholder="Nome, código, cidade base ou contato"
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
            /></div><div className="grid gap-2"><FieldLabel htmlFor="partners-active" label="Status" /><select
              id="partners-active"
              name="active"
              defaultValue={active}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            ><option value="all">Todos</option><option value="true">Ativos</option><option value="false">Excluídos</option></select></div><div className="grid gap-2"><FieldLabel htmlFor="partners-sort-by" label="Ordenar por" /><select
              id="partners-sort-by"
              name="sortBy"
              defaultValue={sortBy}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            ><option value="createdAt">Cadastro</option><option value="code">Código</option><option value="name">Nome</option></select></div><div className="grid gap-2"><FieldLabel htmlFor="partners-page-size" label="Página" /><select
              id="partners-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-[14px] border border-white/10 bg-[#111318] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            ><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></select></div><input type="hidden" name="sortDir" value={sortDir} /><button className="rounded-[14px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-95 md:col-span-2 xl:col-span-5">
            Aplicar filtros
          </button></form></Surface><Surface className="p-5 sm:p-6"><SectionIntro
          eyebrow="Partner Desk"
          title="Contatos e cobertura"
          description={`${response.meta.total} parceiro(s) encontrados nesta visão.`}
          actions={<TonePill tone="neutral">{response.items.length} linhas</TonePill>}
          compact
        /><div className="mt-4">
          {response.items.length ? (
            <TableShell><DenseTable><TableHead><tr><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Cidade base</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Cobertura</th><th className="px-4 py-3">Locais</th><th className="px-4 py-3 text-right">Ações</th></tr></TableHead><tbody>
                  {response.items.map((partner) => {
                    const legacy = legacyByPartnerId[partner.id];

                    return (
                      <tr
                        key={partner.id}
                        className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"
                      ><TableCell><Link
                            href={`/parceiros/${partner.id}`}
                            className="font-medium text-white transition hover:text-sky-200"
                          >
                            {partner.name}
                          </Link><div className="mt-1 text-xs text-slate-500">{partner.code}</div></TableCell><TableCell className="text-slate-300">
                          {legacy?.cityBase || "-"}
                        </TableCell><TableCell><div className="max-w-[280px] text-sm text-slate-200">
                            {contactCaption(legacy)}
                          </div><div className="mt-1 max-w-[280px] text-xs text-slate-500">
                            {firstPhones(legacy)}
                          </div></TableCell><TableCell><div className="max-w-[260px] text-sm text-slate-200">
                            {legacy?.coverage || "Cobertura não importada"}
                          </div><div className="mt-1 text-xs text-slate-500">
                            {legacy?.matched ? "base legada vinculada" : "sem match legado"}
                          </div></TableCell><TableCell><div className="text-sm font-medium text-slate-100">
                            {partner._count.units}
                          </div><div className="mt-1 text-xs text-slate-500">
                            {legacy?.backupUnitCount
                              ? `${legacy.backupUnitCount} em contingência`
                              : "sem contingência registrada"}
                          </div></TableCell><TableActionCell><div className="flex justify-end gap-2"><TableActionLink href={`/parceiros/${partner.id}`}>
                              Abrir
                            </TableActionLink></div></TableActionCell></tr>
                    );
                  })}
                </tbody></DenseTable></TableShell>
          ) : (
            <EmptyState
              title="Nenhum parceiro encontrado"
              description="Ajuste os filtros ou volte para a base completa para retomar a leitura principal."
              action={
                <Link
                  href="/parceiros"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Limpar filtros
                </Link>
              }
            />
          )}
        </div></Surface><ListPagination pathname="/parceiros" searchParams={params} meta={response.meta} /></AppShell>
  );
}
