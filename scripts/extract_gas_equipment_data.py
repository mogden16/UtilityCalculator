from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

import pdfplumber
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


PRESSURE_CLASSES = ("low", "intermediate", "high")


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def display_integer(value: Any) -> int:
    if value is None or isinstance(value, bool):
        raise ValueError(f"Expected numeric source value, got {value!r}")
    numeric = float(value)
    return math.floor(numeric + 0.5)


def parse_numeric(value: str | int | float | None) -> int:
    if value is None:
        raise ValueError("Missing numeric table value")
    if isinstance(value, (int, float)):
        return display_integer(value)
    return int(value.replace(",", "").strip())


def source_ref(document: str, **locator: Any) -> dict[str, Any]:
    return {"document": document, **locator}


def normalize_size_id(label: str) -> str:
    normalized = label.lower().replace('"', "-inch")
    normalized = normalized.replace("1 1/4", "1-1-4").replace("3/4", "3-4")
    normalized = re.sub(r"\s+", "-", normalized.strip())
    normalized = re.sub(r"[^a-z0-9-]", "", normalized)
    return re.sub(r"-+", "-", normalized).strip("-")


def clean_size_label(label: str) -> str:
    return re.sub(r"\s+(Plastic|Steel)$", "", label.replace("\n", " ").strip())


def service_assumptions(status: str, pressure_class: str) -> dict[str, Any]:
    if pressure_class == "low":
        return {
            "mainPressure": {"value": 5.5, "unit": "inWC"},
            "allowablePressureLoss": {"value": 1 if status == "existing" else 0.5, "unit": "inWC"},
        }
    if pressure_class == "intermediate":
        return {
            "mainPressure": {"value": 1.5, "unit": "psig"},
            "allowablePressureLoss": {"value": 1 if status == "existing" else 0.5, "unit": "psig"},
            "maximumVelocityFps": 100,
        }
    return {
        "mainPressure": {"value": 10, "unit": "psig"},
        "allowablePressureLoss": {"value": 2 if status == "existing" else 1, "unit": "psig"},
        "maximumVelocityFps": 100,
    }


def table_lengths(header: str) -> list[int]:
    values = [int(value) for value in re.findall(r"\b\d+\b", header)]
    if values[:1] == [1] and len(values) > 20:
        values = values[1:]
    return values[-20:]


def parse_service_table(
    table: list[list[str | None]],
    *,
    material: str,
    status: str,
    page: int,
) -> list[dict[str, Any]]:
    group_starts = [index for index, value in enumerate(table[1]) if value == "Service"]
    tables: list[dict[str, Any]] = []
    for group_index, start in enumerate(group_starts):
        end = group_starts[group_index + 1] if group_index + 1 < len(group_starts) else len(table[0])
        pressure_class = PRESSURE_CLASSES[group_index]
        sizes = []
        for column in range(start + 1, end):
            raw_label = table[2][column]
            if not raw_label:
                continue
            label = clean_size_label(raw_label)
            sizes.append({"id": normalize_size_id(label), "label": label, "sourceColumn": raw_label.replace("\n", " ")})

        lengths = table_lengths(table[2][start] or "")
        rows = []
        for row_offset, length_ft in enumerate(lengths):
            source_row = row_offset + 4
            row = table[source_row - 1]
            capacities = {
                size["id"]: parse_numeric(row[start + size_offset + 1])
                for size_offset, size in enumerate(sizes)
            }
            rows.append(
                {
                    "lengthFt": length_ft,
                    "capacitiesCfh": capacities,
                    "source": source_ref(
                        "maximum-service-capacity",
                        page=page,
                        table=f"{status.title()} {material.title()} Services - {pressure_class.title()} Pressure System",
                        rowLabel=f"{length_ft} ft",
                    ),
                }
            )

        tables.append(
            {
                "id": f"{material}-{status}-{pressure_class}",
                "material": material,
                "status": status,
                "pressureClass": pressure_class,
                "sizes": sizes,
                "rows": rows,
                "assumptions": service_assumptions(status, pressure_class),
                "source": source_ref("maximum-service-capacity", page=page),
            }
        )
    return tables


def extract_service_data(pdf_path: Path) -> dict[str, Any]:
    with pdfplumber.open(pdf_path) as pdf:
        page_two_tables = pdf.pages[1].extract_tables()
        page_three_tables = pdf.pages[2].extract_tables()

    service_tables = []
    service_tables.extend(parse_service_table(page_two_tables[0], material="plastic", status="existing", page=2))
    service_tables.extend(parse_service_table(page_two_tables[1], material="plastic", status="new", page=2))
    service_tables.extend(parse_service_table(page_three_tables[0], material="steel", status="existing", page=3))
    service_tables.extend(parse_service_table(page_three_tables[1], material="steel", status="new", page=3))

    mixed = page_two_tables[2]
    lengths = [int(value) for value in re.findall(r"\b\d+\b", mixed[2][0] or "")][-20:]
    loads = [int(value) for value in re.findall(r"\d+", " ".join(value or "" for value in mixed[2][1:]))]
    mixed_rows = []
    for offset, length_ft in enumerate(lengths):
        row = mixed[offset + 3]
        mixed_rows.append(
            {
                "lengthFt": length_ft,
                "allowedOneInchCtsFtByLoadCfh": {
                    str(load): parse_numeric(row[index + 1]) for index, load in enumerate(loads)
                },
                "source": source_ref(
                    "maximum-service-capacity",
                    page=2,
                    table="New Plastic Services - Mixed 1-inch CTS and 1-1/4-inch IPS",
                    rowLabel=f"{length_ft} ft",
                ),
            }
        )

    return {
        "engineeringConditions": {
            "formula": "IGT improved formula",
            "efficiency": 0.95,
            "elevationChangeFt": 0,
            "temperatureF": 60,
            "basePressurePsia": 14.7,
            "viscosityLbmPerFtSec": 0.000007,
            "specificGravity": 0.6,
            "specificHeatRatio": 1.3,
            "sourceHeatingValueBtuPerCf": 1000,
            "serviceLengthIncludesEquivalentLength": True,
        },
        "tables": service_tables,
        "mixedPlastic": {
            "id": "plastic-new-low-mixed-1-cts-1-1-4-ips",
            "material": "plastic",
            "status": "new",
            "pressureClass": "low",
            "oneInchCtsSizeLabel": '1" CTS',
            "remainderSizeLabel": '1 1/4" IPS',
            "loadColumnsCfh": loads,
            "rows": mixed_rows,
            "assumptions": {
                "mainPressure": {"value": 5.5, "unit": "inWC"},
                "allowablePressureLoss": {"value": 1, "unit": "inWC"},
            },
            "source": source_ref("maximum-service-capacity", page=2),
        },
    }


def parse_pressure_label(value: Any) -> dict[str, Any]:
    label = str(value).strip()
    upper = label.upper()
    if "-" in label and '"' in label:
        numbers = [float(item) for item in re.findall(r"\d+(?:\.\d+)?", label)]
        return {"label": label, "unit": "inWC", "minimum": numbers[0], "maximum": numbers[1]}
    number = float(re.findall(r"\d+(?:\.\d+)?", label)[0])
    return {"label": label, "unit": "psig" if "PSI" in upper else "inWC", "value": number}


def pressure_key(pressure: dict[str, Any]) -> str:
    if "value" in pressure:
        return f"{pressure['unit']}:{pressure['value']:g}"
    return f"{pressure['unit']}:{pressure['minimum']:g}-{pressure['maximum']:g}"


def extract_meter_data(guidelines_path: Path, final_path: Path) -> dict[str, Any]:
    guideline_values = load_workbook(guidelines_path, data_only=True, read_only=False)
    final_formulas = load_workbook(final_path, data_only=False, read_only=False)
    final_values = load_workbook(final_path, data_only=True, read_only=False)
    records: list[dict[str, Any]] = []

    diaphragm = guideline_values["Diaphragm (2021)"]
    for row in range(3, 24):
        pressure = parse_pressure_label(diaphragm.cell(row, 1).value)
        for column in range(3, 12):
            model = str(diaphragm.cell(2, column).value).strip()
            records.append(
                {
                    "family": "diaphragm",
                    "configuration": None,
                    "model": model,
                    "nominalSize": None,
                    "pressure": pressure,
                    "pressureKey": pressure_key(pressure),
                    "minimumFlowCfh": None,
                    "maximumFlowCfh": display_integer(diaphragm.cell(row, column).value),
                    "source": source_ref(
                        "meter-regulator-guidelines",
                        worksheet="Diaphragm (2021)",
                        pressureCell=f"A{row}",
                        maximumFlowCell=f"{get_column_letter(column)}{row}",
                    ),
                }
            )

    rotary_formula = final_formulas["Rotary"]
    rotary_values = final_values["Rotary"]
    nominal_size = None
    rotary_columns = []
    for column in range(3, 12):
        if rotary_formula.cell(2, column).value:
            nominal_size = str(rotary_formula.cell(2, column).value).strip()
        rotary_columns.append((column, nominal_size))
    for row in [7, *range(9, 36)]:
        pressure = parse_pressure_label(rotary_formula.cell(row, 1).value)
        for column, size in rotary_columns:
            records.append(
                {
                    "family": "rotary",
                    "configuration": None,
                    "model": str(rotary_formula.cell(3, column).value).strip(),
                    "nominalSize": size,
                    "pressure": pressure,
                    "pressureKey": pressure_key(pressure),
                    "minimumFlowCfh": display_integer(rotary_values.cell(4, column).value),
                    "maximumFlowCfh": display_integer(rotary_values.cell(row, column).value),
                    "source": source_ref(
                        "rotary-turbine-final",
                        worksheet="Rotary",
                        pressureCell=f"A{row}",
                        minimumFlowCell=f"{get_column_letter(column)}4",
                        maximumFlowCell=f"{get_column_letter(column)}{row}",
                    ),
                }
            )

    for sheet_name, angle in (("Turbine 45 deg. Angle ", 45), ("Turbine 30 deg. Angle", 30)):
        formula_sheet = final_formulas[sheet_name]
        value_sheet = final_values[sheet_name]
        for row in range(4, 32):
            pressure = parse_pressure_label(formula_sheet.cell(row, 1).value)
            for maximum_column in (3, 5, 7, 9):
                minimum_column = maximum_column + 1
                records.append(
                    {
                        "family": "turbine",
                        "configuration": {"rotorAngleDegrees": angle},
                        "model": f"{formula_sheet.cell(2, maximum_column).value} turbine",
                        "nominalSize": str(formula_sheet.cell(2, maximum_column).value).strip(),
                        "pressure": pressure,
                        "pressureKey": pressure_key(pressure),
                        "minimumFlowCfh": display_integer(value_sheet.cell(row, minimum_column).value),
                        "maximumFlowCfh": display_integer(value_sheet.cell(row, maximum_column).value),
                        "source": source_ref(
                            "rotary-turbine-final",
                            worksheet=sheet_name.strip(),
                            pressureCell=f"A{row}",
                            minimumFlowCell=f"{get_column_letter(minimum_column)}{row}",
                            maximumFlowCell=f"{get_column_letter(maximum_column)}{row}",
                        ),
                    }
                )

    return {"records": records}


def cell_text(sheet: Any, row: int, column: int) -> str | None:
    value = sheet.cell(row, column).value
    return None if value is None else str(value).strip()


def nearest_heading(sheet: Any, row: int, column: int) -> tuple[int, str]:
    for candidate in range(column, 0, -1):
        value = cell_text(sheet, row, candidate)
        if value:
            return candidate, value
    raise ValueError(f"No section heading found in row {row} before column {column}")


def extract_monitor_setpoint(text: str) -> str | None:
    match = re.search(r"Monitor Setpoint:\s*([^\)]+)", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def extract_stepdown_setpoint(text: str) -> str | None:
    match = re.search(r"Stepdown Setpoint:\s*([^\)]+)", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def parse_inlet_range(text: str) -> dict[str, Any]:
    values = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", text)]
    return {"label": text.replace("Inlet:", "").strip(), "minimumPsig": values[0], "maximumPsig": values[1]}


def parse_outlet(text: str) -> dict[str, Any]:
    value = float(re.findall(r"\d+(?:\.\d+)?", text)[0])
    return {"label": text.replace("Outlet:", "").strip(), "value": value, "unit": "psig" if "PSIG" in text.upper() else "inWC"}


def extract_regulator_data(guidelines_path: Path) -> dict[str, Any]:
    workbook = load_workbook(guidelines_path, data_only=True, read_only=False)
    sheet = workbook["Industrial Regulator DS14.11"]
    inlet: dict[str, Any] | None = None
    records = []
    for row in range(1, sheet.max_row + 1):
        inlet_text = cell_text(sheet, row, 1)
        if inlet_text and inlet_text.startswith("Inlet:"):
            inlet = parse_inlet_range(inlet_text)
        outlet_text = cell_text(sheet, row, 2)
        if not outlet_text or not outlet_text.startswith("Outlet:"):
            continue
        if inlet is None:
            raise ValueError(f"Outlet row {row} has no inlet range")

        outlet = parse_outlet(outlet_text)
        capacity_row = row + 1
        role_row = row + 2
        detail_rows = {
            "model": row + 3,
            "bodySize": row + 4,
            "orificeSize": row + 5,
            "diaphragmSize": row + 6,
            "spring": row + 7,
            "protectionOrPilot": row + 8,
            "reliefOrPilotSpring": row + 9,
        }

        for column in range(1, sheet.max_column + 1):
            capacity = sheet.cell(capacity_row, column).value
            if not isinstance(capacity, (int, float)) or isinstance(capacity, bool):
                continue
            heading_column, heading = nearest_heading(sheet, row, column)
            role = cell_text(sheet, role_row, column)
            component_columns = [column, column + 1] if role in {"Worker", "Stepdown"} else [column]
            components = []
            component_cells = []
            for component_column in component_columns:
                component_role = cell_text(sheet, role_row, component_column) or ("Regulator" if len(component_columns) == 1 else None)
                component = {"role": component_role}
                for field, detail_row in detail_rows.items():
                    value = sheet.cell(detail_row, component_column).value
                    component[field] = None if value is None else str(value).strip()
                    component_cells.append(f"{get_column_letter(component_column)}{detail_row}")
                components.append(component)

            records.append(
                {
                    "id": f"reg-{row}-{get_column_letter(column).lower()}",
                    "inletRange": inlet,
                    "outletPressure": outlet,
                    "configuration": "pressure-force" if "Pressure Force" in heading else "fsd",
                    "maximumCapacityCfh": display_integer(capacity),
                    "monitorSetpoint": extract_monitor_setpoint(heading),
                    "stepdownSetpoint": extract_stepdown_setpoint(heading),
                    "components": components,
                    "source": source_ref(
                        "meter-regulator-guidelines",
                        worksheet="Industrial Regulator DS14.11",
                        inletCell=f"A{next(r for r in range(row, 0, -1) if cell_text(sheet, r, 1) and cell_text(sheet, r, 1).startswith('Inlet:'))}",
                        outletCell=f"B{row}",
                        sectionCell=f"{get_column_letter(heading_column)}{row}",
                        capacityCell=f"{get_column_letter(column)}{capacity_row}",
                        componentCells=component_cells,
                    ),
                    "restrictedFieldsOmitted": ["stockNumber"],
                }
            )
    return {"records": records}


def connection_guidelines() -> dict[str, Any]:
    return {
        "connectionRules": [
            {"id": "threaded-low-ip-hp-up-to-14-inwc-3-in-or-less", "inletClasses": ["low", "intermediate", "high"], "maximumOutlet": {"value": 14, "unit": "inWC", "inclusive": True}, "maximumMeterSizeInches": 3, "connection": "threaded", "note": None},
            {"id": "threaded-high-up-to-2-psig-2-in-or-less", "inletClasses": ["high"], "maximumOutlet": {"value": 2, "unit": "psig", "inclusive": True}, "maximumMeterSizeInches": 2, "connection": "threaded", "note": None},
            {"id": "threaded-over-35-under-20-psig-1-in-or-less", "minimumInletPsig": 35, "minimumInletExclusive": True, "maximumOutlet": {"value": 20, "unit": "psig", "inclusive": False}, "maximumMeterSizeInches": 1, "connection": "threaded", "note": "Schedule 80 required"},
            {"id": "welded-all-pressures-4-in-and-above", "minimumMeterSizeInches": 4, "connection": "welded", "note": None},
            {"id": "welded-ip-hp-over-14-inwc-3-in-and-above", "inletClasses": ["intermediate", "high"], "minimumOutlet": {"value": 14, "unit": "inWC", "exclusive": True}, "minimumMeterSizeInches": 3, "connection": "welded", "note": None},
            {"id": "welded-high-over-2-psig-2-in-and-above", "inletClasses": ["high"], "minimumOutlet": {"value": 2, "unit": "psig", "exclusive": True}, "minimumMeterSizeInches": 2, "connection": "welded", "note": None},
            {"id": "welded-over-35-all-pressures-2-in-and-above", "minimumInletPsig": 35, "minimumInletExclusive": True, "minimumMeterSizeInches": 2, "connection": "welded", "note": "Source states: we do not weld less than 2 inches"},
        ],
        "overpressureSettings": [
            {"customerDelivery": {"value": 4.5, "unit": "inWC"}, "recommendedMonitor": {"value": 9, "unit": "inWC"}, "maximumMonitor": {"value": 1, "unit": "psig", "exclusive": True}},
            {"customerDelivery": {"value": 9, "unit": "inWC"}, "recommendedMonitor": {"value": 14, "unit": "inWC"}, "maximumMonitor": {"value": 1, "unit": "psig", "exclusive": True}},
            {"customerDelivery": {"value": 11, "unit": "inWC"}, "recommendedMonitor": {"value": 16, "unit": "inWC"}, "maximumMonitor": {"value": 1, "unit": "psig", "exclusive": True}},
            {"customerDelivery": {"value": 14, "unit": "inWC"}, "recommendedMonitor": {"value": 21, "unit": "inWC"}, "maximumMonitor": {"value": 1, "unit": "psig", "exclusive": True}},
            {"customerDelivery": {"value": 1, "unit": "psig"}, "recommendedMonitor": {"value": 1.25, "unit": "psig"}, "maximumMonitor": {"value": 1.5, "unit": "psig"}},
            {"customerDelivery": {"value": 2, "unit": "psig"}, "recommendedMonitor": {"value": 2.5, "unit": "psig"}, "maximumMonitor": {"value": 3, "unit": "psig"}},
            {"customerDelivery": {"value": 5, "unit": "psig"}, "recommendedMonitor": {"value": 6, "unit": "psig"}, "maximumMonitor": {"value": 7.5, "unit": "psig"}},
        ],
        "source": source_ref(
            "meter-regulator-guidelines",
            worksheet="Threaded vs Welded DS14.9",
            embeddedImages=[{"anchorCell": "C2", "topic": "connection guidelines", "revision": "SAG 11/03/2010"}, {"anchorCell": "Q1", "topic": "overpressure protection settings", "revision": "not stated"}],
        ),
    }


def service_audit(service_data: dict[str, Any]) -> list[dict[str, Any]]:
    findings = []
    for table in service_data["tables"]:
        rows = table["rows"]
        for size in table["sizes"]:
            previous = None
            for row in rows:
                capacity = row["capacitiesCfh"][size["id"]]
                if previous and capacity > previous[1]:
                    findings.append(
                        {
                            "severity": "review",
                            "type": "nonmonotonic-length-capacity",
                            "table": table["id"],
                            "size": size["label"],
                            "previous": {"lengthFt": previous[0], "capacityCfh": previous[1]},
                            "current": {"lengthFt": row["lengthFt"], "capacityCfh": capacity},
                            "action": "Original source values preserved; engineering approval required before correction.",
                        }
                    )
                previous = (row["lengthFt"], capacity)
        for row in rows:
            previous = None
            for size in table["sizes"]:
                capacity = row["capacitiesCfh"][size["id"]]
                if previous and capacity < previous[1]:
                    findings.append(
                        {
                            "severity": "review",
                            "type": "nonmonotonic-size-capacity",
                            "table": table["id"],
                            "lengthFt": row["lengthFt"],
                            "smaller": {"size": previous[0], "capacityCfh": previous[1]},
                            "larger": {"size": size["label"], "capacityCfh": capacity},
                            "action": "Original source values preserved; engineering approval required before correction.",
                        }
                    )
                previous = (size["label"], capacity)
    return findings


def audit_payload(service_data: dict[str, Any], meter_data: dict[str, Any], regulator_data: dict[str, Any]) -> dict[str, Any]:
    findings = service_audit(service_data)
    findings.extend(
        [
            {"severity": "info", "type": "duplicate-source", "detail": "Diaphragm (2021) and Full version contain the same numeric capacity table with different model-label formatting.", "action": "Diaphragm (2021) selected as the public source."},
            {"severity": "review", "type": "duplicate-source-conflict", "detail": "Earlier FSD rotary/turbine worksheets use rounded pressure factors and differ slightly from the later Final Revision workbook.", "action": "Final Revision workbook selected as the public rotary/turbine source; earlier values are not silently merged."},
            {"severity": "restricted", "type": "excluded-public-data", "detail": "The Final Revision pricing worksheet and industrial-regulator stock numbers are excluded from public JSON.", "action": "Use authenticated server-side storage for any future internal view."},
            {"severity": "review", "type": "missing-source-limit", "detail": "The diaphragm table does not publish minimum-flow limits.", "action": "Diaphragm results are maximum-capacity screening only."},
            {"severity": "review", "type": "overlapping-inlet-range", "detail": "Regulator inlet categories overlap at 30-35 psig and at 60 psig.", "action": "The UI requires explicit source-category selection."},
            {"severity": "review", "type": "connection-rule-gap", "detail": "The DS14.9 connection image leaves some boundary combinations unstated and has overlapping general/specific rules.", "action": "Return engineering review when the rule match is absent or conflicting."},
            {"severity": "info", "type": "revision-metadata", "detail": "The guideline workbook has DS14.11/DS14.9 identifiers but no single stated workbook revision.", "action": "Manifest records worksheet identifiers and the workbook modified timestamp."},
        ]
    )
    return {
        "summary": {
            "serviceTableCount": len(service_data["tables"]),
            "serviceCapacityRecordCount": sum(len(table["rows"]) * len(table["sizes"]) for table in service_data["tables"]),
            "meterRecordCount": len(meter_data["records"]),
            "regulatorArrangementCount": len(regulator_data["records"]),
            "findingCount": len(findings),
        },
        "findings": findings,
    }


def manifest(pdf_path: Path, guidelines_path: Path, final_path: Path) -> dict[str, Any]:
    return {
        "documents": [
            {"id": "maximum-service-capacity", "title": "Maximum Service Capacity Table (5913_0)", "format": "PDF", "revision": "Last updated 2022-03-22", "sha256": sha256(pdf_path), "publicFileIncluded": False},
            {"id": "meter-regulator-guidelines", "title": "Meter & Regulator Selection Guidelines (DS14.11 / DS14.9)", "format": "XLSX", "revision": "Workbook modified 2025-03-26; worksheet identifiers DS14.11 and DS14.9", "sha256": sha256(guidelines_path), "publicFileIncluded": False, "publicExclusions": ["stock numbers", "embedded source workbook"]},
            {"id": "rotary-turbine-final", "title": "Rotary & Turbine Meter Capacity Table (Final Revision)", "format": "XLSX", "revision": "Workbook modified 2022-11-09", "sha256": sha256(final_path), "publicFileIncluded": False, "publicExclusions": ["pricing worksheet", "embedded source workbook"]},
        ],
        "websiteDemandHeatingValueBtuPerCf": 1035,
        "servicePdfExampleHeatingValueBtuPerCf": 1000,
        "runtimeSourceParsingRequired": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--service-pdf", type=Path, required=True)
    parser.add_argument("--guidelines-xlsx", type=Path, required=True)
    parser.add_argument("--meter-xlsx", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data/gas-equipment"))
    args = parser.parse_args()

    service_data = extract_service_data(args.service_pdf)
    meter_data = extract_meter_data(args.guidelines_xlsx, args.meter_xlsx)
    regulator_data = extract_regulator_data(args.guidelines_xlsx)
    connection_data = connection_guidelines()
    audit = audit_payload(service_data, meter_data, regulator_data)

    write_json(args.output_dir / "service-capacity.json", service_data)
    write_json(args.output_dir / "meters.json", meter_data)
    write_json(args.output_dir / "regulators-public.json", regulator_data)
    write_json(args.output_dir / "connection-guidelines.json", connection_data)
    write_json(args.output_dir / "source-manifest.json", manifest(args.service_pdf, args.guidelines_xlsx, args.meter_xlsx))
    write_json(args.output_dir / "audit-report.json", audit)
    print(json.dumps(audit["summary"], indent=2))


if __name__ == "__main__":
    main()
