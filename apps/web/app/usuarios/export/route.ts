import { NextResponse } from "next/server";
import { buildApiQuery, type PaginatedResponse } from "@/lib/list-query";
import { roleLabel } from "@/lib/role-policy";
import { apiJson } from "@/lib/server-api";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

function readOptional(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim();
  return value || undefined;
}

function csvCell(value: string | number | boolean | undefined | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function formatExportDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Araguaina",
  }).format(date);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = readOptional(url.searchParams, "q");
    const role = readOptional(url.searchParams, "role");
    const active = readOptional(url.searchParams, "active");

    const items: UserRow[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 50) {
      const response = await apiJson<PaginatedResponse<UserRow>>(
        `/users${buildApiQuery({
          q,
          role: role && role !== "all" ? role : undefined,
          active: active && active !== "all" ? active : undefined,
          sortBy: "name",
          sortDir: "asc",
          page,
          pageSize: 100,
        })}`,
      );

      items.push(...response.items);
      hasNext = response.meta.hasNext;
      page += 1;
    }

    const header = [
      "Nome",
      "E-mail",
      "Perfil",
      "Status",
      "Criado em",
      "Atualizado em",
    ];
    const rows = items.map((user) => [
      user.name,
      user.email,
      roleLabel(user.role),
      user.isActive ? "Ativo" : "Bloqueado",
      formatExportDate(user.createdAt),
      formatExportDate(user.updatedAt || user.createdAt),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const filenameDate = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}\n`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nova-usuarios-${filenameDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível exportar os usuários." },
      { status: 500 },
    );
  }
}
