import { redirect } from "next/navigation";
import { getServerWebSession } from "@/lib/web-session";
import { SuitePosIncidentePage } from "../_suite-pos-incidente/page-shell";

export default async function ComunicacaoTurnoPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/handoff");
  return <SuitePosIncidentePage kind="comunicacao-turno" />;
}
