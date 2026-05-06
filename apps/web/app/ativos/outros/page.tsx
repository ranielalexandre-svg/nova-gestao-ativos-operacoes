import { redirect } from "next/navigation";

type RawSearchParams = Record<string, string | string[] | undefined>;

function filteredHref(params: RawSearchParams) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (key === "type") return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) query.append(key, item);
      });
      return;
    }
    if (value) query.set(key, value);
  });

  query.set("type", "outros");
  return `/ativos?${query.toString()}`;
}

export default async function AtivosOutrosPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams> | RawSearchParams;
}) {
  redirect(filteredHref(searchParams ? await searchParams : {}));
}
