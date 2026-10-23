#pragma once

#include "ledger.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

struct ObligationBacking {
  std::string obligation_id;
  Amount required = 0;
  Amount executed = 0;
  Amount active_backing = 0;
  bool fully_backed = false;
};

struct AuditReport {
  Amount deposited = 0;
  Amount active_free = 0;
  Amount active_reserved = 0;
  Amount withdrawn = 0;
  Amount executed = 0;
  Amount impaired = 0;
  Amount nominal_accounted = 0;
  Amount consolidated_historical = 0;
  std::uint64_t active_fragments = 0;
  std::uint64_t open_obligations = 0;
  std::uint64_t underbacked_obligations = 0;
  bool nominal_conserved = false;
  bool economic_origin_preserved = false;
  std::vector<ObligationBacking> obligations;
};

AuditReport audit_ledger(const Ledger& ledger);

}  // namespace mosaicdtl
