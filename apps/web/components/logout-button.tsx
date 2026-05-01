"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
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
      onClick={handleLogout}
      className="nds-button"
      data-variant="secondary"
      disabled={loading}
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
