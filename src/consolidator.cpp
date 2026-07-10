#include "consolidator.hpp"

#include "amount.hpp"

#include <algorithm>
#include <set>
#include <stdexcept>

namespace mosaicdtl {

namespace {

bool route_selected(const std::vector<std::string>& source_routes, const std::string& route_id) {
  return std::find(source_routes.begin(), source_routes.end(), route_id) != source_routes.end();
}

Priority stronger_priority(Priority lhs, Priority rhs) {
  return priority_at_least(lhs, rhs) ? lhs : rhs;
}

}  // namespace

ConsolidationPlan build_consolidation_plan(
    std::uint64_t receipt_id,
    std::uint64_t output_fragment_id,
    const std::vector<Fragment>& fragments,
    const std::string& vault_id,
    const std::vector<std::string>& source_routes,
    const std::string& target_route_id,
    const std::string& operator_id,
    Priority priority_floor) {
  if (source_routes.empty()) {
    throw std::invalid_argument("consolidation requires at least one source route");
  }

  ConsolidationPlan plan;
  plan.receipt.id = receipt_id;
  plan.receipt.vault_id = vault_id;
  plan.receipt.target_route_id = target_route_id;
  plan.receipt.operator_id = operator_id;
  plan.output.id = output_fragment_id;
  plan.output.vault_id = vault_id;
  plan.output.route_id = target_route_id;
  plan.output.operator_id = operator_id;
  plan.output.state = FragmentState::Active;
  plan.output.priority = priority_floor;

  std::set<std::string> reserved_obligations;
  std::uint64_t max_generation = 0;

  for (const auto& fragment : fragments) {
    if (!fragment.active()) {
      continue;
    }
    if (fragment.vault_id != vault_id) {
      continue;
    }
    if (!route_selected(source_routes, fragment.route_id)) {
      continue;
    }
    if (!priority_at_least(fragment.priority, priority_floor)) {
      continue;
    }

    plan.output.amount = checked_add(plan.output.amount, fragment.amount, "consolidation.total");
    plan.output.priority = stronger_priority(plan.output.priority, fragment.priority);
    max_generation = std::max(max_generation, fragment.generation);
    plan.output.parent_ids.push_back(fragment.id);
    plan.receipt.parent_fragment_ids.push_back(fragment.id);

    if (fragment.kind == FragmentKind::Reserved) {
      plan.receipt.reserved_amount =
          checked_add(plan.receipt.reserved_amount, fragment.amount, "consolidation.reserved");
      if (!fragment.obligation_id.empty()) {
        reserved_obligations.insert(fragment.obligation_id);
      }
    } else {
      plan.receipt.free_amount =
          checked_add(plan.receipt.free_amount, fragment.amount, "consolidation.free");
    }
  }

  if (plan.output.amount == 0) {
    throw std::runtime_error("no active fragments selected for consolidation");
  }

  plan.receipt.total_amount =
      checked_add(plan.receipt.free_amount, plan.receipt.reserved_amount, "consolidation.check");
  if (plan.receipt.total_amount != plan.output.amount) {
    throw std::runtime_error("consolidation total mismatch");
  }

  plan.receipt.mixed_reserved_and_free =
      plan.receipt.free_amount > 0 && plan.receipt.reserved_amount > 0;

  const bool one_reserved_origin =
      plan.receipt.free_amount == 0 && reserved_obligations.size() == 1;

  if (one_reserved_origin) {
    plan.output.kind = FragmentKind::Reserved;
    plan.output.obligation_id = *reserved_obligations.begin();
    plan.receipt.preserved_obligation_id = plan.output.obligation_id;
  } else {
    plan.output.kind = FragmentKind::Free;
    plan.output.obligation_id.clear();
  }

  plan.output.generation = max_generation + 1;
  plan.receipt.economic_origin_preserved =
      plan.receipt.reserved_amount == 0 || one_reserved_origin;
  return plan;
}

}  // namespace mosaicdtl
