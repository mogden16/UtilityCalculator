"""Shared engineering constants for utility calculations."""

BTUH_PER_TON: float = 12_000.0
"""Btu per hour equivalent for one ton of cooling capacity."""

BTU_PER_MMBTU: float = 1_000_000.0
"""British thermal units contained in one million British thermal units."""

HEATING_VALUE_MMBTU_PER_MCF: float = 1.035
"""Default natural gas higher heating value (MMBtu) per thousand cubic feet (MCF).

This follows the Philadelphia Gas Works (PGW) convention where 1 MCF ≈ 1.035 MMBtu.
"""
