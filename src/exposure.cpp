#include "exposure.hpp"

#include "amount.hpp"

#include <algorithm>

namespace mosaicdtl {

ExposureBook measure_exposure(const Ledger& ledger) {
  ExposureBook book;
  for (const auto& [id, route] : ledger.routes()) {
    RouteExposure exposure;
    exposure.capacity = route.capacity;
    book.routes.emplace(id, exposure);
  }

  for (const auto& fragment : ledger.fragments()) {
    if (!fragment.active()) {
      continue;
    }
    if (fragment.route_id.empty()) {
      if (fragment.withdrawable()) {
        book.unallocated_free =
            checked_add(book.unallocated_free, fragment.amount, "exposure.unallocated");
      }
      continue;
    }
    auto route = book.routes.find(fragment.route_id);
    if (route == book.routes.end()) {
      continue;
    }
    auto& exposure = route->second;
    exposure.active = checked_add(exposure.active, fragment.amount, "exposure.route.active");
    if (fragment.reserved()) {
      exposure.committed =
          checked_add(exposure.committed, fragment.amount, "exposure.route.committed");
    } else {
      exposure.allocated_free =
          checked_add(exposure.allocated_free, fragment.amount, "exposure.route.free");
    }
  }

  for (auto& [_, route] : book.routes) {
    route.within_capacity = route.active <= route.capacity;
    route.headroom = route.within_capacity ? route.capacity - route.active : 0;
    book.all_routes_within_capacity &= route.within_capacity;
    book.aggregate_headroom =
        checked_add(book.aggregate_headroom, route.headroom, "exposure.headroom");
    book.total_route_active =
        checked_add(book.total_route_active, route.active, "exposure.total.active");
    book.total_committed =
        checked_add(book.total_committed, route.committed, "exposure.total.committed");
    book.largest_route = std::max(book.largest_route, route.active);
    if (route.active != 0) {
      book.active_routes += 1;
    }
  }
  return book;
}

}  // namespace mosaicdtl
