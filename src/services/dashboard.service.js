import { LEAD_STATUSES, LEAD_TYPES } from "../config/leads.js";
import * as dashboardRepo from "../repositories/dashboard.repository.js";
import { scopeFor } from "./lead.service.js";

const typeLabel = (key) => {
  const type = LEAD_TYPES.find((t) => (t.key ?? t) === key);
  return type?.label ?? key;
};

/** Everything the dashboard shows, for the leads this user can see. */
export async function getDashboard(user) {
  const scope = scopeFor(user);

  const [statusRows, totals, byLocation, byType, recent, followupsDue] = await Promise.all([
    dashboardRepo.countByStatus(scope),
    dashboardRepo.findTotals(scope),
    dashboardRepo.countByLocation(scope),
    dashboardRepo.countByType(scope),
    dashboardRepo.findRecent(scope),
    dashboardRepo.findFollowupsDue(scope),
  ]);

  // Every status in workflow order, including the ones with no leads
  const byStatus = LEAD_STATUSES.map((s) => {
    const row = statusRows.find((r) => r.status === s.key);
    return { key: s.key, label: s.label, count: row?.count || 0, value: row?.value || 0 };
  });
  const count = (key) => byStatus.find((s) => s.key === key)?.count || 0;

  const won = count("finalized");
  const lost = count("not_interested") + count("cancelled");

  return {
    total: byStatus.reduce((sum, s) => sum + s.count, 0),
    today: totals.today,
    thisWeek: totals.this_week,
    thisMonth: totals.this_month,
    // Of the leads that reached an outcome, how many booked
    conversionRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
    byStatus,

    sales: {
      quotationValue: totals.quotation_value,
      invoiceValue: totals.invoice_value,
      estimated: totals.quotation_value + totals.invoice_value,
      openDeals: totals.open_deals,
      booked: totals.booked_value,
      bookings: won,
      advanceCollected: totals.advance_collected,
      paidInvoices: totals.paid_invoices,
      balanceUpcoming: totals.balance_upcoming,
    },

    attention: {
      uncontacted: totals.uncontacted,
      unassigned: totals.unassigned,
      overdueFollowups: totals.overdue_followups,
      staleQuotes: totals.stale_quotes,
      awaitingAdvance: totals.awaiting_advance,
      upcomingUnconfirmed: totals.upcoming_unconfirmed,
    },

    byLocation: byLocation.map((r) => ({ key: r.id, label: r.name || "Unknown", value: r.count })),
    byType: byType.map((r) => ({ key: r.type, label: typeLabel(r.type), value: r.count })),
    recent: recent.map((l) => ({ ...l, leadTypeLabel: typeLabel(l.leadType) })),
    followupsDue,
  };
}