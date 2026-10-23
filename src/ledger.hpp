#pragma once

#include "consolidator.hpp"
#include "events.hpp"
#include "margin.hpp"
#include "types.hpp"

#include <map>
#include <optional>
#include <set>
#include <string>
#include <vector>

namespace mosaicdtl {

class Ledger {
 public:
  void register_vault(std::string id, std::string owner);
  void register_operator(std::string id, Amount max_route_capacity, std::uint32_t max_open_fragments);
  void register_route(std::string id, std::string operator_id, Amount capacity, Priority floor,
                      std::uint32_t stress_bps = 3'000);

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
  std::vector<std::uint64_t> post_margin(const std::string& obligation_id,
                                         const std::string& route_id,
                                         const std::string& operator_id,
                                         Amount amount, Priority priority);
  MarginQuote margin_quote(const std::string& obligation_id) const;
  std::vector<std::uint64_t> release_margin(const std::string& obligation_id, Amount amount);
  Amount realize_stress(const std::string& obligation_id, const std::string& operator_id);
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
  Amount total_impaired() const;
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
  std::set<std::pair<std::string, std::string>> stress_realized_;
  std::vector<Fragment> fragments_;
  EventLog events_;
  std::uint64_t next_fragment_id_ = 1;
  std::uint64_t next_consolidation_id_ = 1;
};

}  // namespace mosaicdtl
