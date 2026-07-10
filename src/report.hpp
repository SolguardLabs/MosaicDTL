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
