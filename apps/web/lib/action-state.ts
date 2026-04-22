export type ActionFeedbackState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const idleActionFeedback: ActionFeedbackState = {
  status: "idle",
  message: "",
};

export function getActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Falha ao processar a ação.";
}
