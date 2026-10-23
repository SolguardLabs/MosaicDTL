#include "consolidator.hpp"

#include "amount.hpp"

#include <algorithm>
#include <map>
#include <set>
#include <stdexcept>
#include <utility>

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

  std::set<std::string> reserved_obligations;
  std::map<std::string, Fragment> grouped;

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

    const bool reserved = fragment.kind == FragmentKind::Reserved;
    if (reserved && fragment.obligation_id.empty()) {
      throw std::runtime_error("reserved fragment lacks obligation");
    }
    const std::string key = reserved ? "reserved:" + fragment.obligation_id : "free";
    auto& output = grouped[key];
    if (output.vault_id.empty()) {
      output.vault_id = vault_id;
      output.route_id = target_route_id;
      output.operator_id = operator_id;
      output.state = FragmentState::Active;
      output.priority = priority_floor;
      output.kind = reserved ? FragmentKind::Reserved : FragmentKind::Free;
      output.obligation_id = reserved ? fragment.obligation_id : "";
    }
    output.amount = checked_add(output.amount, fragment.amount, "consolidation.total");
    output.priority = stronger_priority(output.priority, fragment.priority);
    output.generation = std::max(output.generation, fragment.generation + 1);
    output.parent_ids.push_back(fragment.id);
    plan.receipt.parent_fragment_ids.push_back(fragment.id);

    if (reserved) {
      plan.receipt.reserved_amount =
          checked_add(plan.receipt.reserved_amount, fragment.amount, "consolidation.reserved");
      reserved_obligations.insert(fragment.obligation_id);
    } else {
      plan.receipt.free_amount =
          checked_add(plan.receipt.free_amount, fragment.amount, "consolidation.free");
    }
  }

  if (grouped.empty()) {
    throw std::runtime_error("no active fragments selected for consolidation");
  }

  plan.receipt.total_amount =
      checked_add(plan.receipt.free_amount, plan.receipt.reserved_amount, "consolidation.check");
  plan.receipt.mixed_reserved_and_free =
      plan.receipt.free_amount > 0 && plan.receipt.reserved_amount > 0;
  if (plan.receipt.free_amount == 0 && reserved_obligations.size() == 1) {
    plan.receipt.preserved_obligation_id = *reserved_obligations.begin();
  }
  Amount output_total = 0;
  for (auto& [_, output] : grouped) {
    output.id = output_fragment_id + plan.outputs.size();
    output_total = checked_add(output_total, output.amount, "consolidation.outputs");
    plan.receipt.output_fragment_ids.push_back(output.id);
    plan.outputs.push_back(std::move(output));
  }
  if (output_total != plan.receipt.total_amount) {
    throw std::runtime_error("consolidation total mismatch");
  }
  plan.receipt.output_fragment_id = plan.receipt.output_fragment_ids.front();
  plan.receipt.economic_origin_preserved = true;
  return plan;
}

}  // namespace mosaicdtl
