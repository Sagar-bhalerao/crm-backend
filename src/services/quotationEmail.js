const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const date = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

const escape = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Subject and HTML body for a quotation email. */
export function buildQuotationEmail(lead, quotation, context) {
  const firstName = lead.firstName || lead.name;

  const subject = `Your quotation from ${context.brand_name} ${context.location_name} — ${quotation.quotationCode}`;

  const body = `
<div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1f2937; max-width: 580px; line-height: 1.6;">
  <p>Hi ${escape(firstName)},</p>

  <p>
    Thank you for your interest in hosting your event at
    <strong>${escape(context.brand_name)}, ${escape(context.location_name)}</strong>.
    Your quotation is attached as a PDF.
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    <tr>
      <td style="padding: 8px 0; color: #6b7280; width: 160px;">Quotation</td>
      <td style="padding: 8px 0;"><strong>${escape(quotation.quotationCode)}</strong>${quotation.version > 1 ? ` (v${quotation.version})` : ""}</td>
    </tr>
    ${lead.eventDate ? `<tr><td style="padding: 8px 0; color: #6b7280;">Event date</td><td style="padding: 8px 0;">${date(lead.eventDate)}</td></tr>` : ""}
    ${lead.guests ? `<tr><td style="padding: 8px 0; color: #6b7280;">Guests</td><td style="padding: 8px 0;">${lead.guests}</td></tr>` : ""}
    <tr>
      <td style="padding: 8px 0; color: #6b7280;">Total</td>
      <td style="padding: 8px 0; font-size: 16px;"><strong>${money(quotation.total)}</strong> (incl. GST)</td>
    </tr>
    ${quotation.validUntil ? `<tr><td style="padding: 8px 0; color: #6b7280;">Valid until</td><td style="padding: 8px 0;">${date(quotation.validUntil)}</td></tr>` : ""}
  </table>

  ${quotation.notes ? `<p style="background: #f9fafb; padding: 12px 14px; border-radius: 4px; font-size: 14px;">${escape(quotation.notes).replace(/\n/g, "<br>")}</p>` : ""}

  <p>
    Do reply to this email or call us if you would like anything changed, or have questions about what is included.
  </p>

  <p style="margin-top: 24px;">
    Warm regards,<br>
    ${context.poc_name ? `<strong>${escape(context.poc_name)}</strong><br>` : ""}
    ${escape(context.brand_name)}, ${escape(context.location_name)}
    ${context.poc_mobile ? `<br>${escape(context.poc_mobile)}` : ""}
  </p>

  <p style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    This quotation is an estimate and does not confirm a booking. A booking is confirmed only once the
    advance payment is received.
  </p>
</div>`.trim();

  return { subject, body };
}