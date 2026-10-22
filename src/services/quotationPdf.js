import puppeteer from "puppeteer";
import { buildPath, saveFile } from "../utils/storage.js";

const money = (n) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const date = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const escape = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The quotation as an HTML page, which Puppeteer turns into the PDF. */
function buildHtml(quotation, context) {
  const venue = [context.location_address, context.location_city, context.location_state]
    .filter(Boolean)
    .join(", ");

  const rows = quotation.items
    .map(
      (item, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${escape(item.description)}</td>
        <td class="right">${item.qty}</td>
        <td class="right">${money(item.rate)}</td>
        <td class="right">${money(item.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; font-size: 12px; margin: 0; padding: 32px 36px;
  }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 14px; }
  .brand { font-size: 20px; font-weight: 700; color: #111827; }
  .venue { margin-top: 4px; color: #6b7280; font-size: 11px; line-height: 1.5; }
  .doc { text-align: right; }
  .doc h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 0.04em; text-transform: uppercase; }
  .doc p { margin: 2px 0; color: #6b7280; font-size: 11px; }

  .panels { display: flex; gap: 28px; margin: 22px 0; }
  .panel { flex: 1; }
  .panel h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 0 0 6px; }
  .panel p { margin: 2px 0; }
  .panel .name { font-weight: 600; font-size: 13px; }

  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 10px;
       text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
  td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; }
  .right { text-align: right; }
  .num { width: 28px; color: #9ca3af; }

  .totals { margin-top: 14px; margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #111827; margin-top: 6px; padding-top: 8px;
                   font-size: 14px; font-weight: 700; color: #111827; }

  .notes { margin-top: 24px; padding: 12px 14px; background: #f9fafb; border-radius: 4px; font-size: 11px; }
  .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 12px;
            color: #6b7280; font-size: 10px; line-height: 1.6; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escape(context.brand_name)}</div>
      <div class="venue">
        ${escape(context.location_name)}${venue ? `<br>${escape(venue)}` : ""}
        ${context.location_phone ? `<br>${escape(context.location_phone)}` : ""}
      </div>
    </div>
    <div class="doc">
      <h1>Quotation</h1>
      <p><strong>${escape(quotation.quotationCode)}</strong>${quotation.version > 1 ? ` v${quotation.version}` : ""}</p>
      <p>Date: ${date(quotation.createdAt || new Date())}</p>
      <p>Valid until: ${date(quotation.validUntil)}</p>
    </div>
  </div>

  <div class="panels">
    <div class="panel">
      <h2>Prepared for</h2>
      <p class="name">${escape(context.customer_name || `${context.first_name} ${context.last_name || ""}`)}</p>
      ${context.company_name ? `<p>${escape(context.company_name)}</p>` : ""}
      <p>${escape(context.mobile)}</p>
      ${context.email ? `<p>${escape(context.email)}</p>` : ""}
    </div>
    <div class="panel">
      <h2>Event</h2>
      <p>Date: ${date(context.event_date)}</p>
      ${context.event_time_slot ? `<p>Time: ${escape(context.event_time_slot)}</p>` : ""}
      <p>Guests: ${context.guests || "—"}${context.kids ? ` (${context.kids} kids)` : ""}</p>
      <p>Reference: ${escape(context.lead_code)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th><th>Description</th>
        <th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${money(quotation.subtotal)}</span></div>
        ${quotation.discountAmount > 0
      ? `<div><span>Discount${quotation.discountType === "percentage" ? ` (${quotation.discount}%)` : ""}</span><span>− ${money(quotation.discountAmount)}</span></div>`
      : ""}
    <div><span>GST (${quotation.taxRate}%)</span><span>${money(quotation.taxAmount)}</span></div>
    <div class="grand"><span>Total</span><span>${money(quotation.total)}</span></div>
  </div>

  ${quotation.notes ? `<div class="notes">${escape(quotation.notes).replace(/\n/g, "<br>")}</div>` : ""}

  <div class="footer">
    ${context.poc_name ? `Your event coordinator: ${escape(context.poc_name)}${context.poc_mobile ? `, ${escape(context.poc_mobile)}` : ""}${context.poc_email ? `, ${escape(context.poc_email)}` : ""}<br>` : ""}
    This quotation is an estimate and does not confirm a booking. Prices are valid for the date and guest
    count shown above. A booking is confirmed only once the advance payment is received.
  </div>
</body>
</html>`;
}

/**
 * Renders the quotation and writes it to storage.
 * Returns the relative path to save on the row.
 */
export async function generateQuotationPdf(quotation, context) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(quotation, context), { waitUntil: "networkidle0" });

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    const fileName = `${quotation.quotationCode}-v${quotation.version}.pdf`;
    const relativePath = buildPath("quotations", fileName);
    await saveFile(relativePath, buffer);
    return relativePath;
  } finally {
    // Always close, or Chromium processes pile up on the server
    await browser.close();
  }
}