import math
import re
from pathlib import Path

import pytest

from utility_calculator.constants import BTU_PER_MMBTU
from utility_calculator.units import btuh_to_mmbtuh, mmbtuh_to_btuh


def test_btuh_to_mmbtuh_and_back():
    btuh_value = 36_000_000.0
    mmbtuh_value = btuh_to_mmbtuh(btuh_value)
    assert math.isclose(mmbtuh_value, 36.0)
    assert math.isclose(mmbtuh_to_btuh(mmbtuh_value), btuh_value)


def test_constants_relationship():
    assert BTU_PER_MMBTU == 1_000_000.0
    assert math.isclose(btuh_to_mmbtuh(BTU_PER_MMBTU), 1.0)
    assert math.isclose(mmbtuh_to_btuh(1.0), BTU_PER_MMBTU)


def _extract_constant(name: str, content: str) -> float:
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*([0-9][0-9_\.]*);", content)
    if not match:
        msg = f"Constant {name} not found"
        raise AssertionError(msg)
    return float(match.group(1).replace("_", ""))


def _get_conversion_energy_section(content: str) -> str:
    energy_section = re.search(r"energy:\s*{.*?units:\s*{(?P<section>.*?)}\s*,\s*}\s*,", content, re.DOTALL)
    if not energy_section:
        raise AssertionError("Energy conversion section not found")
    return energy_section.group("section")


def _get_conversion_category_section(category: str, content: str) -> str:
    pattern = r"" + re.escape(category) + r":\s*{.*?units:\s*{(?P<section>.*?)}\s*,\s*}\s*,"
    section_match = re.search(pattern, content, re.DOTALL)
    if not section_match:
        raise AssertionError(f"{category} conversion section not found")
    return section_match.group("section")


def _parse_unit_multiplier(expression: str, content: str) -> float:
    expression = expression.strip()
    if expression == "value":
        return 1.0
    multiplier_match = re.match(r"value\s*\*\s*(?P<factor>[\w_\.]+)", expression)
    if multiplier_match:
        factor = multiplier_match.group("factor")
        return _extract_constant(factor, content) if not factor.replace("_", "").isdigit() else float(factor.replace("_", ""))
    divider_match = re.match(r"value\s*/\s*(?P<factor>[\w_\.]+)", expression)
    if divider_match:
        factor = divider_match.group("factor")
        divisor = _extract_constant(factor, content) if not factor.replace("_", "").isdigit() else float(factor.replace("_", ""))
        return 1.0 / divisor
    msg = f"Unsupported unit expression: {expression}"
    raise AssertionError(msg)


def _extract_unit_conversion_multipliers(unit_key: str, category: str, content: str) -> tuple[float, float]:
    section = _get_conversion_category_section(category, content)
    pattern = (
        rf"{unit_key}:\s*{{\s*label:\s*\"[^\"]+\".*?"
        rf"toBase:\s*\(value\)\s*=>\s*(?P<to>[^,]+),\s*"
        rf"fromBase:\s*\(value\)\s*=>\s*(?P<from>[^,]+)"
    )
    match = re.search(pattern, section, re.DOTALL)
    if not match:
        msg = f"Unit {unit_key} not found in {category}"
        raise AssertionError(msg)
    return _parse_unit_multiplier(match.group("to"), content), _parse_unit_multiplier(match.group("from"), content)


def _extract_energy_unit_factors(unit_key: str, content: str) -> tuple[str, str]:
    section = _get_conversion_energy_section(content)
    pattern = (
        rf"{unit_key}:\s*{{\s*label:\s*\"[^\"]+\".*?"
        rf"toBase:\s*\(value\)\s*=>\s*value\s*\*\s*(?P<to>[\w_\.]+).*?"
        rf"fromBase:\s*\(value\)\s*=>\s*value\s*/\s*(?P<from>[\w_\.]+)"
    )
    match = re.search(pattern, section, re.DOTALL)
    if not match:
        msg = f"Unit {unit_key} not found"
        raise AssertionError(msg)
    return match.group("to"), match.group("from")


def test_mlb_listed_in_conversion_energy_units():
    content = Path("app/page.tsx").read_text()
    assert "mlb:" in _get_conversion_energy_section(content)


def test_mlb_conversion_matches_mmbtu():
    content = Path("app/page.tsx").read_text()
    mlb_to, mlb_from = _extract_energy_unit_factors("mlb", content)
    mmbtu_to, mmbtu_from = _extract_energy_unit_factors("mmbtu", content)

    mlb_factor = _extract_constant(mlb_to, content) if not mlb_to.replace("_", "").isdigit() else float(mlb_to.replace("_", ""))
    mmbtu_factor = _extract_constant(mmbtu_to, content) if not mmbtu_to.replace("_", "").isdigit() else float(mmbtu_to.replace("_", ""))

    assert math.isclose(mlb_factor, mmbtu_factor), "MLB should use the same base factor as MMBtu"

    base_btus = 1.0 * mlb_factor
    converted_mmbtu = base_btus / (float(mmbtu_from.replace("_", "")) if mmbtu_from.replace("_", "").isdigit() else _extract_constant(mmbtu_from, content))

    assert math.isclose(converted_mmbtu, 1.0), "1 MLB should convert to 1 MMBtu"


def test_mcfh_converts_to_cfh_and_back():
    content = Path("app/page.tsx").read_text()
    cfh_to, cfh_from = _extract_unit_conversion_multipliers("cfh", "flow", content)
    mcfh_to, mcfh_from = _extract_unit_conversion_multipliers("mcfh", "flow", content)

    base_from_mcfh = 1.0 * mcfh_to
    converted_cfh = base_from_mcfh * cfh_from
    assert math.isclose(converted_cfh, 1000.0), "1 MCFH should equal 1000 CFH"

    base_from_cfh = 1.0 * cfh_to
    converted_mcfh = base_from_cfh * mcfh_from
    assert math.isclose(converted_mcfh, 0.001), "1 CFH should equal 0.001 MCFH"


def test_mw_converts_to_kw_and_back():
    content = Path("app/page.tsx").read_text()
    kw_to, kw_from = _extract_unit_conversion_multipliers("kw", "power", content)
    mw_to, mw_from = _extract_unit_conversion_multipliers("mw", "power", content)

    base_from_mw = 1.0 * mw_to
    converted_kw = base_from_mw * kw_from
    assert math.isclose(converted_kw, 1000.0), "1 MW should equal 1000 kW"

    base_from_kw = 1.0 * kw_to
    converted_mw = base_from_kw * mw_from
    assert math.isclose(converted_mw, 0.001), "1 kW should equal 0.001 MW"
