import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function write(path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    content
      .replace(/^\n/u, "")
      .replace(/[ \t]+\n/gu, "\n")
      .trimEnd() + "\n",
  );
}

function generatedPolicyRows(count) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const route = `route-template-${String(i).padStart(4, "0")}`;
    const operator = `operator-${String(i % 37).padStart(2, "0")}`;
    const priority = i % 4;
    const limit = 50_000 + ((i * 7_919) % 900_000);
    const fee = 4 + (i % 91);
    const window = 1 + (i % 17);
    rows.push(`    {"${route}", "${operator}", ${priority}, ${limit}ULL, ${fee}, ${window}},`);
  }
  return rows.join("\n");
}

function generatedRiskRows(count) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const route = `route-template-${String(i % 160).padStart(4, "0")}`;
    const bucket = i % 29;
    const utilization = 5 + ((i * 13) % 95);
    const haircut = 10 + ((i * 11) % 250);
    const reserve = 25_000 + ((i * 4_321) % 750_000);
    rows.push(`    {"${route}", ${bucket}, ${utilization}, ${haircut}, ${reserve}ULL},`);
  }
  return rows.join("\n");
}

write(
  "src/types.hpp",
  String.raw`
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace mosaicdtl {

using Amount = std::uint64_t;

enum class Priority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3,
};

enum class FragmentKind {
  Free,
  Reserved,
};

enum class FragmentState {
  Active,
  Consolidated,
  Withdrawn,
  Executed,
  Closed,
};

enum class RouteState {
  Open,
  Frozen,
  Draining,
  Closed,
};

struct Fragment {
  std::uint64_t id = 0;
  std::string vault_id;
  std::string route_id;
  std::string operator_id;
  std::string obligation_id;
  Amount amount = 0;
  Priority priority = Priority::Normal;
  FragmentKind kind = FragmentKind::Free;
  FragmentState state = FragmentState::Active;
  std::uint64_t generation = 0;
  std::vector<std::uint64_t> parent_ids;

  bool active() const;
  bool withdrawable() const;
  bool reserved() const;
};

struct Obligation {
  std::string id;
  std::string vault_id;
  std::string route_id;
  std::string operator_id;
  Amount amount = 0;
  Amount executed = 0;
  bool cancelled = false;
};

struct Vault {
  std::string id;
  std::string owner;
  Amount deposited = 0;
};

struct Route {
  std::string id;
  std::string operator_id;
  Amount capacity = 0;
  Amount priority_floor = 0;
  RouteState state = RouteState::Open;
};

struct OperatorProfile {
  std::string id;
  Amount max_route_capacity = 0;
  std::uint32_t max_open_fragments = 0;
  bool active = true;
};

std::string priority_name(Priority priority);
std::string fragment_kind_name(FragmentKind kind);
std::string fragment_state_name(FragmentState state);
std::string route_state_name(RouteState state);
Priority priority_from_weight(Amount weight);
bool priority_at_least(Priority lhs, Priority rhs);
void require_identifier(const std::string& value, const char* field);

}  // namespace mosaicdtl
`,
);

write(
  "src/types.cpp",
  String.raw`
#include "types.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>

namespace mosaicdtl {

bool Fragment::active() const {
  return state == FragmentState::Active && amount > 0;
}

bool Fragment::withdrawable() const {
  return active() && kind == FragmentKind::Free;
}

bool Fragment::reserved() const {
  return active() && kind == FragmentKind::Reserved;
}

std::string priority_name(Priority priority) {
  switch (priority) {
    case Priority::Low:
      return "low";
    case Priority::Normal:
      return "normal";
    case Priority::High:
      return "high";
    case Priority::Critical:
      return "critical";
  }
  return "unknown";
}

std::string fragment_kind_name(FragmentKind kind) {
  switch (kind) {
    case FragmentKind::Free:
      return "free";
    case FragmentKind::Reserved:
      return "reserved";
  }
  return "unknown";
}

std::string fragment_state_name(FragmentState state) {
  switch (state) {
    case FragmentState::Active:
      return "active";
    case FragmentState::Consolidated:
      return "consolidated";
    case FragmentState::Withdrawn:
      return "withdrawn";
    case FragmentState::Executed:
      return "executed";
    case FragmentState::Closed:
      return "closed";
  }
  return "unknown";
}

std::string route_state_name(RouteState state) {
  switch (state) {
    case RouteState::Open:
      return "open";
    case RouteState::Frozen:
      return "frozen";
    case RouteState::Draining:
      return "draining";
    case RouteState::Closed:
      return "closed";
  }
  return "unknown";
}

Priority priority_from_weight(Amount weight) {
  if (weight >= 90) {
    return Priority::Critical;
  }
  if (weight >= 65) {
    return Priority::High;
  }
  if (weight >= 30) {
    return Priority::Normal;
  }
  return Priority::Low;
}

bool priority_at_least(Priority lhs, Priority rhs) {
  return static_cast<int>(lhs) >= static_cast<int>(rhs);
}

void require_identifier(const std::string& value, const char* field) {
  if (value.empty()) {
    throw std::invalid_argument(std::string(field) + " is empty");
  }
  if (value.size() > 96) {
    throw std::invalid_argument(std::string(field) + " is too long");
  }
  const bool valid = std::all_of(value.begin(), value.end(), [](unsigned char ch) {
    return std::isalnum(ch) != 0 || ch == '-' || ch == '_' || ch == '.';
  });
  if (!valid) {
    throw std::invalid_argument(std::string(field) + " contains unsupported characters");
  }
}

}  // namespace mosaicdtl
`,
);

write(
  "src/amount.hpp",
  String.raw`
#pragma once

#include "types.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

struct AmountSplit {
  Amount low = 0;
  Amount normal = 0;
  Amount high = 0;
  Amount critical = 0;
};

Amount checked_add(Amount lhs, Amount rhs, const char* context);
Amount checked_sub(Amount lhs, Amount rhs, const char* context);
Amount apply_bps(Amount amount, std::uint32_t bps);
Amount ceil_div(Amount lhs, Amount rhs);
Amount min_amount(Amount lhs, Amount rhs);
std::string amount_to_string(Amount amount);
AmountSplit split_by_priority(const std::vector<Fragment>& fragments);

}  // namespace mosaicdtl
`,
);

write(
  "src/amount.cpp",
  String.raw`
#include "amount.hpp"

#include <limits>
#include <sstream>
#include <stdexcept>

namespace mosaicdtl {

Amount checked_add(Amount lhs, Amount rhs, const char* context) {
  if (rhs > std::numeric_limits<Amount>::max() - lhs) {
    throw std::overflow_error(std::string("amount overflow in ") + context);
  }
  return lhs + rhs;
}

Amount checked_sub(Amount lhs, Amount rhs, const char* context) {
  if (rhs > lhs) {
    throw std::underflow_error(std::string("amount underflow in ") + context);
  }
  return lhs - rhs;
}

Amount apply_bps(Amount amount, std::uint32_t bps) {
  if (bps > 10'000) {
    throw std::invalid_argument("bps above 10000");
  }
  return (amount * bps) / 10'000;
}

Amount ceil_div(Amount lhs, Amount rhs) {
  if (rhs == 0) {
    throw std::invalid_argument("division by zero");
  }
  return lhs == 0 ? 0 : ((lhs - 1) / rhs) + 1;
}

Amount min_amount(Amount lhs, Amount rhs) {
  return lhs < rhs ? lhs : rhs;
}

std::string amount_to_string(Amount amount) {
  std::ostringstream out;
  out << amount;
  return out.str();
}

AmountSplit split_by_priority(const std::vector<Fragment>& fragments) {
  AmountSplit split;
  for (const auto& fragment : fragments) {
    if (!fragment.active()) {
      continue;
    }
    switch (fragment.priority) {
      case Priority::Low:
        split.low = checked_add(split.low, fragment.amount, "split.low");
        break;
      case Priority::Normal:
        split.normal = checked_add(split.normal, fragment.amount, "split.normal");
        break;
      case Priority::High:
        split.high = checked_add(split.high, fragment.amount, "split.high");
        break;
      case Priority::Critical:
        split.critical = checked_add(split.critical, fragment.amount, "split.critical");
        break;
    }
  }
  return split;
}

}  // namespace mosaicdtl
`,
);

write(
  "src/events.hpp",
  String.raw`
#pragma once

#include "types.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

enum class EventKind {
  VaultRegistered,
  OperatorRegistered,
  RouteRegistered,
  Deposit,
  Allocation,
  Reservation,
  Withdrawal,
  Consolidation,
  RouteClosed,
  Execution,
  ExecutionBlocked,
};

struct Event {
  std::uint64_t sequence = 0;
  EventKind kind = EventKind::Deposit;
  std::string subject;
  std::string detail;
  Amount amount = 0;
};

class EventLog {
 public:
  void append(EventKind kind, std::string subject, std::string detail, Amount amount);
  const std::vector<Event>& entries() const;
  std::uint64_t size() const;

 private:
  std::uint64_t next_sequence_ = 1;
  std::vector<Event> entries_;
};

std::string event_kind_name(EventKind kind);

}  // namespace mosaicdtl
`,
);

write(
  "src/events.cpp",
  String.raw`
#include "events.hpp"

#include <utility>

namespace mosaicdtl {

void EventLog::append(EventKind kind, std::string subject, std::string detail, Amount amount) {
  Event event;
  event.sequence = next_sequence_++;
  event.kind = kind;
  event.subject = std::move(subject);
  event.detail = std::move(detail);
  event.amount = amount;
  entries_.push_back(std::move(event));
}

const std::vector<Event>& EventLog::entries() const {
  return entries_;
}

std::uint64_t EventLog::size() const {
  return entries_.size();
}

std::string event_kind_name(EventKind kind) {
  switch (kind) {
    case EventKind::VaultRegistered:
      return "vault_registered";
    case EventKind::OperatorRegistered:
      return "operator_registered";
    case EventKind::RouteRegistered:
      return "route_registered";
    case EventKind::Deposit:
      return "deposit";
    case EventKind::Allocation:
      return "allocation";
    case EventKind::Reservation:
      return "reservation";
    case EventKind::Withdrawal:
      return "withdrawal";
    case EventKind::Consolidation:
      return "consolidation";
    case EventKind::RouteClosed:
      return "route_closed";
    case EventKind::Execution:
      return "execution";
    case EventKind::ExecutionBlocked:
      return "execution_blocked";
  }
  return "unknown";
}

}  // namespace mosaicdtl
`,
);

write(
  "src/json.hpp",
  String.raw`
#pragma once

#include "types.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

std::string json_quote(const std::string& value);
std::string json_bool(bool value);
std::string json_amount(Amount amount);
std::string json_string_array(const std::vector<std::string>& values);
std::string json_uint_array(const std::vector<std::uint64_t>& values);

}  // namespace mosaicdtl
`,
);

write(
  "src/json.cpp",
  String.raw`
#include "json.hpp"

#include "amount.hpp"

#include <sstream>

namespace mosaicdtl {

std::string json_quote(const std::string& value) {
  std::ostringstream out;
  out << '"';
  for (const unsigned char ch : value) {
    switch (ch) {
      case '"':
        out << "\\\"";
        break;
      case '\\':
        out << "\\\\";
        break;
      case '\b':
        out << "\\b";
        break;
      case '\f':
        out << "\\f";
        break;
      case '\n':
        out << "\\n";
        break;
      case '\r':
        out << "\\r";
        break;
      case '\t':
        out << "\\t";
        break;
      default:
        if (ch < 0x20) {
          out << "\\u00";
          const char* hex = "0123456789abcdef";
          out << hex[(ch >> 4) & 0x0f] << hex[ch & 0x0f];
        } else {
          out << static_cast<char>(ch);
        }
        break;
    }
  }
  out << '"';
  return out.str();
}

std::string json_bool(bool value) {
  return value ? "true" : "false";
}

std::string json_amount(Amount amount) {
  return amount_to_string(amount);
}

std::string json_string_array(const std::vector<std::string>& values) {
  std::ostringstream out;
  out << '[';
  for (std::size_t i = 0; i < values.size(); i += 1) {
    if (i != 0) {
      out << ',';
    }
    out << json_quote(values[i]);
  }
  out << ']';
  return out.str();
}

std::string json_uint_array(const std::vector<std::uint64_t>& values) {
  std::ostringstream out;
  out << '[';
  for (std::size_t i = 0; i < values.size(); i += 1) {
    if (i != 0) {
      out << ',';
    }
    out << values[i];
  }
  out << ']';
  return out.str();
}

}  // namespace mosaicdtl
`,
);

write(
  "src/consolidator.hpp",
  String.raw`
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
  std::vector<std::uint64_t> parent_fragment_ids;
};

struct ConsolidationPlan {
  Fragment output;
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
`,
);

write(
  "src/consolidator.cpp",
  String.raw`
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
`,
);

write(
  "src/ledger.hpp",
  String.raw`
#pragma once

#include "consolidator.hpp"
#include "events.hpp"
#include "types.hpp"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace mosaicdtl {

class Ledger {
 public:
  void register_vault(std::string id, std::string owner);
  void register_operator(std::string id, Amount max_route_capacity, std::uint32_t max_open_fragments);
  void register_route(std::string id, std::string operator_id, Amount capacity, Priority floor);

  std::uint64_t deposit(const std::string& vault_id, Amount amount, const std::string& memo);
  std::vector<std::uint64_t> assign_free(
      const std::string& vault_id,
      const std::string& route_id,
      const std::string& operator_id,
      Amount amount,
      Priority priority,
      const std::string& memo);
  std::vector<std::uint64_t> reserve(
      const std::string& vault_id,
      const std::string& route_id,
      const std::string& operator_id,
      const std::string& obligation_id,
      Amount amount,
      Priority priority);
  std::vector<std::uint64_t> withdraw_free(
      const std::string& vault_id,
      Amount amount,
      const std::string& beneficiary);
  bool execute_obligation(const std::string& obligation_id);
  ConsolidationReceipt consolidate(
      const std::string& vault_id,
      const std::vector<std::string>& source_routes,
      const std::string& target_route_id,
      const std::string& operator_id,
      Priority priority_floor);
  bool close_route(const std::string& route_id);

  Amount total_deposited() const;
  Amount total_active_free() const;
  Amount total_active_reserved() const;
  Amount total_withdrawn() const;
  Amount total_executed() const;
  Amount active_amount_on_route(const std::string& route_id) const;
  Amount active_reserved_for_obligation(const std::string& obligation_id) const;
  std::uint64_t open_fragment_count() const;

  const std::map<std::string, Vault>& vaults() const;
  const std::map<std::string, Route>& routes() const;
  const std::map<std::string, OperatorProfile>& operators() const;
  const std::map<std::string, Obligation>& obligations() const;
  const std::vector<Fragment>& fragments() const;
  const EventLog& events() const;

 private:
  struct TransformTarget {
    FragmentKind kind = FragmentKind::Free;
    FragmentState state = FragmentState::Active;
    std::string route_id;
    std::string operator_id;
    std::string obligation_id;
    Priority priority = Priority::Normal;
    std::string memo;
  };

  std::vector<std::uint64_t> consume_free(
      const std::string& vault_id,
      Amount amount,
      const TransformTarget& target);
  void require_vault(const std::string& vault_id) const;
  void require_route_open(const std::string& route_id) const;
  void require_operator_active(const std::string& operator_id) const;
  std::uint64_t append_fragment(Fragment fragment);
  Fragment* find_fragment(std::uint64_t id);

  std::map<std::string, Vault> vaults_;
  std::map<std::string, Route> routes_;
  std::map<std::string, OperatorProfile> operators_;
  std::map<std::string, Obligation> obligations_;
  std::vector<Fragment> fragments_;
  EventLog events_;
  std::uint64_t next_fragment_id_ = 1;
  std::uint64_t next_consolidation_id_ = 1;
};

}  // namespace mosaicdtl
`,
);

write(
  "src/ledger.cpp",
  String.raw`
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
`,
);

write(
  "src/audit.hpp",
  String.raw`
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
`,
);

write(
  "src/audit.cpp",
  String.raw`
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
`,
);

write(
  "src/policy_catalog.hpp",
  String.raw`
#pragma once

#include <array>
#include <cstdint>

namespace mosaicdtl {

struct PolicyTemplate {
  const char* route_id;
  const char* operator_id;
  std::uint16_t priority_floor;
  std::uint64_t route_limit;
  std::uint16_t fee_bps;
  std::uint16_t settlement_window;
};

const std::array<PolicyTemplate, 1300>& policy_templates();
std::uint64_t policy_catalog_checksum();

}  // namespace mosaicdtl
`,
);

write(
  "src/policy_catalog.cpp",
  String.raw`
#include "policy_catalog.hpp"

namespace mosaicdtl {

const std::array<PolicyTemplate, 1300>& policy_templates() {
  static const std::array<PolicyTemplate, 1300> templates = {{
${generatedPolicyRows(1300)}
  }};
  return templates;
}

std::uint64_t policy_catalog_checksum() {
  std::uint64_t checksum = 14'695'981'039'346'656'037ULL;
  for (const auto& item : policy_templates()) {
    checksum ^= item.route_limit + static_cast<std::uint64_t>(item.priority_floor * 131U);
    checksum *= 1'099'511'628'211ULL;
    checksum ^= static_cast<std::uint64_t>(item.fee_bps) << 11U;
    checksum ^= static_cast<std::uint64_t>(item.settlement_window) << 3U;
  }
  return checksum;
}

}  // namespace mosaicdtl
`,
);

write(
  "src/risk_matrix.hpp",
  String.raw`
#pragma once

#include <array>
#include <cstdint>

namespace mosaicdtl {

struct RiskMatrixRow {
  const char* route_id;
  std::uint16_t bucket;
  std::uint16_t utilization;
  std::uint16_t haircut_bps;
  std::uint64_t reserve_floor;
};

const std::array<RiskMatrixRow, 1060>& risk_matrix_rows();
std::uint64_t risk_matrix_checksum();

}  // namespace mosaicdtl
`,
);

write(
  "src/risk_matrix.cpp",
  String.raw`
#include "risk_matrix.hpp"

namespace mosaicdtl {

const std::array<RiskMatrixRow, 1060>& risk_matrix_rows() {
  static const std::array<RiskMatrixRow, 1060> rows = {{
${generatedRiskRows(1060)}
  }};
  return rows;
}

std::uint64_t risk_matrix_checksum() {
  std::uint64_t checksum = 2'166'136'261ULL;
  for (const auto& row : risk_matrix_rows()) {
    checksum ^= row.reserve_floor;
    checksum *= 16'777'619ULL;
    checksum ^= static_cast<std::uint64_t>(row.bucket) << 17U;
    checksum ^= static_cast<std::uint64_t>(row.utilization) << 7U;
    checksum ^= static_cast<std::uint64_t>(row.haircut_bps);
  }
  return checksum;
}

}  // namespace mosaicdtl
`,
);

write(
  "src/report.hpp",
  String.raw`
#pragma once

#include "audit.hpp"
#include "consolidator.hpp"
#include "ledger.hpp"

#include <map>
#include <string>
#include <vector>

namespace mosaicdtl {

struct ScenarioOutput {
  std::string name;
  Ledger ledger;
  std::vector<ConsolidationReceipt> receipts;
  std::map<std::string, Amount> metrics;
  std::map<std::string, bool> flags;
  std::map<std::string, std::string> labels;
};

std::string render_scenario_json(const ScenarioOutput& output);
std::string render_scenario_list_json(const std::vector<std::string>& names);

}  // namespace mosaicdtl
`,
);

write(
  "src/report.cpp",
  String.raw`
#include "report.hpp"

#include "json.hpp"

#include <sstream>

namespace mosaicdtl {

namespace {

template <typename Fn>
void render_array(std::ostringstream& out, std::size_t count, Fn render_item) {
  out << '[';
  for (std::size_t i = 0; i < count; i += 1) {
    if (i != 0) {
      out << ',';
    }
    render_item(i);
  }
  out << ']';
}

std::string render_fragment(const Fragment& fragment) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << fragment.id << ',';
  out << "\"vault_id\":" << json_quote(fragment.vault_id) << ',';
  out << "\"route_id\":" << json_quote(fragment.route_id) << ',';
  out << "\"operator_id\":" << json_quote(fragment.operator_id) << ',';
  out << "\"obligation_id\":" << json_quote(fragment.obligation_id) << ',';
  out << "\"amount\":" << fragment.amount << ',';
  out << "\"priority\":" << json_quote(priority_name(fragment.priority)) << ',';
  out << "\"kind\":" << json_quote(fragment_kind_name(fragment.kind)) << ',';
  out << "\"state\":" << json_quote(fragment_state_name(fragment.state)) << ',';
  out << "\"generation\":" << fragment.generation << ',';
  out << "\"parents\":" << json_uint_array(fragment.parent_ids);
  out << '}';
  return out.str();
}

std::string render_vault(const Vault& vault) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(vault.id) << ',';
  out << "\"owner\":" << json_quote(vault.owner) << ',';
  out << "\"deposited\":" << vault.deposited;
  out << '}';
  return out.str();
}

std::string render_route(const Route& route) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(route.id) << ',';
  out << "\"operator_id\":" << json_quote(route.operator_id) << ',';
  out << "\"capacity\":" << route.capacity << ',';
  out << "\"priority_floor\":" << route.priority_floor << ',';
  out << "\"state\":" << json_quote(route_state_name(route.state));
  out << '}';
  return out.str();
}

std::string render_operator(const OperatorProfile& profile) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(profile.id) << ',';
  out << "\"max_route_capacity\":" << profile.max_route_capacity << ',';
  out << "\"max_open_fragments\":" << profile.max_open_fragments << ',';
  out << "\"active\":" << json_bool(profile.active);
  out << '}';
  return out.str();
}

std::string render_obligation(const Obligation& obligation) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(obligation.id) << ',';
  out << "\"vault_id\":" << json_quote(obligation.vault_id) << ',';
  out << "\"route_id\":" << json_quote(obligation.route_id) << ',';
  out << "\"operator_id\":" << json_quote(obligation.operator_id) << ',';
  out << "\"amount\":" << obligation.amount << ',';
  out << "\"executed\":" << obligation.executed << ',';
  out << "\"cancelled\":" << json_bool(obligation.cancelled);
  out << '}';
  return out.str();
}

std::string render_event(const Event& event) {
  std::ostringstream out;
  out << '{';
  out << "\"sequence\":" << event.sequence << ',';
  out << "\"kind\":" << json_quote(event_kind_name(event.kind)) << ',';
  out << "\"subject\":" << json_quote(event.subject) << ',';
  out << "\"detail\":" << json_quote(event.detail) << ',';
  out << "\"amount\":" << event.amount;
  out << '}';
  return out.str();
}

std::string render_receipt(const ConsolidationReceipt& receipt) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << receipt.id << ',';
  out << "\"vault_id\":" << json_quote(receipt.vault_id) << ',';
  out << "\"target_route_id\":" << json_quote(receipt.target_route_id) << ',';
  out << "\"operator_id\":" << json_quote(receipt.operator_id) << ',';
  out << "\"total_amount\":" << receipt.total_amount << ',';
  out << "\"free_amount\":" << receipt.free_amount << ',';
  out << "\"reserved_amount\":" << receipt.reserved_amount << ',';
  out << "\"mixed_reserved_and_free\":" << json_bool(receipt.mixed_reserved_and_free) << ',';
  out << "\"economic_origin_preserved\":" << json_bool(receipt.economic_origin_preserved) << ',';
  out << "\"preserved_obligation_id\":" << json_quote(receipt.preserved_obligation_id) << ',';
  out << "\"output_fragment_id\":" << receipt.output_fragment_id << ',';
  out << "\"parents\":" << json_uint_array(receipt.parent_fragment_ids);
  out << '}';
  return out.str();
}

std::string render_backing(const ObligationBacking& backing) {
  std::ostringstream out;
  out << '{';
  out << "\"obligation_id\":" << json_quote(backing.obligation_id) << ',';
  out << "\"required\":" << backing.required << ',';
  out << "\"executed\":" << backing.executed << ',';
  out << "\"active_backing\":" << backing.active_backing << ',';
  out << "\"fully_backed\":" << json_bool(backing.fully_backed);
  out << '}';
  return out.str();
}

std::string render_audit(const AuditReport& audit) {
  std::ostringstream out;
  out << '{';
  out << "\"deposited\":" << audit.deposited << ',';
  out << "\"active_free\":" << audit.active_free << ',';
  out << "\"active_reserved\":" << audit.active_reserved << ',';
  out << "\"withdrawn\":" << audit.withdrawn << ',';
  out << "\"executed\":" << audit.executed << ',';
  out << "\"nominal_accounted\":" << audit.nominal_accounted << ',';
  out << "\"consolidated_historical\":" << audit.consolidated_historical << ',';
  out << "\"active_fragments\":" << audit.active_fragments << ',';
  out << "\"open_obligations\":" << audit.open_obligations << ',';
  out << "\"underbacked_obligations\":" << audit.underbacked_obligations << ',';
  out << "\"nominal_conserved\":" << json_bool(audit.nominal_conserved) << ',';
  out << "\"economic_origin_preserved\":" << json_bool(audit.economic_origin_preserved) << ',';
  out << "\"obligations\":";
  render_array(out, audit.obligations.size(), [&](std::size_t i) {
    out << render_backing(audit.obligations[i]);
  });
  out << '}';
  return out.str();
}

template <typename Map>
std::string render_amount_map(const Map& values) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& [key, value] : values) {
    if (!first) {
      out << ',';
    }
    first = false;
    out << json_quote(key) << ':' << value;
  }
  out << '}';
  return out.str();
}

std::string render_bool_map(const std::map<std::string, bool>& values) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& [key, value] : values) {
    if (!first) {
      out << ',';
    }
    first = false;
    out << json_quote(key) << ':' << json_bool(value);
  }
  out << '}';
  return out.str();
}

std::string render_label_map(const std::map<std::string, std::string>& values) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& [key, value] : values) {
    if (!first) {
      out << ',';
    }
    first = false;
    out << json_quote(key) << ':' << json_quote(value);
  }
  out << '}';
  return out.str();
}

}  // namespace

std::string render_scenario_json(const ScenarioOutput& output) {
  const auto audit = audit_ledger(output.ledger);
  std::ostringstream out;
  out << '{';
  out << "\"protocol\":\"MosaicDTL\",";
  out << "\"scenario\":" << json_quote(output.name) << ',';
  out << "\"metrics\":" << render_amount_map(output.metrics) << ',';
  out << "\"flags\":" << render_bool_map(output.flags) << ',';
  out << "\"labels\":" << render_label_map(output.labels) << ',';
  out << "\"audit\":" << render_audit(audit) << ',';

  out << "\"vaults\":";
  render_array(out, output.ledger.vaults().size(), [&](std::size_t index) {
    auto it = output.ledger.vaults().begin();
    std::advance(it, static_cast<long>(index));
    out << render_vault(it->second);
  });
  out << ',';

  out << "\"operators\":";
  render_array(out, output.ledger.operators().size(), [&](std::size_t index) {
    auto it = output.ledger.operators().begin();
    std::advance(it, static_cast<long>(index));
    out << render_operator(it->second);
  });
  out << ',';

  out << "\"routes\":";
  render_array(out, output.ledger.routes().size(), [&](std::size_t index) {
    auto it = output.ledger.routes().begin();
    std::advance(it, static_cast<long>(index));
    out << render_route(it->second);
  });
  out << ',';

  out << "\"obligations\":";
  render_array(out, output.ledger.obligations().size(), [&](std::size_t index) {
    auto it = output.ledger.obligations().begin();
    std::advance(it, static_cast<long>(index));
    out << render_obligation(it->second);
  });
  out << ',';

  out << "\"fragments\":";
  render_array(out, output.ledger.fragments().size(), [&](std::size_t index) {
    out << render_fragment(output.ledger.fragments()[index]);
  });
  out << ',';

  out << "\"receipts\":";
  render_array(out, output.receipts.size(), [&](std::size_t index) {
    out << render_receipt(output.receipts[index]);
  });
  out << ',';

  out << "\"events\":";
  render_array(out, output.ledger.events().entries().size(), [&](std::size_t index) {
    out << render_event(output.ledger.events().entries()[index]);
  });
  out << '}';
  return out.str();
}

std::string render_scenario_list_json(const std::vector<std::string>& names) {
  std::ostringstream out;
  out << "{\"protocol\":\"MosaicDTL\",\"scenarios\":";
  render_array(out, names.size(), [&](std::size_t index) {
    out << json_quote(names[index]);
  });
  out << '}';
  return out.str();
}

}  // namespace mosaicdtl
`,
);

write(
  "src/scenarios.hpp",
  String.raw`
#pragma once

#include "report.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

std::vector<std::string> scenario_names();
ScenarioOutput run_scenario(const std::string& name);

}  // namespace mosaicdtl
`,
);

write(
  "src/scenarios.cpp",
  String.raw`
#include "scenarios.hpp"

#include "policy_catalog.hpp"
#include "risk_matrix.hpp"

#include <stdexcept>

namespace mosaicdtl {

namespace {

Ledger base_ledger() {
  Ledger ledger;
  ledger.register_vault("vault-mosaic", "treasury-alpha");
  ledger.register_operator("operator-north", 2'000'000, 128);
  ledger.register_operator("operator-south", 2'000'000, 128);
  ledger.register_route("route-north", "operator-north", 1'200'000, Priority::Low);
  ledger.register_route("route-south", "operator-south", 1'200'000, Priority::Low);
  ledger.register_route("route-merge", "operator-north", 1'800'000, Priority::Low);
  ledger.register_route("route-retire", "operator-south", 900'000, Priority::Low);
  ledger.deposit("vault-mosaic", 1'000'000, "genesis vault funding");
  return ledger;
}

void add_catalog_metrics(ScenarioOutput& output) {
  output.metrics["policy_templates"] = policy_templates().size();
  output.metrics["risk_rows"] = risk_matrix_rows().size();
  output.metrics["policy_checksum_low"] = policy_catalog_checksum() & 0xffffffffULL;
  output.metrics["risk_checksum_low"] = risk_matrix_checksum() & 0xffffffffULL;
}

ScenarioOutput allocation_scenario() {
  ScenarioOutput output;
  output.name = "allocation";
  output.ledger = base_ledger();
  output.ledger.reserve(
      "vault-mosaic",
      "route-north",
      "operator-north",
      "invoice-1001",
      180'000,
      Priority::Critical);
  output.ledger.reserve(
      "vault-mosaic",
      "route-south",
      "operator-south",
      "invoice-1002",
      120'000,
      Priority::High);
  output.ledger.assign_free(
      "vault-mosaic",
      "route-north",
      "operator-north",
      250'000,
      Priority::Normal,
      "north operational liquidity");
  output.ledger.assign_free(
      "vault-mosaic",
      "route-south",
      "operator-south",
      100'000,
      Priority::Low,
      "south operational liquidity");
  output.metrics["active_free"] = output.ledger.total_active_free();
  output.metrics["active_reserved"] = output.ledger.total_active_reserved();
  output.metrics["route_north"] = output.ledger.active_amount_on_route("route-north");
  output.metrics["route_south"] = output.ledger.active_amount_on_route("route-south");
  output.flags["obligations_backed"] = true;
  add_catalog_metrics(output);
  return output;
}

ScenarioOutput withdrawal_scenario() {
  ScenarioOutput output;
  output.name = "withdrawal";
  output.ledger = base_ledger();
  output.ledger.reserve(
      "vault-mosaic",
      "route-north",
      "operator-north",
      "invoice-2001",
      300'000,
      Priority::Critical);
  output.ledger.assign_free(
      "vault-mosaic",
      "route-south",
      "operator-south",
      250'000,
      Priority::Normal,
      "withdrawal staging");
  output.ledger.withdraw_free("vault-mosaic", 150'000, "treasury-alpha");
  output.metrics["withdrawn"] = output.ledger.total_withdrawn();
  output.metrics["active_reserved"] = output.ledger.total_active_reserved();
  output.metrics["active_free"] = output.ledger.total_active_free();
  output.flags["reserved_backing_survived"] =
      output.ledger.active_reserved_for_obligation("invoice-2001") == 300'000;
  add_catalog_metrics(output);
  return output;
}

ScenarioOutput consolidation_scenario() {
  ScenarioOutput output;
  output.name = "consolidation";
  output.ledger = base_ledger();
  output.ledger.assign_free(
      "vault-mosaic",
      "route-north",
      "operator-north",
      220'000,
      Priority::High,
      "north idle shard");
  output.ledger.assign_free(
      "vault-mosaic",
      "route-south",
      "operator-south",
      180'000,
      Priority::Normal,
      "south idle shard");
  output.receipts.push_back(output.ledger.consolidate(
      "vault-mosaic",
      {"route-north", "route-south"},
      "route-merge",
      "operator-north",
      Priority::Low));
  output.metrics["consolidated_total"] = output.receipts.back().total_amount;
  output.metrics["active_free"] = output.ledger.total_active_free();
  output.metrics["active_reserved"] = output.ledger.total_active_reserved();
  output.flags["receipt_total_checked"] =
      output.receipts.back().total_amount ==
      output.receipts.back().free_amount + output.receipts.back().reserved_amount;
  output.flags["origin_preserved"] = output.receipts.back().economic_origin_preserved;
  add_catalog_metrics(output);
  return output;
}

ScenarioOutput route_close_scenario() {
  ScenarioOutput output;
  output.name = "route-close";
  output.ledger = base_ledger();
  output.ledger.assign_free(
      "vault-mosaic",
      "route-retire",
      "operator-south",
      200'000,
      Priority::Normal,
      "retiring route balance");
  output.receipts.push_back(output.ledger.consolidate(
      "vault-mosaic",
      {"route-retire"},
      "route-merge",
      "operator-north",
      Priority::Low));
  const bool closed = output.ledger.close_route("route-retire");
  output.flags["route_closed"] = closed;
  output.metrics["route_retire_active"] = output.ledger.active_amount_on_route("route-retire");
  output.metrics["route_merge_active"] = output.ledger.active_amount_on_route("route-merge");
  output.labels["closed_route"] = "route-retire";
  add_catalog_metrics(output);
  return output;
}

ScenarioOutput provenance_leak_scenario() {
  ScenarioOutput output;
  output.name = "provenance-leak";
  output.ledger = base_ledger();
  output.ledger.reserve(
      "vault-mosaic",
      "route-north",
      "operator-north",
      "invoice-9001",
      400'000,
      Priority::Critical);
  output.ledger.assign_free(
      "vault-mosaic",
      "route-north",
      "operator-north",
      250'000,
      Priority::Normal,
      "same route idle liquidity");
  output.receipts.push_back(output.ledger.consolidate(
      "vault-mosaic",
      {"route-north"},
      "route-merge",
      "operator-north",
      Priority::Low));
  output.ledger.withdraw_free("vault-mosaic", 650'000, "treasury-alpha");
  const bool executed = output.ledger.execute_obligation("invoice-9001");
  output.flags["execution_after_withdrawal"] = executed;
  output.flags["receipt_origin_preserved"] = output.receipts.back().economic_origin_preserved;
  output.metrics["withdrawn"] = output.ledger.total_withdrawn();
  output.metrics["invoice_backing"] = output.ledger.active_reserved_for_obligation("invoice-9001");
  output.metrics["consolidated_total"] = output.receipts.back().total_amount;
  output.labels["leaked_obligation"] = "invoice-9001";
  add_catalog_metrics(output);
  return output;
}

}  // namespace

std::vector<std::string> scenario_names() {
  return {
      "allocation",
      "withdrawal",
      "consolidation",
      "route-close",
      "provenance-leak",
  };
}

ScenarioOutput run_scenario(const std::string& name) {
  if (name == "allocation") {
    return allocation_scenario();
  }
  if (name == "withdrawal") {
    return withdrawal_scenario();
  }
  if (name == "consolidation") {
    return consolidation_scenario();
  }
  if (name == "route-close") {
    return route_close_scenario();
  }
  if (name == "provenance-leak") {
    return provenance_leak_scenario();
  }
  throw std::invalid_argument("unknown scenario: " + name);
}

}  // namespace mosaicdtl
`,
);

write(
  "src/main.cpp",
  String.raw`
#include "json.hpp"
#include "report.hpp"
#include "scenarios.hpp"

#include <exception>
#include <iostream>
#include <string>

namespace {

void print_help() {
  std::cout
      << "MosaicDTL scenario runner\n"
      << "\n"
      << "Usage:\n"
      << "  mosaicdtl list\n"
      << "  mosaicdtl scenario <name>\n"
      << "  mosaicdtl run <name>\n"
      << "\n"
      << "Scenarios are deterministic and write JSON to stdout.\n";
}

std::string error_json(const std::string& message) {
  return std::string("{\"protocol\":\"MosaicDTL\",\"error\":") + mosaicdtl::json_quote(message) + "}";
}

}  // namespace

int main(int argc, char** argv) {
  try {
    if (argc < 2) {
      print_help();
      return 0;
    }

    const std::string command = argv[1];
    if (command == "help" || command == "--help" || command == "-h") {
      print_help();
      return 0;
    }

    if (command == "list") {
      std::cout << mosaicdtl::render_scenario_list_json(mosaicdtl::scenario_names()) << '\n';
      return 0;
    }

    if (command == "scenario" || command == "run") {
      if (argc < 3) {
        std::cerr << error_json("missing scenario name") << '\n';
        return 2;
      }
      const auto output = mosaicdtl::run_scenario(argv[2]);
      std::cout << mosaicdtl::render_scenario_json(output) << '\n';
      return 0;
    }

    std::cerr << error_json("unknown command: " + command) << '\n';
    return 2;
  } catch (const std::exception& error) {
    std::cerr << error_json(error.what()) << '\n';
    return 1;
  }
}
`,
);

write(
  "scripts/build.mjs",
  String.raw`
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(root, "build");
const isWindows = process.platform === "win32";
const output = join(buildDir, isWindows ? "mosaicdtl.exe" : "mosaicdtl");

function commandWorks(command, args = ["--version"]) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  return result.status === 0;
}

function findWindowsClang() {
  if (!isWindows) {
    return [];
  }
  const roots = [];
  if (process.env.LOCALAPPDATA) {
    roots.push(join(process.env.LOCALAPPDATA, "Programs"));
  }
  roots.push(process.env.ProgramFiles || "");
  roots.push(process.env["ProgramFiles(x86)"] || "");
  const candidates = [];
  for (const base of roots) {
    if (!base || !existsSync(base)) {
      continue;
    }
    const stack = [base];
    while (stack.length > 0) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          if (/LLVM|clang|bin/i.test(full) && full.length < 180) {
            stack.push(full);
          }
        } else if (entry.name.toLowerCase() === "clang++.exe") {
          candidates.push(full);
        }
      }
    }
  }
  return candidates;
}

function pickCompiler() {
  const requested = process.env.CXX;
  const candidates = requested
    ? [requested]
    : ["c++", "g++", "clang++", ...findWindowsClang()];
  for (const candidate of candidates) {
    if (commandWorks(candidate)) {
      return candidate;
    }
  }
  throw new Error("No C++ compiler found. Set CXX or install clang++/g++.");
}

mkdirSync(buildDir, { recursive: true });
const sources = readdirSync(join(root, "src"))
  .filter((name) => name.endsWith(".cpp"))
  .sort()
  .map((name) => join(root, "src", name));

const compiler = pickCompiler();
const args = [
  "-std=c++17",
  "-Wall",
  "-Wextra",
  "-O2",
  "-Isrc",
  ...sources,
  "-o",
  output,
];

const result = spawnSync(compiler, args, { cwd: root, stdio: "inherit", shell: false });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(output);
`,
);

write(
  "scripts/run-tests.mjs",
  String.raw`
import { rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = join(root, ".test-build");

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(full));
    } else if (entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

rmSync(temp, { recursive: true, force: true });
mkdirSync(temp, { recursive: true });

for (const source of collect(join(root, "tests"))) {
  const relative = source.slice(join(root, "tests").length + 1);
  const target = join(temp, relative).replace(/\.ts$/u, ".mjs");
  mkdirSync(dirname(target), { recursive: true });
  const transformed = readFileSync(source, "utf8").replace(/\.ts(["'])/gu, ".mjs$1");
  writeFileSync(target, transformed);
}

const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const testFiles = collect(join(root, "tests"))
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => join(temp, file.slice(join(root, "tests").length + 1)).replace(/\.ts$/u, ".mjs"));

for (const file of testFiles) {
  if (!existsSync(file)) {
    throw new Error("missing transformed test file " + file);
  }
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);
`,
);

write(
  "scripts/check-js.mjs",
  String.raw`
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".test-build") {
      out.push(...collect(full));
    } else if (entry.isFile() && /\.(mjs|js)$/u.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

for (const file of collect(root)) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
`,
);

write(
  "scripts/tests.sh",
  String.raw`
#!/usr/bin/env bash
set -euo pipefail

node scripts/run-tests.mjs
`,
);

write(
  "scripts/ci.sh",
  String.raw`
#!/usr/bin/env bash
set -euo pipefail

node scripts/check-js.mjs
node scripts/run-tests.mjs
`,
);

write(
  "tests/helpers/scenario_helpers.ts",
  String.raw`
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const binary = join(root, "build", process.platform === "win32" ? "mosaicdtl.exe" : "mosaicdtl");
let built = false;
const cache = new Map();

function ensureBuilt() {
  if (existsSync(binary)) {
    built = true;
    return;
  }
  execFileSync(process.execPath, ["scripts/build.mjs"], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 120_000,
  });
  built = true;
}

export function scenario(name) {
  if (!cache.has(name)) {
    ensureBuilt();
    const stdout = execFileSync(binary, ["scenario", name], {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
    });
    cache.set(name, JSON.parse(stdout));
  }
  return cache.get(name);
}

export function byId(items, id) {
  const value = items.find((item) => item.id === id);
  assert.ok(value, "missing item " + id);
  return value;
}

export function assertConserved(payload) {
  assert.equal(payload.audit.deposited, 1_000_000);
  assert.equal(payload.audit.nominal_accounted, 1_000_000);
  assert.equal(payload.audit.nominal_conserved, true);
}
`,
);

write(
  "tests/node/allocation.test.ts",
  String.raw`
import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, byId, scenario } from "../helpers/scenario_helpers.ts";

test("allocation assigns free and reserved fragments to routes", () => {
  const payload = scenario("allocation");

  assert.equal(payload.scenario, "allocation");
  assert.equal(payload.metrics.active_reserved, 300_000);
  assert.equal(payload.metrics.active_free, 700_000);
  assert.equal(payload.metrics.route_north, 430_000);
  assert.equal(payload.metrics.route_south, 220_000);
  assert.equal(payload.audit.underbacked_obligations, 0);
  assert.equal(byId(payload.obligations, "invoice-1001").amount, 180_000);
  assert.equal(byId(payload.obligations, "invoice-1002").amount, 120_000);
  assertConserved(payload);
});
`,
);

write(
  "tests/node/withdrawal.test.ts",
  String.raw`
import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, scenario } from "../helpers/scenario_helpers.ts";

test("withdrawal consumes only liquidity classified as free", () => {
  const payload = scenario("withdrawal");

  assert.equal(payload.scenario, "withdrawal");
  assert.equal(payload.metrics.withdrawn, 150_000);
  assert.equal(payload.metrics.active_reserved, 300_000);
  assert.equal(payload.flags.reserved_backing_survived, true);
  assert.equal(payload.audit.underbacked_obligations, 0);
  assert.equal(payload.audit.active_free, 550_000);
  assertConserved(payload);
});
`,
);

write(
  "tests/node/consolidation.test.ts",
  String.raw`
import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, scenario } from "../helpers/scenario_helpers.ts";

test("consolidation checks totals and produces one target route fragment", () => {
  const payload = scenario("consolidation");

  assert.equal(payload.scenario, "consolidation");
  assert.equal(payload.receipts.length, 1);
  assert.equal(payload.receipts[0].total_amount, 400_000);
  assert.equal(payload.receipts[0].free_amount, 400_000);
  assert.equal(payload.receipts[0].reserved_amount, 0);
  assert.equal(payload.receipts[0].target_route_id, "route-merge");
  assert.equal(payload.flags.receipt_total_checked, true);
  assert.equal(payload.flags.origin_preserved, true);
  assert.equal(payload.audit.active_reserved, 0);
  assertConserved(payload);
});
`,
);

write(
  "tests/node/route_close.test.ts",
  String.raw`
import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, byId, scenario } from "../helpers/scenario_helpers.ts";

test("route closure is allowed after active fragments are consolidated away", () => {
  const payload = scenario("route-close");

  assert.equal(payload.scenario, "route-close");
  assert.equal(payload.flags.route_closed, true);
  assert.equal(payload.metrics.route_retire_active, 0);
  assert.equal(payload.metrics.route_merge_active, 200_000);
  assert.equal(byId(payload.routes, "route-retire").state, "closed");
  assert.equal(payload.labels.closed_route, "route-retire");
  assertConserved(payload);
});
`,
);

write(
  "tests/node/cli_contract.test.ts",
  String.raw`
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scenario } from "../helpers/scenario_helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const binary = join(root, "build", process.platform === "win32" ? "mosaicdtl.exe" : "mosaicdtl");

test("cli lists deterministic scenarios", () => {
  scenario("allocation");
  const stdout = execFileSync(binary, ["list"], { cwd: root, encoding: "utf8" });
  const payload = JSON.parse(stdout);

  assert.equal(payload.protocol, "MosaicDTL");
  assert.deepEqual(payload.scenarios, [
    "allocation",
    "withdrawal",
    "consolidation",
    "route-close",
    "provenance-leak",
  ]);
});
`,
);

write(
  "package.json",
  String.raw`
{
  "name": "mosaic-dtl",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "MosaicDTL C++ liquidity-fragmentation CTF with TypeScript contract tests.",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node scripts/run-tests.mjs",
    "test:all": "node scripts/check-js.mjs && node scripts/run-tests.mjs",
    "ci": "node scripts/check-js.mjs && node scripts/run-tests.mjs",
    "generate": "node scripts/generate-project.mjs",
    "fmt": "prettier --write --config .prettierrc --ignore-path .prettierignore \"**/*.{js,mjs,ts,json,md,yml,yaml}\"",
    "fmt:check": "prettier --check --config .prettierrc --ignore-path .prettierignore \"**/*.{js,mjs,ts,json,md,yml,yaml}\""
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "devDependencies": {
    "prettier": "^3.8.3"
  }
}
`,
);

write(
  "README.md",
  String.raw`
# MosaicDTL

MosaicDTL es un laboratorio CTF escrito en C++17 que modela un protocolo de
fragmentacion de liquidez. Cada boveda divide sus fondos en piezas asignadas a
rutas, operadores y prioridades. La CLI ejecuta escenarios deterministas y
devuelve JSON estable para tests TypeScript.

## Componentes

- \`src/ledger.*\`: bovedas, fragmentos, reservas, retiradas y cierre de rutas.
- \`src/consolidator.*\`: planificador de consolidacion de fragmentos.
- \`src/audit.*\`: reconciliacion nominal y backing economico de obligaciones.
- \`src/scenarios.*\`: escenarios publicos y fixture de investigacion.
- \`src/policy_catalog.*\` y \`src/risk_matrix.*\`: catalogos de politica usados
  para simular una superficie de protocolo realista.
- \`tests/node/*.test.ts\`: tests de contrato TypeScript ejecutados por Node.

## Requisitos

- Node.js 20 o superior.
- Un compilador C++17 disponible como \`CXX\`, \`c++\`, \`g++\` o \`clang++\`.

En Windows, el script de build tambien busca instalaciones locales de LLVM en
\`AppData\\Local\\Programs\`.

## Uso

Compilar:

\`\`\`bash
npm run build
\`\`\`

Listar escenarios:

\`\`\`bash
build/mosaicdtl list
\`\`\`

Ejecutar un escenario:

\`\`\`bash
build/mosaicdtl scenario allocation
build/mosaicdtl scenario consolidation
build/mosaicdtl scenario provenance-leak
\`\`\`

Ejecutar tests:

\`\`\`bash
npm test
\`\`\`

## Estado Del Lab

El proyecto esta preparado como repositorio de auditoria autocontenido. Los
tests publicos validan asignacion, retirada, consolidacion y cierre de rutas,
mientras que el reto esta en razonar sobre la procedencia economica de los
fragmentos consolidados.
`,
);

write(
  "SECURITY.md",
  String.raw`
# Security Policy

MosaicDTL es un CTF local. No se aceptan reportes de seguridad para el codigo
como si fuera software de produccion.

## Alcance

El alcance del reto es la logica economica de:

- asignacion de fragmentos a rutas;
- reserva de liquidez para obligaciones;
- retirada de liquidez libre;
- consolidacion de fragmentos;
- cierre de rutas;
- reconciliacion de backing nominal y economico.

## Fuera De Alcance

- fallos del compilador o del runtime local;
- modificaciones de los tests;
- corrupcion de archivos de build;
- ataques dependientes de red o servicios externos.

## Reproduccion

El flujo recomendado es:

\`\`\`bash
npm run build
npm test
build/mosaicdtl scenario provenance-leak
\`\`\`

La salida JSON contiene eventos, fragmentos, obligaciones y auditoria para que
la investigacion pueda reconstruirse sin instrumentacion adicional.
`,
);

write(
  "vulnerability.md",
  String.raw`
# MosaicDTL Vulnerability Notes

## Resumen

La consolidacion de fragmentos comprueba que el importe total de salida coincide
con la suma de los fragmentos de entrada, pero no conserva correctamente la
procedencia economica de cada pieza cuando se mezclan fragmentos reservados y
liquidez libre.

## Modelo Esperado

Una pieza reservada para una obligacion debe seguir marcada como reservada hasta
que la obligacion sea ejecutada, cancelada o sustituida por otra garantia
equivalente. La consolidacion puede cambiar la ruta fisica de un fragmento, pero
no deberia eliminar el vinculo con su obligacion economica.

## Comportamiento Vulnerable

\`build_consolidation_plan\` mantiene la procedencia solo cuando todos los
fragmentos seleccionados son reservados y pertenecen a una unica obligacion. Si
la seleccion contiene liquidez libre y reservada, crea un fragmento de salida
\`free\` por el total consolidado. El chequeo nominal sigue pasando:

\`\`\`text
free + reserved == output_total
\`\`\`

pero el backing de la obligacion desaparece del estado activo. Despues, una
retirada normal puede consumir el fragmento de salida porque esta clasificado
como libre.

## Impacto

Una obligacion legitima puede quedar sin backing despues de una consolidacion
aparentemente valida. El resultado practico es bloqueo de pagos legitimos o robo
indirecto de fondos reservados mediante retirada anticipada de liquidez.

## Fixture De Investigacion

\`\`\`bash
npm run build
build/mosaicdtl scenario provenance-leak
\`\`\`

Indicadores relevantes en la salida:

- \`receipts[0].mixed_reserved_and_free == true\`;
- \`receipts[0].economic_origin_preserved == false\`;
- \`flags.execution_after_withdrawal == false\`;
- \`audit.nominal_conserved == true\`;
- \`audit.economic_origin_preserved == false\`;
- \`metrics.invoice_backing == 0\`.

El punto del CTF es que los invariantes nominales siguen verdes mientras el
invariante economico de origen queda roto.
`,
);

write("LICENSE", "MIT\n");

write(
  ".gitignore",
  String.raw`
build/
.test-build/
node_modules/
npm-debug.log*
`,
);

write(
  ".editorconfig",
  String.raw`
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2

[*.{cpp,hpp}]
indent_size = 2
`,
);

write(
  ".prettierrc",
  String.raw`
{
  "printWidth": 100,
  "trailingComma": "all"
}
`,
);

write(
  ".prettierignore",
  String.raw`
build/
.test-build/
node_modules/
src/policy_catalog.cpp
src/risk_matrix.cpp
`,
);

write(
  "CMakeLists.txt",
  String.raw`
cmake_minimum_required(VERSION 3.20)
project(MosaicDTL LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

file(GLOB MOSAIC_SOURCES CONFIGURE_DEPENDS src/*.cpp)
add_executable(mosaicdtl \${MOSAIC_SOURCES})
target_include_directories(mosaicdtl PRIVATE src)
`,
);

write(
  "Makefile",
  String.raw`
.PHONY: build test ci clean

build:
	node scripts/build.mjs

test:
	node scripts/run-tests.mjs

ci:
	node scripts/check-js.mjs
	node scripts/run-tests.mjs

clean:
	rm -rf build .test-build
`,
);

write(
  ".github/workflows/ci.yml",
  String.raw`
name: ci

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: bash scripts/ci.sh
`,
);

write(
  ".clang-format",
  String.raw`
BasedOnStyle: LLVM
IndentWidth: 2
ColumnLimit: 100
AllowShortFunctionsOnASingleLine: Empty
`,
);

write(
  ".github/dependabot.yml",
  String.raw`
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
`,
);

write(
  ".vscode/extensions.json",
  String.raw`
{
  "recommendations": ["ms-vscode.cpptools", "esbenp.prettier-vscode"]
}
`,
);

write(
  ".vscode/tasks.json",
  String.raw`
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "MosaicDTL: build",
      "type": "shell",
      "command": "npm run build",
      "group": "build"
    },
    {
      "label": "MosaicDTL: test",
      "type": "shell",
      "command": "npm test",
      "group": "test"
    }
  ]
}
`,
);

write(
  "docs/INTEGRATION.md",
  String.raw`
# MosaicDTL Integration Notes

La CLI es el contrato de integracion del lab. Cada ejecucion produce un unico
documento JSON con:

- \`metrics\`: contadores estables por escenario;
- \`flags\`: resultados booleanos de operaciones relevantes;
- \`audit\`: reconciliacion nominal y economica;
- \`fragments\`: piezas historicas y activas;
- \`receipts\`: recibos de consolidacion;
- \`events\`: diario ordenado.

Los importes son enteros sin decimales. Las rutas cerradas conservan sus
fragmentos historicos, pero no pueden contener fragmentos activos.
`,
);
