#pragma once

#include "types.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

struct AmountSplit {
  Amount low = 0;
  Amount normal = 0;
  Amount high = 0;
  Amount critical = 0;
};

Amount checked_add(Amount lhs, Amount rhs, const char* context);
Amount checked_sub(Amount lhs, Amount rhs, const char* context);
Amount apply_bps(Amount amount, std::uint32_t bps);
Amount ceil_div(Amount lhs, Amount rhs);
Amount min_amount(Amount lhs, Amount rhs);
std::string amount_to_string(Amount amount);
AmountSplit split_by_priority(const std::vector<Fragment>& fragments);

}  // namespace mosaicdtl
