# UtilityCalculator

A lightweight engineering toolbox for common HVAC and natural gas conversions. The
package exposes clear functions with documented assumptions and a simple CLI for
quick calculations.

## Engineering assumptions

- 1 ton of cooling = 12,000 Btu/h.
- 1,000,000 Btu = 1 MMBtu.
- 1 Dth = 1 MMBtu.
- Default gas heating value: 1.035 MMBtu per MCF (PGW convention).

## Package layout

```
utility_calculator/
    __init__.py
    constants.py
    units.py
    hvac.py
    gas.py
    cli.py
```

Tests live under `tests/` and cover the anchor values described above.

## Python usage

```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Example conversions:

```python
from utility_calculator import (
    btuh_to_mmbtuh,
    btuh_to_tons,
    mcf_to_mmbtu,
    tons_to_mcf_per_hr,
)

print(btuh_to_tons(36_000_000))          # 3000 tons
print(btuh_to_mmbtuh(36_000_000))        # 36 MMBtu/h
print(mcf_to_mmbtu(1))                   # 1.035 MMBtu at default HV
print(tons_to_mcf_per_hr(3000))          # ~34.78 MCF/h at 100% eff
```

## CLI usage

Run common conversions straight from the command line:

```
python -m utility_calculator.cli tons-to-mcf --tons 3000 --eff 0.85
python -m utility_calculator.cli tons-to-btuh 150
python -m utility_calculator.cli mmbtuh-to-btuh 36
```

Each subcommand prints the numeric result for piping into other tools.

## Testing

Run the pytest suite after installing the Python requirements:

```
pytest
```
