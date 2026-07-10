#include "json.hpp"

#include "amount.hpp"

#include <sstream>

namespace mosaicdtl {

std::string json_quote(const std::string& value) {
  std::ostringstream out;
  out << '"';
  for (const unsigned char ch : value) {
    switch (ch) {
      case '"':
        out << "\\\"";
        break;
      case '\\':
        out << "\\\\";
        break;
      case '\b':
        out << "\\b";
        break;
      case '\f':
        out << "\\f";
        break;
      case '\n':
        out << "\\n";
        break;
      case '\r':
        out << "\\r";
        break;
      case '\t':
        out << "\\t";
        break;
      default:
        if (ch < 0x20) {
          out << "\\u00";
          const char* hex = "0123456789abcdef";
          out << hex[(ch >> 4) & 0x0f] << hex[ch & 0x0f];
        } else {
          out << static_cast<char>(ch);
        }
        break;
    }
  }
  out << '"';
  return out.str();
}

std::string json_bool(bool value) {
  return value ? "true" : "false";
}

std::string json_amount(Amount amount) {
  return amount_to_string(amount);
}

std::string json_string_array(const std::vector<std::string>& values) {
  std::ostringstream out;
  out << '[';
  for (std::size_t i = 0; i < values.size(); i += 1) {
    if (i != 0) {
      out << ',';
    }
    out << json_quote(values[i]);
  }
  out << ']';
  return out.str();
}

std::string json_uint_array(const std::vector<std::uint64_t>& values) {
  std::ostringstream out;
  out << '[';
  for (std::size_t i = 0; i < values.size(); i += 1) {
    if (i != 0) {
      out << ',';
    }
    out << values[i];
  }
  out << ']';
  return out.str();
}

}  // namespace mosaicdtl
