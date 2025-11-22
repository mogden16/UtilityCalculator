"""Simple command line interface for common UtilityCalculator conversions."""

import argparse
from typing import Callable

from . import (
    btuh_to_mmbtuh,
    btuh_to_tons,
    dth_to_mcf,
    mcf_to_dth,
    mcf_to_mmbtu,
    mmbtuh_to_btuh,
    mmbtu_to_mcf,
    tons_to_btuh,
    tons_to_mcf_per_hr,
)
from .constants import HEATING_VALUE_MMBTU_PER_MCF


def _add_common_arguments(subparser: argparse.ArgumentParser) -> None:
    subparser.add_argument("value", type=float, help="Input value for the conversion")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="UtilityCalculator CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    conversions: dict[str, tuple[str, Callable[[float], float]]] = {
        "tons-to-btuh": ("Convert tons to Btu/h", tons_to_btuh),
        "btuh-to-tons": ("Convert Btu/h to tons", btuh_to_tons),
        "btuh-to-mmbtuh": ("Convert Btu/h to MMBtu/h", btuh_to_mmbtuh),
        "mmbtuh-to-btuh": ("Convert MMBtu/h to Btu/h", mmbtuh_to_btuh),
        "mcf-to-mmbtu": ("Convert MCF to MMBtu", mcf_to_mmbtu),
        "mmbtu-to-mcf": ("Convert MMBtu to MCF", mmbtu_to_mcf),
        "mcf-to-dth": ("Convert MCF to Dth", mcf_to_dth),
        "dth-to-mcf": ("Convert Dth to MCF", dth_to_mcf),
    }

    for name, (help_text, func) in conversions.items():
        sub = subparsers.add_parser(name, help=help_text)
        _add_common_arguments(sub)
        sub.set_defaults(func=func)

    tons_to_mcf = subparsers.add_parser(
        "tons-to-mcf", help="Convert cooling load in tons to required MCF/h"
    )
    tons_to_mcf.add_argument("tons", type=float, help="Cooling load in tons")
    tons_to_mcf.add_argument(
        "--eff",
        type=float,
        default=1.0,
        help="Thermal efficiency fraction (default: 1.0)",
    )
    tons_to_mcf.add_argument(
        "--hv",
        type=float,
        default=HEATING_VALUE_MMBTU_PER_MCF,
        help="Heating value in MMBtu/MCF (default matches PGW convention)",
    )
    tons_to_mcf.set_defaults(func="tons-to-mcf")

    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "tons-to-mcf":
        result = tons_to_mcf_per_hr(args.tons, eff=args.eff, hv_mmbtu_per_mcf=args.hv)
    else:
        conversion = getattr(args, "func")
        result = conversion(args.value)

    print(result)


if __name__ == "__main__":
    main()
