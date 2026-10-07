/**
 * Server-only EmailJS sender (merchant sign-up / password-reset codes).
 * All EmailJS keys (including the public key) are read from server secrets at
 * call time and never reach the browser. This file must never be imported by
 * client code (the `.server.ts` suffix blocks it from client bundles).
 *
 * Requires in the EmailJS dashboard: Account -> Security ->
 * "Allow EmailJS API for non-browser applications" enabled.
 */
export type EmailJsPurpose = "signup" | "password_reset";

export async function sendEmailJsCode(input: {
  to: string;
  code: string;
  purpose: EmailJsPurpose;
}): Promise<void> {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
  const templateId =
    input.purpose === "signup"
      ? process.env.EMAILJS_TEMPLATE_SIGNUP?.trim()
      : process.env.EMAILJS_TEMPLATE_RESET?.trim();

  const missing = [
    !serviceId && "EMAILJS_SERVICE_ID",
    !publicKey && "EMAILJS_PUBLIC_KEY",
    !privateKey && "EMAILJS_PRIVATE_KEY",
    !templateId &&
      (input.purpose === "signup" ? "EMAILJS_TEMPLATE_SIGNUP" : "EMAILJS_TEMPLATE_RESET"),
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing EmailJS secrets: ${missing.join(", ")}`);

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: input.to,
        code: input.code,
        valid_minutes: "10",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`EmailJS send failed [${res.status}]: ${body}`);
    throw new Error(`EmailJS send failed [${res.status}]`);
  }
}
