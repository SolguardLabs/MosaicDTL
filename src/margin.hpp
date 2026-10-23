#pragma once

#include "types.hpp"

#include <cstdint>
#include <string>
#include <vector>

namespace mosaicdtl {

struct MarginExposure {
  std::string route_id;
  std::string operator_id;
  Amount reserved = 0;
  std::uint32_t stress_bps = 0;
};

struct MarginQuote {
  Amount principal = 0;
  Amount reserved = 0;
  Amount modeled_stress = 0;
  Amount minimum_reserve = 0;
  Amount releasable = 0;
  std::uint32_t route_count = 0;
};

MarginQuote estimate_margin(Amount principal, const std::vector<MarginExposure>& exposures);

}  // namespace mosaicdtl
