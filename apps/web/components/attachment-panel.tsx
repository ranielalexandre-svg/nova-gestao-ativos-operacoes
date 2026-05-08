import { revalidatePath } from "next/cache";
import { ActionForm } from "@/components/action-form";
import {
  EmptyState,
  SectionIntro,
  Surface,
  TableActionLink,
  TonePill,
} from "@/components/ops-ui";
import {
  getActionErrorMessage,
  type ActionFeedbackState,
} from "@/lib/action-state";
import { formatDateTime } from "@/lib/formatters";
import { apiFetch, apiJson } from "@/lib/server-api";

export type AttachmentItem = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number;
  source: string;
  uploadedAt: string;
  createdAt: string;
};

function formatFileSize(size: number) {
  if (!size) return "sem tamanho";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  if (size >= 1024) return `${Math.round(size / 1024).toLocaleString("pt-BR")} KB`;
  return `${size.toLocaleString("pt-BR")} B`;
}

async function uploadAttachmentAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  const entityPath = String(formData.get("entityPath") || "");
  const entityId = String(formData.get("entityId") || "");
  const returnPath = String(formData.get("returnPath") || "/dashboard");
  const file = formData.get("file");

  if (!entityPath || !entityId) {
    return { status: "error", message: "Entidade inválida para anexo." };
  }

  if (!(file instanceof File) || !file.name || file.size === 0) {
    return { status: "error", message: "Selecione um arquivo para enviar." };
  }

  try {
    const body = new FormData();
    body.append("file", file);

    await apiJson<AttachmentItem>(`/${entityPath}/${entityId}/attachments`, {
      method: "POST",
      body,
    });

    revalidatePath(returnPath);
    return { status: "success", message: "Anexo enviado com sucesso." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

async function deleteAttachmentAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  "use server";

  const entityPath = String(formData.get("entityPath") || "");
  const entityId = String(formData.get("entityId") || "");
  const attachmentId = String(formData.get("attachmentId") || "");
  const returnPath = String(formData.get("returnPath") || "/dashboard");

  if (!entityPath || !entityId || !attachmentId) {
    return { status: "error", message: "Anexo inválido para remoção." };
  }

  try {
    await apiFetch(`/${entityPath}/${entityId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });

    revalidatePath(returnPath);
    return { status: "success", message: "Anexo removido." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function AttachmentPanel({
  entityPath,
  entityId,
  entityLabel,
  returnPath,
  canEdit,
}: {
  entityPath: "units" | "equipments" | "partners" | "occurrences";
  entityId: string;
  entityLabel: string;
  returnPath: string;
  canEdit: boolean;
}) {
  let attachments: AttachmentItem[] = [];
  let error = "";

  try {
    attachments = await apiJson<AttachmentItem[]>(`/${entityPath}/${entityId}/attachments`);
  } catch (readError) {
    error = getActionErrorMessage(readError);
  }

  return (
    <Surface><SectionIntro
        eyebrow="Documentos"
        title={`Anexos de ${entityLabel}`}
        description="Arquivos de apoio ficam ligados ao registro para a troca não depender de pastas soltas externas."
        actions={<TonePill tone={attachments.length ? "info" : "neutral"}>{attachments.length} arquivo(s)</TonePill>}
        compact
      />

      {error ? (
        <div className="nds-notice-warning mt-2 rounded-[var(--nova-radius-card)] border px-3 py-2 text-[11px]">
          Não foi possível carregar anexos agora: {error}
        </div>
      ) : null}

      <div className="mt-2 nova-side-grid nova-side-grid--320"><div className="grid gap-2">
          {attachments.length ? (
            attachments.map((item) => (
              <div
                key={item.id}
                className="nova-attachment-card flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              ><div className="min-w-0"><div className="truncate text-[12px] font-bold text-slate-50">{item.name}</div><div className="mt-1 text-[10px] text-slate-500">
                    {formatFileSize(item.size)} · {item.mimeType || "tipo não informado"} · {formatDateTime(item.uploadedAt || item.createdAt)}
                  </div></div><div className="flex shrink-0 flex-wrap gap-2"><TableActionLink href={`/attachments/${item.id}/download`}>
                    Baixar
                  </TableActionLink>
                  {canEdit ? (
                    <ActionForm
                      action={deleteAttachmentAction}
                      submitLabel="Remover"
                      pendingLabel="Removendo..."
                      variant="secondary"
                      className="m-0"
                      submitClassName="mt-0"
                    ><input type="hidden" name="entityPath" value={entityPath} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="attachmentId" value={item.id} /><input type="hidden" name="returnPath" value={returnPath} /></ActionForm>
                  ) : null}
                </div></div>
            ))
          ) : (
            <EmptyState
              title="Nenhum anexo ligado"
              description="Contratos, prints, evidências e arquivos importados podem ficar vinculados aqui."
            />
          )}
        </div>

        {canEdit ? (
          <div className="nova-form-panel"><div className="text-[12px] font-bold text-slate-50">Enviar arquivo</div><div className="mt-2 text-[11px] leading-5 text-[var(--nova-text-muted)]">
              Limite atual: 20 MB por arquivo. Use nomes descritivos para facilitar auditoria e rollback.
            </div><ActionForm
              action={uploadAttachmentAction}
              submitLabel="Enviar anexo"
              pendingLabel="Enviando..."
              className="mt-2"
            ><input type="hidden" name="entityPath" value={entityPath} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="returnPath" value={returnPath} /><input
                type="file"
                name="file"
                className="w-full rounded-[4px] border border-[var(--nova-border)] bg-[var(--nova-surface-3)] px-2 py-1.5 text-[11px] text-slate-200 file:mr-3 file:rounded-[4px] file:border-0 file:bg-[var(--nova-primary)] file:px-2 file:py-1 file:text-[10px] file:font-black file:text-white"
              /></ActionForm></div>
        ) : (
          <div className="nds-card text-[11px] leading-5 text-[var(--nova-text-muted)]">
            Seu perfil pode consultar documentos, mas o envio e remoção ficam restritos a administradores e editores.
          </div>
        )}
      </div></Surface>
  );
}
