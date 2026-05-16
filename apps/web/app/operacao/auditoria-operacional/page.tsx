import { redirect } from "next/navigation";
import { getServerWebSession } from "@/lib/web-session";
import { SuitePosIncidentePage } from "../_suite-pos-incidente/page-shell";

export default async function AuditoriaOperacionalPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/atividade");
  return <SuitePosIncidentePage kind="auditoria-operacional" />;
}
