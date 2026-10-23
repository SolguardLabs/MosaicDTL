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
  MarginPosted,
  MarginReleased,
  StressRealized,
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
