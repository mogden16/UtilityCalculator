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
