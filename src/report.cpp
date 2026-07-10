#include "report.hpp"

#include "json.hpp"

#include <sstream>

namespace mosaicdtl {

namespace {

template <typename Fn>
void render_array(std::ostringstream& out, std::size_t count, Fn render_item) {
  out << '[';
  for (std::size_t i = 0; i < count; i += 1) {
    if (i != 0) {
      out << ',';
    }
    render_item(i);
  }
  out << ']';
}

std::string render_fragment(const Fragment& fragment) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << fragment.id << ',';
  out << "\"vault_id\":" << json_quote(fragment.vault_id) << ',';
  out << "\"route_id\":" << json_quote(fragment.route_id) << ',';
  out << "\"operator_id\":" << json_quote(fragment.operator_id) << ',';
  out << "\"obligation_id\":" << json_quote(fragment.obligation_id) << ',';
  out << "\"amount\":" << fragment.amount << ',';
  out << "\"priority\":" << json_quote(priority_name(fragment.priority)) << ',';
  out << "\"kind\":" << json_quote(fragment_kind_name(fragment.kind)) << ',';
  out << "\"state\":" << json_quote(fragment_state_name(fragment.state)) << ',';
  out << "\"generation\":" << fragment.generation << ',';
  out << "\"parents\":" << json_uint_array(fragment.parent_ids);
  out << '}';
  return out.str();
}

std::string render_vault(const Vault& vault) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(vault.id) << ',';
  out << "\"owner\":" << json_quote(vault.owner) << ',';
  out << "\"deposited\":" << vault.deposited;
  out << '}';
  return out.str();
}

std::string render_route(const Route& route) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(route.id) << ',';
  out << "\"operator_id\":" << json_quote(route.operator_id) << ',';
  out << "\"capacity\":" << route.capacity << ',';
  out << "\"priority_floor\":" << route.priority_floor << ',';
  out << "\"state\":" << json_quote(route_state_name(route.state));
  out << '}';
  return out.str();
}

std::string render_operator(const OperatorProfile& profile) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(profile.id) << ',';
  out << "\"max_route_capacity\":" << profile.max_route_capacity << ',';
  out << "\"max_open_fragments\":" << profile.max_open_fragments << ',';
  out << "\"active\":" << json_bool(profile.active);
  out << '}';
  return out.str();
}

std::string render_obligation(const Obligation& obligation) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << json_quote(obligation.id) << ',';
  out << "\"vault_id\":" << json_quote(obligation.vault_id) << ',';
  out << "\"route_id\":" << json_quote(obligation.route_id) << ',';
  out << "\"operator_id\":" << json_quote(obligation.operator_id) << ',';
  out << "\"amount\":" << obligation.amount << ',';
  out << "\"executed\":" << obligation.executed << ',';
  out << "\"cancelled\":" << json_bool(obligation.cancelled);
  out << '}';
  return out.str();
}

std::string render_event(const Event& event) {
  std::ostringstream out;
  out << '{';
  out << "\"sequence\":" << event.sequence << ',';
  out << "\"kind\":" << json_quote(event_kind_name(event.kind)) << ',';
  out << "\"subject\":" << json_quote(event.subject) << ',';
  out << "\"detail\":" << json_quote(event.detail) << ',';
  out << "\"amount\":" << event.amount;
  out << '}';
  return out.str();
}

std::string render_receipt(const ConsolidationReceipt& receipt) {
  std::ostringstream out;
  out << '{';
  out << "\"id\":" << receipt.id << ',';
  out << "\"vault_id\":" << json_quote(receipt.vault_id) << ',';
  out << "\"target_route_id\":" << json_quote(receipt.target_route_id) << ',';
  out << "\"operator_id\":" << json_quote(receipt.operator_id) << ',';
  out << "\"total_amount\":" << receipt.total_amount << ',';
  out << "\"free_amount\":" << receipt.free_amount << ',';
  out << "\"reserved_amount\":" << receipt.reserved_amount << ',';
  out << "\"mixed_reserved_and_free\":" << json_bool(receipt.mixed_reserved_and_free) << ',';
  out << "\"economic_origin_preserved\":" << json_bool(receipt.economic_origin_preserved) << ',';
  out << "\"preserved_obligation_id\":" << json_quote(receipt.preserved_obligation_id) << ',';
  out << "\"output_fragment_id\":" << receipt.output_fragment_id << ',';
  out << "\"parents\":" << json_uint_array(receipt.parent_fragment_ids);
  out << '}';
  return out.str();
}

std::string render_backing(const ObligationBacking& backing) {
  std::ostringstream out;
  out << '{';
  out << "\"obligation_id\":" << json_quote(backing.obligation_id) << ',';
  out << "\"required\":" << backing.required << ',';
  out << "\"executed\":" << backing.executed << ',';
  out << "\"active_backing\":" << backing.active_backing << ',';
  out << "\"fully_backed\":" << json_bool(backing.fully_backed);
  out << '}';
  return out.str();
}

std::string render_audit(const AuditReport& audit) {
  std::ostringstream out;
  out << '{';
  out << "\"deposited\":" << audit.deposited << ',';
  out << "\"active_free\":" << audit.active_free << ',';
  out << "\"active_reserved\":" << audit.active_reserved << ',';
  out << "\"withdrawn\":" << audit.withdrawn << ',';
  out << "\"executed\":" << audit.executed << ',';
  out << "\"nominal_accounted\":" << audit.nominal_accounted << ',';
  out << "\"consolidated_historical\":" << audit.consolidated_historical << ',';
  out << "\"active_fragments\":" << audit.active_fragments << ',';
  out << "\"open_obligations\":" << audit.open_obligations << ',';
  out << "\"underbacked_obligations\":" << audit.underbacked_obligations << ',';
  out << "\"nominal_conserved\":" << json_bool(audit.nominal_conserved) << ',';
  out << "\"economic_origin_preserved\":" << json_bool(audit.economic_origin_preserved) << ',';
  out << "\"obligations\":";
  render_array(out, audit.obligations.size(), [&](std::size_t i) {
    out << render_backing(audit.obligations[i]);
  });
  out << '}';
  return out.str();
}

template <typename Map>
std::string render_amount_map(const Map& values) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& [key, value] : values) {
    if (!first) {
      out << ',';
    }
    first = false;
    out << json_quote(key) << ':' << value;
  }
  out << '}';
  return out.str();
}

std::string render_bool_map(const std::map<std::string, bool>& values) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& [key, value] : values) {
    if (!first) {
      out << ',';
    }
    first = false;
    out << json_quote(key) << ':' << json_bool(value);
  }
  out << '}';
  return out.str();
}

std::string render_label_map(const std::map<std::string, std::string>& values) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& [key, value] : values) {
    if (!first) {
      out << ',';
    }
    first = false;
    out << json_quote(key) << ':' << json_quote(value);
  }
  out << '}';
  return out.str();
}

}  // namespace

std::string render_scenario_json(const ScenarioOutput& output) {
  const auto audit = audit_ledger(output.ledger);
  std::ostringstream out;
  out << '{';
  out << "\"protocol\":\"MosaicDTL\",";
  out << "\"scenario\":" << json_quote(output.name) << ',';
  out << "\"metrics\":" << render_amount_map(output.metrics) << ',';
  out << "\"flags\":" << render_bool_map(output.flags) << ',';
  out << "\"labels\":" << render_label_map(output.labels) << ',';
  out << "\"audit\":" << render_audit(audit) << ',';

  out << "\"vaults\":";
  render_array(out, output.ledger.vaults().size(), [&](std::size_t index) {
    auto it = output.ledger.vaults().begin();
    std::advance(it, static_cast<long>(index));
    out << render_vault(it->second);
  });
  out << ',';

  out << "\"operators\":";
  render_array(out, output.ledger.operators().size(), [&](std::size_t index) {
    auto it = output.ledger.operators().begin();
    std::advance(it, static_cast<long>(index));
    out << render_operator(it->second);
  });
  out << ',';

  out << "\"routes\":";
  render_array(out, output.ledger.routes().size(), [&](std::size_t index) {
    auto it = output.ledger.routes().begin();
    std::advance(it, static_cast<long>(index));
    out << render_route(it->second);
  });
  out << ',';

  out << "\"obligations\":";
  render_array(out, output.ledger.obligations().size(), [&](std::size_t index) {
    auto it = output.ledger.obligations().begin();
    std::advance(it, static_cast<long>(index));
    out << render_obligation(it->second);
  });
  out << ',';

  out << "\"fragments\":";
  render_array(out, output.ledger.fragments().size(), [&](std::size_t index) {
    out << render_fragment(output.ledger.fragments()[index]);
  });
  out << ',';

  out << "\"receipts\":";
  render_array(out, output.receipts.size(), [&](std::size_t index) {
    out << render_receipt(output.receipts[index]);
  });
  out << ',';

  out << "\"events\":";
  render_array(out, output.ledger.events().entries().size(), [&](std::size_t index) {
    out << render_event(output.ledger.events().entries()[index]);
  });
  out << '}';
  return out.str();
}

std::string render_scenario_list_json(const std::vector<std::string>& names) {
  std::ostringstream out;
  out << "{\"protocol\":\"MosaicDTL\",\"scenarios\":";
  render_array(out, names.size(), [&](std::size_t index) {
    out << json_quote(names[index]);
  });
  out << '}';
  return out.str();
}

}  // namespace mosaicdtl
