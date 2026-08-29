export type ExpenseEntryProgress = {
  stage: "reading" | "saving";
  kind: "text" | "receipt";
};
export type ExpenseEntryResult =
  | { status: "saved"; description: string; amount: number }
  | { status: "review" };
