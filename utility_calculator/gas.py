"""Natural gas conversions for heating value and billing units."""

from .constants import HEATING_VALUE_MMBTU_PER_MCF


def mcf_to_mmbtu(mcf: float, hv_mmbtu_per_mcf: float = HEATING_VALUE_MMBTU_PER_MCF) -> float:
    """Convert thousand cubic feet (MCF) of natural gas to MMBtu using a heating value.

    Parameters
    ----------
    mcf: float
        Gas volume in thousand cubic feet.
    hv_mmbtu_per_mcf: float, optional
        Heating value in MMBtu per MCF. Defaults to :data:`HEATING_VALUE_MMBTU_PER_MCF`.

    Returns
    -------
    float
        Energy content in MMBtu.
    """

    return mcf * hv_mmbtu_per_mcf


def mmbtu_to_mcf(mmbtu: float, hv_mmbtu_per_mcf: float = HEATING_VALUE_MMBTU_PER_MCF) -> float:
    """Convert MMBtu to required MCF using a heating value.

    Parameters
    ----------
    mmbtu: float
        Energy requirement in MMBtu.
    hv_mmbtu_per_mcf: float, optional
        Heating value in MMBtu per MCF. Defaults to :data:`HEATING_VALUE_MMBTU_PER_MCF`.

    Returns
    -------
    float
        Equivalent gas volume in MCF.
    """

    return mmbtu / hv_mmbtu_per_mcf


def mcf_to_dth(mcf: float, hv_mmbtu_per_mcf: float = HEATING_VALUE_MMBTU_PER_MCF) -> float:
    """Convert MCF to dekatherms (Dth).

    Because 1 Dth is defined as 1 MMBtu, this uses the same calculation as
    :func:`mcf_to_mmbtu`.
    """

    return mcf_to_mmbtu(mcf, hv_mmbtu_per_mcf)


def dth_to_mcf(dth: float, hv_mmbtu_per_mcf: float = HEATING_VALUE_MMBTU_PER_MCF) -> float:
    """Convert dekatherms (Dth) to MCF.

    Parameters
    ----------
    dth: float
        Energy content in Dth (equivalent to MMBtu).
    hv_mmbtu_per_mcf: float, optional
        Heating value in MMBtu per MCF. Defaults to :data:`HEATING_VALUE_MMBTU_PER_MCF`.

    Returns
    -------
    float
        Equivalent gas volume in MCF.
    """

    return mmbtu_to_mcf(dth, hv_mmbtu_per_mcf)
