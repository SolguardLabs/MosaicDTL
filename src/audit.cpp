#include "audit.hpp"

#include "amount.hpp"

namespace mosaicdtl {

AuditReport audit_ledger(const Ledger& ledger) {
  AuditReport report;
  report.deposited = ledger.total_deposited();
  report.active_free = ledger.total_active_free();
  report.active_reserved = ledger.total_active_reserved();
  report.withdrawn = ledger.total_withdrawn();
  report.executed = ledger.total_executed();
  report.impaired = ledger.total_impaired();
  report.active_fragments = ledger.open_fragment_count();

  for (const auto& fragment : ledger.fragments()) {
    if (fragment.state == FragmentState::Consolidated) {
      report.consolidated_historical =
          checked_add(report.consolidated_historical, fragment.amount, "audit.consolidated");
    }
  }

  report.nominal_accounted = checked_add(report.active_free, report.active_reserved, "audit.nominal.1");
  report.nominal_accounted = checked_add(report.nominal_accounted, report.withdrawn, "audit.nominal.2");
  report.nominal_accounted = checked_add(report.nominal_accounted, report.executed, "audit.nominal.3");
  report.nominal_accounted = checked_add(report.nominal_accounted, report.impaired, "audit.nominal.4");
  report.nominal_conserved = report.nominal_accounted == report.deposited;

  for (const auto& [_, obligation] : ledger.obligations()) {
    if (obligation.cancelled || obligation.executed >= obligation.amount) {
      continue;
    }
    report.open_obligations += 1;
    ObligationBacking backing;
    backing.obligation_id = obligation.id;
    backing.required = checked_sub(obligation.amount, obligation.executed, "audit.obligation.required");
    backing.executed = obligation.executed;
    backing.active_backing = ledger.active_reserved_for_obligation(obligation.id);
    backing.fully_backed = backing.active_backing >= backing.required;
    if (!backing.fully_backed) {
      report.underbacked_obligations += 1;
    }
    report.obligations.push_back(backing);
  }

  report.economic_origin_preserved = report.underbacked_obligations == 0;
  return report;
}

}  // namespace mosaicdtl
