"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createServiceClient } from "@/shared/supabase/server";

export type ContactField = "name" | "email" | "phone" | "message";
export type ContactValues = Record<ContactField, string>;

/** Message keys under `contact.errors`; the form translates them in the visitor's locale. */
export type ContactErrorKey =
  | "nameRequired"
  | "emailRequired"
  | "emailInvalid"
  | "phoneRequired"
  | "phoneInvalid"
  | "messageRequired"
  | "generic";

export type ContactState = {
  status: "idle" | "invalid" | "error" | "success";
  /** Echoed back so the fields keep what the visitor typed. */
  values: ContactValues;
  fieldErrors: Partial<Record<ContactField, ContactErrorKey>>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()\-]{7,20}$/;

function read(formData: FormData, key: ContactField): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII, so a number typed on a Persian keyboard validates. */
function asciiDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailHtml(v: ContactValues): string {
  return `
    <div style="font-family: sans-serif; padding: 20px; color: #111;">
      <h2>New Project Proposal</h2>
      <p><strong>Name:</strong> ${escapeHtml(v.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(v.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(v.phone)}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p><strong>Project Details:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(v.message)}</p>
    </div>
  `;
}

/**
 * Contact form (useActionState). Saves the submission first (the row is the source of truth,
 * readable in the admin), then emails the studio via Resend. An email failure is recorded on
 * the row and is not shown to the visitor.
 */
export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const values: ContactValues = {
    name: read(formData, "name"),
    email: read(formData, "email"),
    phone: asciiDigits(read(formData, "phone")),
    message: read(formData, "message"),
  };

  const fieldErrors: ContactState["fieldErrors"] = {};
  if (!values.name) fieldErrors.name = "nameRequired";
  if (!values.email) fieldErrors.email = "emailRequired";
  else if (!EMAIL_RE.test(values.email)) fieldErrors.email = "emailInvalid";
  if (!values.phone) fieldErrors.phone = "phoneRequired";
  else if (!PHONE_RE.test(values.phone)) fieldErrors.phone = "phoneInvalid";
  if (!values.message) fieldErrors.message = "messageRequired";
  if (Object.keys(fieldErrors).length > 0) return { status: "invalid", values, fieldErrors };

  const failed: ContactState = { status: "error", values, fieldErrors: {} };

  try {
    // 1. Save first.
    const supabase = createServiceClient();
    const { data: inserted, error: insertError } = await supabase
      .from("contact_submissions")
      .insert({ name: values.name, email: values.email, phone: values.phone, message: values.message })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("contact_submissions insert failed:", insertError);
      return failed;
    }

    // 2. Email the studio. Failure is non-fatal and recorded on the row.
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_CONTACT_EMAIL;
    const from = process.env.RESEND_FROM || "Contact Form <onboarding@resend.dev>";

    let emailError: string | null = null;
    if (!apiKey || !adminEmail) {
      emailError = `env ${!apiKey ? "RESEND_API_KEY" : "ADMIN_CONTACT_EMAIL"} not set`;
    } else {
      try {
        const { error } = await new Resend(apiKey).emails.send({
          from,
          to: [adminEmail],
          replyTo: values.email,
          subject: `New Project Proposal from ${values.name}`,
          html: emailHtml(values),
        });
        if (error) emailError = error.message || "unknown resend error";
      } catch (mailErr) {
        emailError = mailErr instanceof Error ? mailErr.message : String(mailErr);
      }
    }
    if (emailError) console.error("Contact email not sent:", emailError);

    const { error: updateError } = await supabase
      .from("contact_submissions")
      .update(emailError ? { email_sent: false, email_error: emailError } : { email_sent: true })
      .eq("id", inserted.id);
    if (updateError) console.error("contact_submissions email status update failed:", updateError);

    // 3. The admin's submissions list.
    revalidatePath("/[locale]/admin", "page");

    return { status: "success", values, fieldErrors: {} };
  } catch (err) {
    console.error("Contact form submission error:", err);
    return failed;
  }
}
