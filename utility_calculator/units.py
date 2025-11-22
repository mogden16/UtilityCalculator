"""Generic unit conversions for thermal energy.

The functions here provide basic conversions between Btu/h and MMBtu/h using the
standard relationship of 1,000,000 Btu per MMBtu.
"""

from .constants import BTU_PER_MMBTU


def btuh_to_mmbtuh(btuh: float) -> float:
    """Convert a heat rate from Btu/h to MMBtu/h.

    Parameters
    ----------
    btuh: float
        Heat rate in Btu per hour.

    Returns
    -------
    float
        Heat rate in MMBtu per hour.
    """

    return btuh / BTU_PER_MMBTU


def mmbtuh_to_btuh(mmbtuh: float) -> float:
    """Convert a heat rate from MMBtu/h to Btu/h.

    Parameters
    ----------
    mmbtuh: float
        Heat rate in million Btu per hour.

    Returns
    -------
    float
        Heat rate in Btu per hour.
    """

    return mmbtuh * BTU_PER_MMBTU
