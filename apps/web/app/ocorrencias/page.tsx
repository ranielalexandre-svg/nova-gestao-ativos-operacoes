import { redirect } from "next/navigation";

type RawSearchParams = Record<string, string | string[] | undefined>;

function appendSearchParams(pathname: string, params: RawSearchParams) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) query.append(key, item);
      });
      return;
    }

    if (value) query.set(key, value);
  });

  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export default async function OcorrenciasLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  redirect(appendSearchParams("/alertas", params));
}
