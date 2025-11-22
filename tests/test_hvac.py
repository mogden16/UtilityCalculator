import math

import pytest

from utility_calculator.hvac import btuh_to_tons, tons_to_btuh, tons_to_mcf_per_hr


@pytest.mark.parametrize(
    "tons, expected_btuh",
    [
        (3_000.0, 36_000_000.0),
        (1.0, 12_000.0),
    ],
)
def test_tons_to_btuh(tons: float, expected_btuh: float):
    assert math.isclose(tons_to_btuh(tons), expected_btuh)
    assert math.isclose(btuh_to_tons(expected_btuh), tons)


def test_tons_to_mcf_anchor_values():
    mcf_per_hr = tons_to_mcf_per_hr(3_000.0)
    assert mcf_per_hr == pytest.approx(34.7826087, rel=1e-6)


def test_tons_to_mcf_requires_positive_efficiency():
    with pytest.raises(ValueError):
        tons_to_mcf_per_hr(100.0, eff=0)
