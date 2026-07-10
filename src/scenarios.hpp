#pragma once

#include "report.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

std::vector<std::string> scenario_names();
ScenarioOutput run_scenario(const std::string& name);

}  // namespace mosaicdtl
