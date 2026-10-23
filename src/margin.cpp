#include "margin.hpp"

#include "amount.hpp"

#include <algorithm>
#include <limits>
#include <map>
#include <stdexcept>
#include <utility>

namespace mosaicdtl {

namespace {

Amount squared(Amount value) {
  if (value != 0 && value > std::numeric_limits<Amount>::max() / value) {
    throw std::overflow_error("margin quadratic exposure exceeds amount domain");
  }
  return value * value;
}

Amount ceil_square_root(Amount value) {
  if (value == 0) {
    return 0;
  }
  Amount low = 1;
  Amount high = std::min<Amount>(value, 4'294'967'296ULL);
  while (low < high) {
    const Amount middle = low + (high - low) / 2;
    if (middle >= ceil_div(value, middle)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}

}  // namespace

MarginQuote estimate_margin(Amount principal, const std::vector<MarginExposure>& exposures) {
  if (principal == 0 || exposures.empty()) {
    throw std::invalid_argument("margin quote requires principal and exposures");
  }
  std::map<std::pair<std::string, std::string>, Amount> risk_cell_loss;
  MarginQuote quote;
  quote.principal = principal;
  for (const auto& exposure : exposures) {
    require_identifier(exposure.route_id, "route_id");
    require_identifier(exposure.operator_id, "operator_id");
    quote.reserved = checked_add(quote.reserved, exposure.reserved, "margin.reserved");
    const auto cell = std::make_pair(exposure.operator_id, exposure.route_id);
    risk_cell_loss[cell] = checked_add(
        risk_cell_loss[cell],
        apply_bps(exposure.reserved, exposure.stress_bps),
        "margin.cell_loss");
  }
  Amount quadratic_loss = 0;
  for (const auto& [_, loss] : risk_cell_loss) {
    quadratic_loss = checked_add(quadratic_loss, squared(loss), "margin.quadratic_loss");
  }
  quote.route_count = static_cast<std::uint32_t>(risk_cell_loss.size());
  quote.modeled_stress = ceil_square_root(quadratic_loss);
  quote.minimum_reserve = checked_add(principal, quote.modeled_stress, "margin.minimum");
  quote.releasable = quote.reserved > quote.minimum_reserve
                         ? quote.reserved - quote.minimum_reserve
                         : 0;
  return quote;
}

}  // namespace mosaicdtl
