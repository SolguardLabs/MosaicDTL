#pragma once

#include "types.hpp"

#include <string>
#include <vector>

namespace mosaicdtl {

std::string json_quote(const std::string& value);
std::string json_bool(bool value);
std::string json_amount(Amount amount);
std::string json_string_array(const std::vector<std::string>& values);
std::string json_uint_array(const std::vector<std::uint64_t>& values);

}  // namespace mosaicdtl
