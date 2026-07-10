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
