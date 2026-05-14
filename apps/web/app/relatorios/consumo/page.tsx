import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function appendSearchParams(path: string, params: SearchParams) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value) {
      query.set(key, value);
    }
  }

  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export default async function LegacyReportsAliasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) || {};
  redirect(appendSearchParams("/operacao/relatorios/consumo", params));
}
