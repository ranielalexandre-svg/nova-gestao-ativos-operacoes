"use client";

import type { FormEvent, ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FormSubmitButton } from "@/components/form-submit-button";
import { idleActionFeedback, type ActionFeedbackState } from "@/lib/action-state";

type ModalStep = {
  title: string;
  description: string;
  body: ReactNode;
};

function stepTone(active: boolean, completed: boolean) {
  if (active) return "border-[var(--nova-primary)] bg-[var(--nova-primary-soft)] text-white";
  if (completed) return "nds-step-complete";

  return "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]";
}

function EditModalBody({
  title,
  kicker,
  description,
  submitLabel,
  pendingLabel,
  steps,
  action,
  onClose,
}: {
  title: string;
  kicker?: string;
  description?: string;
  submitLabel: string;
  pendingLabel: string;
  steps: ModalStep[];
  action: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, formAction] = useActionState(action, idleActionFeedback);
  const maxStep = Math.max(steps.length - 1, 0);
  const current = steps[currentStep];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (currentStep < maxStep) {
      event.preventDefault();
      setCurrentStep((step) => Math.min(step + 1, maxStep));
    }
  };

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-2"><button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(2,6,12,0.82)]"
      /><div
        role="dialog"
        aria-modal="true"
        className="nds-panel relative z-[100000] max-h-[calc(100vh-32px)] w-full max-w-5xl overflow-hidden text-slate-100"
      ><div className="border-b border-white/[0.08] px-3 py-2 sm:px-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0">
              {kicker ? (
                <div className="nds-label">
                  {kicker}
                </div>
              ) : null}

              <h2 className="mt-2 text-[18px] font-black text-slate-50">
                {title}
              </h2>

              {description ? (
                <p className="mt-2 max-w-4xl text-[11px] leading-5 text-[var(--nova-text-muted)]">
                  {description}
                </p>
              ) : null}
            </div><button
              type="button"
              onClick={onClose}
              className="nds-icon-button shrink-0"
            >
              ×
            </button></div>

          {steps.length > 1 ? (
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {steps.map((step, index) => (
                <button
                  key={`${step.title}-${index}`}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`flex min-h-[36px] items-center gap-2 rounded-[6px] border px-2 py-1.5 text-left transition ${stepTone(
                    index === currentStep,
                    index < currentStep,
                  )}`}
                ><div className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[10px] font-black">
                    {index + 1}
                  </div><div className="min-w-0"><div className="text-[11px] font-black">{step.title}</div><div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                      {step.description}
                    </div></div></button>
              ))}
            </div>
          ) : null}
        </div><form action={formAction} onSubmit={handleSubmit}><div className="max-h-[calc(100vh-258px)] overflow-y-auto bg-[var(--nova-surface-3)] px-3 py-2 sm:px-3">
            {state.status !== "idle" ? (
              <div
                role={state.status === "error" ? "alert" : "status"}
                  className={`mb-2 rounded-[6px] border px-3 py-2 text-[11px] ${
                    state.status === "success"
                      ? "nds-notice-success"
                      : "nds-notice-error"
                  }`}
              >
                {state.message}
              </div>
            ) : null}

            <div className="nds-card"><div><div className="text-[13px] font-black text-slate-50">
                  {current.title}
                </div><div className="mt-1 text-[11px] leading-5 text-[var(--nova-text-muted)]">
                  {current.description}
                </div></div><div className="mt-2 border-t border-white/[0.08] pt-2">
                {steps.map((step, index) => (
                  <div
                    key={`${step.title}-panel-${index}`}
                    className={index === currentStep ? "block" : "hidden"}
                  >
                    {step.body}
                  </div>
                ))}
              </div></div></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-[var(--nova-surface-3)] px-3 py-2 sm:px-3"><div className="nds-label">
              etapa {currentStep + 1} de {steps.length}
            </div><div className="flex flex-wrap items-center gap-2"><button
                type="button"
                onClick={onClose}
                className="nds-button"
                data-variant="secondary"
              >
                Cancelar
              </button>

              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
                  className="nds-button"
                  data-variant="secondary"
                >
                  Voltar
                </button>
              ) : null}

              {currentStep < maxStep ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((step) => Math.min(step + 1, maxStep))}
                  className="nds-button"
                  data-variant="primary"
                >
                  Próximo
                </button>
              ) : (
                <FormSubmitButton
                  idleLabel={submitLabel}
                  pendingLabel={pendingLabel}
                  variant="primary"
                  className="min-w-[168px]"
                />
              )}
            </div></div></form></div></div>
  );
}

export function EntityEditModal({
  triggerLabel,
  title,
  kicker,
  description,
  submitLabel,
  pendingLabel,
  steps,
  action,
  triggerClassName,
}: {
  triggerLabel: string;
  title: string;
  kicker?: string;
  description?: string;
  submitLabel: string;
  pendingLabel: string;
  steps: ModalStep[];
  action: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <><button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ||
          "nds-button"
        }
        data-variant="secondary"
      >
        {triggerLabel}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <EditModalBody
              title={title}
              kicker={kicker}
              description={description}
              submitLabel={submitLabel}
              pendingLabel={pendingLabel}
              steps={steps}
              action={action}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
