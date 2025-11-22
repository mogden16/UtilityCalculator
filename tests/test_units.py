import math

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
