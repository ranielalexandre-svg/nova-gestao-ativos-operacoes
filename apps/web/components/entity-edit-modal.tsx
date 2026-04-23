"use client";

import type { FormEvent, ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  idleActionFeedback,
  type ActionFeedbackState,
} from "@/lib/action-state";

type ModalStep = {
  title: string;
  description: string;
  body: ReactNode;
};

function stepTone(active: boolean, completed: boolean) {
  if (active) return "border-sky-500/32 bg-sky-500/[0.14] text-white";
  if (completed) return "border-emerald-500/22 bg-emerald-500/10 text-emerald-100";
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(3,6,11,0.78)] backdrop-blur-[10px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[121] max-h-[min(92vh,980px)] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,#0f141c,#0d1219)] shadow-[0_34px_90px_rgba(0,0,0,0.45)]"
      >
        <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {kicker ? (
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {kicker}
                </div>
              ) : null}
              <h2 className="mt-2 text-[24px] font-extrabold tracking-[-0.04em] text-slate-50">
                {title}
              </h2>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-lg text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              ×
            </button>
          </div>

          {steps.length > 1 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {steps.map((step, index) => (
                <button
                  key={`${step.title}-${index}`}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`flex min-h-[68px] items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition ${stepTone(index === currentStep, index < currentStep)}`}
                >
                  <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-xs font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{step.title}</div>
                    <div className="mt-0.5 text-xs leading-5 text-slate-500">
                      {step.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <form action={formAction} onSubmit={handleSubmit}>
          <div className="max-h-[calc(92vh-236px)] overflow-y-auto px-5 py-5 sm:px-6">
            {state.status !== "idle" ? (
              <div
                role={state.status === "error" ? "alert" : "status"}
                className={`mb-4 rounded-[14px] border px-4 py-3 text-sm ${
                  state.status === "success"
                    ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-100"
                    : "border-rose-500/25 bg-rose-500/12 text-rose-100"
                }`}
              >
                {state.message}
              </div>
            ) : null}

            <div className="rounded-[18px] border border-white/[0.08] bg-[#11171e] p-5 sm:p-6">
              <div>
                <div className="text-[16px] font-semibold tracking-tight text-slate-50">
                  {current.title}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  {current.description}
                </div>
              </div>
              <div className="mt-5 border-t border-white/[0.08] pt-5">
                {steps.map((step, index) => (
                  <div
                    key={`${step.title}-panel-${index}`}
                    className={index === currentStep ? "block" : "hidden"}
                  >
                    {step.body}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-4 sm:px-6">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
              etapa {currentStep + 1} de {steps.length}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
                  className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Voltar
                </button>
              ) : null}
              {currentStep < maxStep ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((step) => Math.min(step + 1, maxStep))}
                  className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
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
            </div>
          </div>
        </form>
      </div>
    </div>
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
      >
        {triggerLabel}
      </button>

      {open ? (
        <EditModalBody
          title={title}
          kicker={kicker}
          description={description}
          submitLabel={submitLabel}
          pendingLabel={pendingLabel}
          steps={steps}
          action={action}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
