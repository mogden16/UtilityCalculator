"""Lightweight CLI for PJM Data Miner debugging."""

from __future__ import annotations

import argparse
from typing import Any

from .client import PJMDataMinerClient


def _print_summary(data: Any) -> None:
    try:
        import pandas as pd

        if isinstance(data, pd.DataFrame):
            print(f"Rows: {len(data)}")
            if "fuel_type" in data.columns:
                print("Fuel types:", ", ".join(sorted(data["fuel_type"].dropna().unique())))
            print(data.head())
            return
    except Exception:  # pragma: no cover - fallback for environments without pandas display
        pass
    print(data)


def main() -> None:
    parser = argparse.ArgumentParser(description="PJM Data Miner 2 CLI helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    gen_parser = subparsers.add_parser("gen_by_fuel", help="Fetch generation by fuel")
    gen_parser.add_argument("--start", type=str, help="Start datetime (ISO)", default=None)
    gen_parser.add_argument("--end", type=str, help="End datetime (ISO)", default=None)
    gen_parser.add_argument("--row-count", type=int, help="Maximum rows to fetch", default=None)
    gen_parser.add_argument(
        "--output",
        choices=["dataframe", "json", "csv"],
        default="dataframe",
        help="Output format",
    )

    args = parser.parse_args()
    client = PJMDataMinerClient()

    if args.command == "gen_by_fuel":
        data = client.fetch_gen_by_fuel(
            start=args.start,
            end=args.end,
            row_count=args.row_count,
            output_format=args.output,
        )
        _print_summary(data)


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()
