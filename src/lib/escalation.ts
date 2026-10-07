/**
 * استدعاء التدخل — shared, client-safe vocabulary for human-intervention calls.
 *
 * The agent does NOT match keywords or fixed templates. It classifies the
 * MEANING of what the customer wrote into one of these categories; the examples
 * in each label are illustrations for the merchant UI only.
 *
 * Single source of truth so the tool schema, the prompt, the server writer and
 * the dashboard can never drift apart.
 */

export const ESCALATION_CATEGORIES = [
  "order_problem",
  "supervisor_request",
  "abuse",
  "complaint",
  "payment_problem",
  "other",
] as const;

export type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number];

export const ESCALATION_SEVERITIES = ["normal", "urgent"] as const;
export type EscalationSeverity = (typeof ESCALATION_SEVERITIES)[number];

/** What each category MEANS — used verbatim in the model-facing tool schema. */
export const ESCALATION_CATEGORY_MEANING: Record<EscalationCategory, string> = {
  order_problem:
    "Something went wrong with a real order: wrong/missing/damaged item, long delay, undelivered shipment, a refund or cancellation the agent cannot perform.",
  supervisor_request:
    "The customer wants a responsible human — a manager, a supervisor, the owner, the complaints desk, or simply 'someone else' — however they phrase it.",
  abuse:
    "Insults, cursing, threats (legal, physical, public exposure), accusations of fraud, or sustained aggression.",
  complaint:
    "A serious grievance about the service, the staff, the prices or a promise that was broken — beyond an ordinary question.",
  payment_problem:
    "Money already moved or is disputed: paid and not registered, charged twice, transfer not recognised, refund owed.",
  other:
    "A genuine situation that clearly needs a human decision and fits none of the above.",
};

export const ESCALATION_CATEGORY_LABEL_AR: Record<EscalationCategory, string> = {
  order_problem: "مشكلة في أوردر",
  supervisor_request: "طلب التحدث مع مسؤول",
  abuse: "إساءة أو تهديد",
  complaint: "شكوى جدية",
  payment_problem: "مشكلة في الدفع",
  other: "حالة تحتاج قراراً بشرياً",
};

export const ESCALATION_SEVERITY_LABEL_AR: Record<EscalationSeverity, string> = {
  normal: "عادي",
  urgent: "عاجل",
};

export function normalizeEscalationCategory(value: unknown): EscalationCategory {
  const v = String(value ?? "").trim();
  return (ESCALATION_CATEGORIES as readonly string[]).includes(v)
    ? (v as EscalationCategory)
    : "other";
}

export function normalizeEscalationSeverity(value: unknown): EscalationSeverity {
  const v = String(value ?? "").trim();
  return v === "urgent" ? "urgent" : "normal";
}

export function escalationCategoryLabel(value: string | null | undefined): string {
  return ESCALATION_CATEGORY_LABEL_AR[normalizeEscalationCategory(value)];
}
