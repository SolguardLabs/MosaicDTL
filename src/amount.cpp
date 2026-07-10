#include "amount.hpp"

#include <limits>
#include <sstream>
#include <stdexcept>

namespace mosaicdtl {

Amount checked_add(Amount lhs, Amount rhs, const char* context) {
  if (rhs > std::numeric_limits<Amount>::max() - lhs) {
    throw std::overflow_error(std::string("amount overflow in ") + context);
  }
  return lhs + rhs;
}

Amount checked_sub(Amount lhs, Amount rhs, const char* context) {
  if (rhs > lhs) {
    throw std::underflow_error(std::string("amount underflow in ") + context);
  }
  return lhs - rhs;
}

Amount apply_bps(Amount amount, std::uint32_t bps) {
  if (bps > 10'000) {
    throw std::invalid_argument("bps above 10000");
  }
  return (amount * bps) / 10'000;
}

Amount ceil_div(Amount lhs, Amount rhs) {
  if (rhs == 0) {
    throw std::invalid_argument("division by zero");
  }
  return lhs == 0 ? 0 : ((lhs - 1) / rhs) + 1;
}

Amount min_amount(Amount lhs, Amount rhs) {
  return lhs < rhs ? lhs : rhs;
}

std::string amount_to_string(Amount amount) {
  std::ostringstream out;
  out << amount;
  return out.str();
}

AmountSplit split_by_priority(const std::vector<Fragment>& fragments) {
  AmountSplit split;
  for (const auto& fragment : fragments) {
    if (!fragment.active()) {
      continue;
    }
    switch (fragment.priority) {
      case Priority::Low:
        split.low = checked_add(split.low, fragment.amount, "split.low");
        break;
      case Priority::Normal:
        split.normal = checked_add(split.normal, fragment.amount, "split.normal");
        break;
      case Priority::High:
        split.high = checked_add(split.high, fragment.amount, "split.high");
        break;
      case Priority::Critical:
        split.critical = checked_add(split.critical, fragment.amount, "split.critical");
        break;
    }
  }
  return split;
}

}  // namespace mosaicdtl
