import { redirect } from "next/navigation";
import { getServerWebSession } from "@/lib/web-session";
import { SuitePosIncidentePage } from "../_suite-pos-incidente/page-shell";

export default async function PosIncidenteOperacionalPage() {
  const session = await getServerWebSession();
  if (!session.authenticated) redirect("/login?next=/operacao/war-room");
  return <SuitePosIncidentePage kind="pos-incidente" />;
}
