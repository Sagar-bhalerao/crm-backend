const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const date = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

const escape = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Subject and HTML body for a proforma invoice email. */
export function buildInvoiceEmail(lead, invoice, context) {
  const firstName = lead.firstName || lead.name;
  const subject = `Proforma invoice from ${context.brand_name} ${context.location_name} — ${invoice.invoiceNumber}`;

  const row = (label, value) =>
    `<tr><td style="padding: 8px 0; color: #6b7280; width: 180px;">${label}</td><td style="padding: 8px 0;">${value}</td></tr>`;

  const body = `
<div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1f2937; max-width: 580px; line-height: 1.6;">
  <p>Hi ${escape(firstName)},</p>

  <p>
    Thank you for choosing <strong>${escape(context.brand_name)}, ${escape(context.location_name)}</strong>.
    Your proforma invoice is attached as a PDF.
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    ${row("Invoice", `<strong>${escape(invoice.invoiceNumber)}</strong>`)}
    ${lead.eventDate ? row("Event date", date(lead.eventDate)) : ""}
    ${row("Total", `${money(invoice.total)} (incl. GST)`)}
    ${row("Advance due now", `<strong style="font-size: 16px;">${money(invoice.advanceDue)}</strong>`)}
    ${row("Balance at the venue", money(invoice.balanceDue))}
  </table>

  <p>
    Your booking is confirmed once the advance is received. Reply to this email or call us
    for payment details, or if anything on the invoice needs changing.
  </p>

  <p style="margin-top: 24px;">
    Warm regards,<br>
    ${context.poc_name ? `<strong>${escape(context.poc_name)}</strong><br>` : ""}
    ${escape(context.brand_name)}, ${escape(context.location_name)}
    ${context.poc_mobile ? `<br>${escape(context.poc_mobile)}` : ""}
  </p>
</div>`.trim();

  return { subject, body };
}