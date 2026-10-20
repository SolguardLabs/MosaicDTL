#pragma once

#include "ledger.hpp"

#include <map>
#include <string>

namespace mosaicdtl {

struct RouteExposure {
  Amount capacity = 0;
  Amount allocated_free = 0;
  Amount committed = 0;
  Amount active = 0;
  Amount headroom = 0;
  bool within_capacity = true;
};

struct ExposureBook {
  std::map<std::string, RouteExposure> routes;
  Amount unallocated_free = 0;
  Amount total_route_active = 0;
  Amount total_committed = 0;
  Amount aggregate_headroom = 0;
  Amount largest_route = 0;
  std::uint64_t active_routes = 0;
  bool all_routes_within_capacity = true;
};

ExposureBook measure_exposure(const Ledger& ledger);

}  // namespace mosaicdtl
