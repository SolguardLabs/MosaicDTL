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
