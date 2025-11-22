import math

from utility_calculator.constants import HEATING_VALUE_MMBTU_PER_MCF
from utility_calculator.gas import dth_to_mcf, mcf_to_dth, mcf_to_mmbtu, mmbtu_to_mcf


def test_mcf_to_mmbtu_and_dth_anchor():
    assert math.isclose(mcf_to_mmbtu(1.0), HEATING_VALUE_MMBTU_PER_MCF)
    assert math.isclose(mcf_to_dth(1.0), HEATING_VALUE_MMBTU_PER_MCF)


def test_mmbtu_to_mcf_anchor():
    assert math.isclose(mmbtu_to_mcf(HEATING_VALUE_MMBTU_PER_MCF), 1.0)
    assert math.isclose(dth_to_mcf(HEATING_VALUE_MMBTU_PER_MCF), 1.0)
