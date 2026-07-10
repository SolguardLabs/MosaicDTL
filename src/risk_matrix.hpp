#pragma once

#include <array>
#include <cstdint>

namespace mosaicdtl {

struct RiskMatrixRow {
  const char* route_id;
  std::uint16_t bucket;
  std::uint16_t utilization;
  std::uint16_t haircut_bps;
  std::uint64_t reserve_floor;
};

const std::array<RiskMatrixRow, 1060>& risk_matrix_rows();
std::uint64_t risk_matrix_checksum();

}  // namespace mosaicdtl
