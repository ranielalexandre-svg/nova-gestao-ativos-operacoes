"use client";

import { useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

function CopyButton({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const disabled = !value;

  async function copyValue() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  return (
    <button
      type="button"
      className="nds-button"
      data-variant="secondary"
      disabled={disabled}
      onClick={copyValue}
    >
      {status === "copied" ? "Copiado" : status === "error" ? "Falhou" : label}
    </button>
  );
}

export function StarlinkSecretActions({
  email,
  password,
  card,
  revealed,
}: {
  email: string | null | undefined;
  password: string | null | undefined;
  card: string | null | undefined;
  revealed: boolean;
}) {
  if (!revealed) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <CopyButton label="Copiar e-mail" value={email} />
      <CopyButton label="Copiar senha" value={password} />
      <CopyButton label="Copiar cartão" value={card} />
    </div>
  );
}
