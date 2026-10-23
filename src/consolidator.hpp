#pragma once

#include "types.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

struct ConsolidationReceipt {
  std::uint64_t id = 0;
  std::string vault_id;
  std::string target_route_id;
  std::string operator_id;
  Amount total_amount = 0;
  Amount free_amount = 0;
  Amount reserved_amount = 0;
  bool mixed_reserved_and_free = false;
  bool economic_origin_preserved = true;
  std::string preserved_obligation_id;
  std::uint64_t output_fragment_id = 0;
  std::vector<std::uint64_t> output_fragment_ids;
  std::vector<std::uint64_t> parent_fragment_ids;
};

struct ConsolidationPlan {
  std::vector<Fragment> outputs;
  ConsolidationReceipt receipt;
};

ConsolidationPlan build_consolidation_plan(
    std::uint64_t receipt_id,
    std::uint64_t output_fragment_id,
    const std::vector<Fragment>& fragments,
    const std::string& vault_id,
    const std::vector<std::string>& source_routes,
    const std::string& target_route_id,
    const std::string& operator_id,
    Priority priority_floor);

}  // namespace mosaicdtl
