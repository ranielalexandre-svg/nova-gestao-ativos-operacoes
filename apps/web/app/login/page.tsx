import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getServerWebSession } from "@/lib/web-session";

export default async function LoginPage() {
  const session = await getServerWebSession();

  if (session.authenticated) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
