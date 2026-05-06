"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NovaLitLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);

    try {
      await fetch("/api/auth/web-session", {
        method: "DELETE",
        credentials: "include",
      });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="nova-lit-logout-button"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
