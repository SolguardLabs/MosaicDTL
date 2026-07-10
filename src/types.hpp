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
