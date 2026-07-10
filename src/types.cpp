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
