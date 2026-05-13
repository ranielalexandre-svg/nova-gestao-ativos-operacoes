import { redirect } from "next/navigation";

export default function LegacyCadastroRedirectPage() {
  redirect("/chamados/cadastro");
}
