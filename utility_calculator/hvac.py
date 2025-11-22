"""HVAC and load conversions built on standard engineering assumptions."""

from .constants import BTUH_PER_TON, HEATING_VALUE_MMBTU_PER_MCF
from .gas import mmbtu_to_mcf
from .units import btuh_to_mmbtuh


def tons_to_btuh(tons: float) -> float:
    """Convert cooling capacity in tons to Btu/h.

    Assumes the industry standard 1 ton = 12,000 Btu/h.
    """

    return tons * BTUH_PER_TON


def btuh_to_tons(btuh: float) -> float:
    """Convert Btu/h to cooling tons using 1 ton = 12,000 Btu/h."""

    return btuh / BTUH_PER_TON


def tons_to_mcf_per_hr(
    tons: float,
    eff: float = 1.0,
    hv_mmbtu_per_mcf: float = HEATING_VALUE_MMBTU_PER_MCF,
) -> float:
    """Calculate required natural gas flow (MCF/h) to serve a cooling load.

    The calculation converts the cooling load in tons to Btu/h, then to MMBtu/h,
    accounts for equipment efficiency, and finally converts the required heat input
    to thousand cubic feet per hour using the provided gas heating value.

    Parameters
    ----------
    tons: float
        Cooling capacity in tons.
    eff: float, optional
        Thermal efficiency (fractional). Defaults to 1.0 (100% efficient).
    hv_mmbtu_per_mcf: float, optional
        Gas heating value in MMBtu per MCF. Defaults to :data:`HEATING_VALUE_MMBTU_PER_MCF`.

    Returns
    -------
    float
        Required gas input in MCF per hour.

    Raises
    ------
    ValueError
        If ``eff`` is not positive.
    """

    if eff <= 0:
        raise ValueError("Efficiency must be greater than zero.")

    btuh_required = tons_to_btuh(tons)
    mmbtuh_required = btuh_to_mmbtuh(btuh_required)
    input_mmbtuh = mmbtuh_required / eff
    return mmbtu_to_mcf(input_mmbtuh, hv_mmbtu_per_mcf)
