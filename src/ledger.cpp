#include "ledger.hpp"

#include "amount.hpp"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace mosaicdtl {

void Ledger::register_vault(std::string id, std::string owner) {
  require_identifier(id, "vault_id");
  require_identifier(owner, "owner");
  if (vaults_.count(id) != 0) {
    throw std::invalid_argument("vault already registered");
  }
  Vault vault;
  vault.id = std::move(id);
  vault.owner = std::move(owner);
  vaults_.emplace(vault.id, vault);
  events_.append(EventKind::VaultRegistered, vault.id, "vault registered", 0);
}

void Ledger::register_operator(
    std::string id,
    Amount max_route_capacity,
    std::uint32_t max_open_fragments) {
  require_identifier(id, "operator_id");
  if (operators_.count(id) != 0) {
    throw std::invalid_argument("operator already registered");
  }
  OperatorProfile profile;
  profile.id = std::move(id);
  profile.max_route_capacity = max_route_capacity;
  profile.max_open_fragments = max_open_fragments;
  operators_.emplace(profile.id, profile);
  events_.append(EventKind::OperatorRegistered, profile.id, "operator registered", max_route_capacity);
}

void Ledger::register_route(std::string id, std::string operator_id, Amount capacity, Priority floor) {
  require_identifier(id, "route_id");
  require_operator_active(operator_id);
  if (routes_.count(id) != 0) {
    throw std::invalid_argument("route already registered");
  }
  const auto& profile = operators_.at(operator_id);
  if (capacity > profile.max_route_capacity) {
    throw std::invalid_argument("route capacity exceeds operator policy");
  }
  Route route;
  route.id = std::move(id);
  route.operator_id = std::move(operator_id);
  route.capacity = capacity;
  route.priority_floor = static_cast<Amount>(floor);
  routes_.emplace(route.id, route);
  events_.append(EventKind::RouteRegistered, route.id, "route registered", capacity);
}

std::uint64_t Ledger::deposit(const std::string& vault_id, Amount amount, const std::string& memo) {
  require_vault(vault_id);
  if (amount == 0) {
    throw std::invalid_argument("deposit amount is zero");
  }
  auto& vault = vaults_.at(vault_id);
  vault.deposited = checked_add(vault.deposited, amount, "vault.deposit");

  Fragment fragment;
  fragment.vault_id = vault_id;
  fragment.amount = amount;
  fragment.kind = FragmentKind::Free;
  fragment.state = FragmentState::Active;
  fragment.priority = Priority::Normal;
  fragment.generation = 1;
  const auto id = append_fragment(std::move(fragment));
  events_.append(EventKind::Deposit, vault_id, memo, amount);
  return id;
}

std::vector<std::uint64_t> Ledger::assign_free(
    const std::string& vault_id,
    const std::string& route_id,
    const std::string& operator_id,
    Amount amount,
    Priority priority,
    const std::string& memo) {
  require_vault(vault_id);
  require_route_open(route_id);
  require_operator_active(operator_id);
  TransformTarget target;
  target.kind = FragmentKind::Free;
  target.state = FragmentState::Active;
  target.route_id = route_id;
  target.operator_id = operator_id;
  target.priority = priority;
  target.memo = memo;
  auto ids = consume_free(vault_id, amount, target);
  events_.append(EventKind::Allocation, route_id, memo, amount);
  return ids;
}

std::vector<std::uint64_t> Ledger::reserve(
    const std::string& vault_id,
    const std::string& route_id,
    const std::string& operator_id,
    const std::string& obligation_id,
    Amount amount,
    Priority priority) {
  require_identifier(obligation_id, "obligation_id");
  require_vault(vault_id);
  require_route_open(route_id);
  require_operator_active(operator_id);
  if (amount == 0) {
    throw std::invalid_argument("reservation amount is zero");
  }

  auto& obligation = obligations_[obligation_id];
  if (obligation.id.empty()) {
    obligation.id = obligation_id;
    obligation.vault_id = vault_id;
    obligation.route_id = route_id;
    obligation.operator_id = operator_id;
  }
  if (obligation.vault_id != vault_id || obligation.route_id != route_id) {
    throw std::invalid_argument("obligation terms cannot be changed");
  }
  obligation.amount = checked_add(obligation.amount, amount, "obligation.amount");

  TransformTarget target;
  target.kind = FragmentKind::Reserved;
  target.state = FragmentState::Active;
  target.route_id = route_id;
  target.operator_id = operator_id;
  target.obligation_id = obligation_id;
  target.priority = priority;
  target.memo = "reserve obligation";
  auto ids = consume_free(vault_id, amount, target);
  events_.append(EventKind::Reservation, obligation_id, "reserved for obligation", amount);
  return ids;
}

std::vector<std::uint64_t> Ledger::withdraw_free(
    const std::string& vault_id,
    Amount amount,
    const std::string& beneficiary) {
  require_vault(vault_id);
  require_identifier(beneficiary, "beneficiary");
  TransformTarget target;
  target.kind = FragmentKind::Free;
  target.state = FragmentState::Withdrawn;
  target.priority = Priority::Low;
  target.memo = beneficiary;
  auto ids = consume_free(vault_id, amount, target);
  events_.append(EventKind::Withdrawal, beneficiary, "free liquidity withdrawn", amount);
  return ids;
}

bool Ledger::execute_obligation(const std::string& obligation_id) {
  const auto obligation_it = obligations_.find(obligation_id);
  if (obligation_it == obligations_.end()) {
    throw std::invalid_argument("unknown obligation");
  }
  const auto& obligation = obligation_it->second;
  const Amount remaining_due = checked_sub(obligation.amount, obligation.executed, "obligation.remaining");
  if (remaining_due == 0 || obligation.cancelled) {
    return true;
  }
  if (active_reserved_for_obligation(obligation_id) < remaining_due) {
    events_.append(EventKind::ExecutionBlocked, obligation_id, "insufficient reserved backing", remaining_due);
    return false;
  }

  Amount remaining = remaining_due;
  std::vector<Fragment> executed_children;
  for (auto& fragment : fragments_) {
    if (remaining == 0) {
      break;
    }
    if (!fragment.reserved() || fragment.obligation_id != obligation_id) {
      continue;
    }
    const Amount take = min_amount(fragment.amount, remaining);
    fragment.amount = checked_sub(fragment.amount, take, "execute.fragment");
    if (fragment.amount == 0) {
      fragment.state = FragmentState::Closed;
    }

    Fragment child = fragment;
    child.id = 0;
    child.amount = take;
    child.state = FragmentState::Executed;
    child.parent_ids.clear();
    child.parent_ids.push_back(fragment.id);
    executed_children.push_back(std::move(child));
    remaining = checked_sub(remaining, take, "execute.remaining");
  }

  for (auto& child : executed_children) {
    append_fragment(std::move(child));
  }

  obligations_[obligation_id].executed =
      checked_add(obligations_[obligation_id].executed, remaining_due, "obligation.executed");
  events_.append(EventKind::Execution, obligation_id, "obligation executed", remaining_due);
  return true;
}

ConsolidationReceipt Ledger::consolidate(
    const std::string& vault_id,
    const std::vector<std::string>& source_routes,
    const std::string& target_route_id,
    const std::string& operator_id,
    Priority priority_floor) {
  require_vault(vault_id);
  require_route_open(target_route_id);
  require_operator_active(operator_id);
  for (const auto& route_id : source_routes) {
    require_route_open(route_id);
  }

  const auto receipt_id = next_consolidation_id_++;
  const auto output_id = next_fragment_id_++;
  auto plan = build_consolidation_plan(
      receipt_id,
      output_id,
      fragments_,
      vault_id,
      source_routes,
      target_route_id,
      operator_id,
      priority_floor);

  for (const auto parent_id : plan.receipt.parent_fragment_ids) {
    auto* fragment = find_fragment(parent_id);
    if (fragment == nullptr || !fragment->active()) {
      throw std::runtime_error("consolidation parent disappeared");
    }
    fragment->state = FragmentState::Consolidated;
  }

  fragments_.push_back(plan.output);
  plan.receipt.output_fragment_id = output_id;
  events_.append(EventKind::Consolidation, target_route_id, "fragments consolidated", plan.receipt.total_amount);
  return plan.receipt;
}

bool Ledger::close_route(const std::string& route_id) {
  auto route_it = routes_.find(route_id);
  if (route_it == routes_.end()) {
    throw std::invalid_argument("unknown route");
  }
  if (active_amount_on_route(route_id) != 0) {
    return false;
  }
  route_it->second.state = RouteState::Closed;
  events_.append(EventKind::RouteClosed, route_id, "route closed", 0);
  return true;
}

Amount Ledger::total_deposited() const {
  Amount total = 0;
  for (const auto& [_, vault] : vaults_) {
    total = checked_add(total, vault.deposited, "total.deposited");
  }
  return total;
}

Amount Ledger::total_active_free() const {
  Amount total = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.withdrawable()) {
      total = checked_add(total, fragment.amount, "total.active_free");
    }
  }
  return total;
}

Amount Ledger::total_active_reserved() const {
  Amount total = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.reserved()) {
      total = checked_add(total, fragment.amount, "total.active_reserved");
    }
  }
  return total;
}

Amount Ledger::total_withdrawn() const {
  Amount total = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.state == FragmentState::Withdrawn) {
      total = checked_add(total, fragment.amount, "total.withdrawn");
    }
  }
  return total;
}

Amount Ledger::total_executed() const {
  Amount total = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.state == FragmentState::Executed) {
      total = checked_add(total, fragment.amount, "total.executed");
    }
  }
  return total;
}

Amount Ledger::active_amount_on_route(const std::string& route_id) const {
  Amount total = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.active() && fragment.route_id == route_id) {
      total = checked_add(total, fragment.amount, "route.active");
    }
  }
  return total;
}

Amount Ledger::active_reserved_for_obligation(const std::string& obligation_id) const {
  Amount total = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.reserved() && fragment.obligation_id == obligation_id) {
      total = checked_add(total, fragment.amount, "obligation.backing");
    }
  }
  return total;
}

std::uint64_t Ledger::open_fragment_count() const {
  std::uint64_t count = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.active()) {
      count += 1;
    }
  }
  return count;
}

const std::map<std::string, Vault>& Ledger::vaults() const {
  return vaults_;
}

const std::map<std::string, Route>& Ledger::routes() const {
  return routes_;
}

const std::map<std::string, OperatorProfile>& Ledger::operators() const {
  return operators_;
}

const std::map<std::string, Obligation>& Ledger::obligations() const {
  return obligations_;
}

const std::vector<Fragment>& Ledger::fragments() const {
  return fragments_;
}

const EventLog& Ledger::events() const {
  return events_;
}

std::vector<std::uint64_t> Ledger::consume_free(
    const std::string& vault_id,
    Amount amount,
    const TransformTarget& target) {
  if (amount == 0) {
    throw std::invalid_argument("amount is zero");
  }
  Amount available = 0;
  for (const auto& fragment : fragments_) {
    if (fragment.withdrawable() && fragment.vault_id == vault_id) {
      available = checked_add(available, fragment.amount, "consume.available");
    }
  }
  if (available < amount) {
    throw std::runtime_error("insufficient free liquidity");
  }

  Amount remaining = amount;
  std::vector<Fragment> children;
  for (auto& fragment : fragments_) {
    if (remaining == 0) {
      break;
    }
    if (!fragment.withdrawable() || fragment.vault_id != vault_id) {
      continue;
    }
    const Amount take = min_amount(fragment.amount, remaining);
    fragment.amount = checked_sub(fragment.amount, take, "consume.fragment");
    if (fragment.amount == 0) {
      fragment.state = FragmentState::Closed;
    }

    Fragment child;
    child.vault_id = vault_id;
    child.route_id = target.route_id;
    child.operator_id = target.operator_id;
    child.obligation_id = target.obligation_id;
    child.amount = take;
    child.priority = target.priority;
    child.kind = target.kind;
    child.state = target.state;
    child.generation = fragment.generation + 1;
    child.parent_ids.push_back(fragment.id);
    children.push_back(std::move(child));
    remaining = checked_sub(remaining, take, "consume.remaining");
  }

  std::vector<std::uint64_t> ids;
  ids.reserve(children.size());
  for (auto& child : children) {
    ids.push_back(append_fragment(std::move(child)));
  }
  return ids;
}

void Ledger::require_vault(const std::string& vault_id) const {
  require_identifier(vault_id, "vault_id");
  if (vaults_.count(vault_id) == 0) {
    throw std::invalid_argument("unknown vault");
  }
}

void Ledger::require_route_open(const std::string& route_id) const {
  require_identifier(route_id, "route_id");
  const auto route_it = routes_.find(route_id);
  if (route_it == routes_.end()) {
    throw std::invalid_argument("unknown route");
  }
  if (route_it->second.state != RouteState::Open) {
    throw std::runtime_error("route is not open");
  }
}

void Ledger::require_operator_active(const std::string& operator_id) const {
  require_identifier(operator_id, "operator_id");
  const auto operator_it = operators_.find(operator_id);
  if (operator_it == operators_.end()) {
    throw std::invalid_argument("unknown operator");
  }
  if (!operator_it->second.active) {
    throw std::runtime_error("operator is not active");
  }
}

std::uint64_t Ledger::append_fragment(Fragment fragment) {
  fragment.id = next_fragment_id_++;
  fragments_.push_back(std::move(fragment));
  return fragments_.back().id;
}

Fragment* Ledger::find_fragment(std::uint64_t id) {
  for (auto& fragment : fragments_) {
    if (fragment.id == id) {
      return &fragment;
    }
  }
  return nullptr;
}

}  // namespace mosaicdtl
