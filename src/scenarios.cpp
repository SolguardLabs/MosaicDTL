#include "scenarios.hpp"

#include "exposure.hpp"
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
  const auto exposure = measure_exposure(output.ledger);
  output.metrics["route_headroom"] = exposure.aggregate_headroom;
  output.metrics["route_active_total"] = exposure.total_route_active;
  output.metrics["route_committed_total"] = exposure.total_committed;
  output.metrics["active_routes"] = exposure.active_routes;
  output.metrics["unallocated_free"] = exposure.unallocated_free;
  output.metrics["largest_route"] = exposure.largest_route;
  output.flags["routes_within_capacity"] = exposure.all_routes_within_capacity;
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

}  // namespace

std::vector<std::string> scenario_names() {
  return {
      "allocation",
      "withdrawal",
      "consolidation",
      "route-close",
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
  throw std::invalid_argument("unknown scenario: " + name);
}

}  // namespace mosaicdtl
