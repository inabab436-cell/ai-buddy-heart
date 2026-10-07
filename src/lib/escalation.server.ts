/**
 * Writing and clearing an intervention call (استدعاء التدخل).
 *
 * ONE hard stop is honoured by the chat route: `agent_enabled = false`. The
 * status value (`needs_human`) is informational and may be rejected by a
 * database whose CHECK constraint was never widened, so it is written in a
 * separate, tolerated update and never relied upon on its own.
 *
 * The classification columns are additive (db/2026-09-21_escalation_intervention.sql).
 * A database without them still gets a correct pause + notification.
 */

import {
  normalizeEscalationCategory,
  normalizeEscalationSeverity,
  type EscalationCategory,
  type EscalationSeverity,
} from "@/lib/escalation";

function isMissingColumn(error: any): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /column .* does not exist/i.test(msg) ||
    /could not find the '.*' column/i.test(msg)
  );
}

export interface EscalationInput {
  conversationId: string;
  reason: string;
  category?: unknown;
  severity?: unknown;
}

export interface EscalationRecord {
  ok: boolean;
  category: EscalationCategory;
  severity: EscalationSeverity;
  /** Already open when the agent called again for the same unresolved issue. */
  alreadyOpen: boolean;
}

/**
 * Pauses the conversation and records the intervention call.
 * Idempotent: a second call while an intervention is still open only refreshes
 * the reason — it never creates a second notification for the same issue.
 */
export async function recordEscalation(
  admin: any,
  input: EscalationInput,
): Promise<EscalationRecord> {
  const category = normalizeEscalationCategory(input.category);
  const severity = normalizeEscalationSeverity(input.severity);
  const reason = String(input.reason ?? "").trim();
  const now = new Date().toISOString();

  // Is an intervention already open for this conversation? Read tolerantly so a
  // database without the columns still works (it falls back to the open
  // notification below).
  let alreadyOpen = false;
  const { data: convoRow, error: readErr } = await admin
    .from("conversations")
    .select("escalation_status")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (!readErr && convoRow) alreadyOpen = convoRow.escalation_status === "open";
  if (readErr && !isMissingColumn(readErr)) {
    console.error("[escalation] read failed", readErr.message);
  }

  // 1) The hard stop — always applied.
  const { error: stopErr } = await admin
    .from("conversations")
    .update({ agent_enabled: false })
    .eq("id", input.conversationId);
  if (stopErr) {
    console.error("[escalation] pause failed", stopErr.message);
    return { ok: false, category, severity, alreadyOpen };
  }

  // 2) Status + classification, degraded step by step.
  const full = {
    status: "needs_human",
    escalation_status: "open",
    escalation_category: category,
    escalation_severity: severity,
    escalation_reason: reason,
    escalated_at: now,
    escalation_resolved_at: null,
  };
  const { error: fullErr } = await admin
    .from("conversations")
    .update(full)
    .eq("id", input.conversationId);
  if (fullErr) {
    // Either the classification columns or the widened status CHECK is missing.
    await admin
      .from("conversations")
      .update({ status: "needs_human" })
      .eq("id", input.conversationId);
  }

  // 3) One open notification per intervention.
  if (!alreadyOpen) {
    const row: Record<string, unknown> = {
      type: "human_needed",
      conversation_id: input.conversationId,
      message: reason,
      is_read: false,
      escalation_category: category,
      escalation_severity: severity,
    };
    const { error: notifErr } = await admin.from("notifications").insert(row);
    if (notifErr && isMissingColumn(notifErr)) {
      await admin.from("notifications").insert({
        type: "human_needed",
        conversation_id: input.conversationId,
        message: reason,
        is_read: false,
      });
    } else if (notifErr) {
      console.error("[escalation] notification failed", notifErr.message);
    }
    try {
      const { notifyMerchantByPush, humanNeededPush } = await import(
        "@/lib/push-notify.server"
      );
      const push = humanNeededPush(reason);
      await notifyMerchantByPush({
        admin: admin as any,
        conversationId: input.conversationId,
        event: "human_needed",
        title: push.title,
        body: push.body,
        path: `/conversation/${input.conversationId}`,
      });
    } catch (e) {
      console.error("[escalation] push notify skipped", e);
    }
  }


  return { ok: true, category, severity, alreadyOpen };
}

/**
 * "تم التدخل" — the merchant handled the case. Clears the intervention flag,
 * closes its notification and (optionally) lets the agent talk again.
 */
export async function resolveEscalation(
  admin: any,
  conversationId: string,
  opts?: { resumeAgent?: boolean },
): Promise<{ ok: boolean }> {
  const resume = opts?.resumeAgent !== false;
  const now = new Date().toISOString();

  const { error: clearErr } = await admin
    .from("conversations")
    .update({
      escalation_status: "resolved",
      escalation_resolved_at: now,
    })
    .eq("id", conversationId);
  if (clearErr && !isMissingColumn(clearErr)) {
    console.error("[escalation] clear failed", clearErr.message);
  }

  if (resume) {
    const { RESUMED_STATUS_CANDIDATES, isParkedStatus } = await import(
      "@/lib/agent-resume.server"
    );
    for (const candidate of RESUMED_STATUS_CANDIDATES) {
      const { error } = await admin
        .from("conversations")
        .update({ status: candidate })
        .eq("id", conversationId);
      if (error) continue;
      const { data } = await admin
        .from("conversations")
        .select("status")
        .eq("id", conversationId)
        .maybeSingle();
      if (!isParkedStatus((data as any)?.status ?? candidate)) break;
    }
    const { error: toggleErr } = await admin
      .from("conversations")
      .update({ agent_enabled: true })
      .eq("id", conversationId);
    if (toggleErr) throw new Error(toggleErr.message ?? String(toggleErr));
  }

  // Close the open intervention notification(s) for this conversation.
  try {
    await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("type", "human_needed")
      .eq("is_read", false);
  } catch {
    /* non-fatal */
  }

  return { ok: true };
}
