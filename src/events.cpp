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
    case EventKind::MarginPosted:
      return "margin_posted";
    case EventKind::MarginReleased:
      return "margin_released";
    case EventKind::StressRealized:
      return "stress_realized";
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
