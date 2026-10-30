import json
from pathlib import Path


DATA_DIR = Path(__file__).parents[1] / "data" / "gas-equipment"


def load(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def test_normalized_source_counts_and_traceability():
    service = load("service-capacity.json")
    meters = load("meters.json")
    regulators = load("regulators-public.json")

    assert len(service["tables"]) == 12
    assert sum(len(table["rows"]) * len(table["sizes"]) for table in service["tables"]) == 1760
    assert len(meters["records"]) == 665
    assert len(regulators["records"]) == 150

    assert all(row["source"]["document"] for table in service["tables"] for row in table["rows"])
    assert all(record["source"]["worksheet"] for record in meters["records"])
    assert all(record["source"]["capacityCell"] for record in regulators["records"])


def test_public_data_excludes_pricing_and_stock_values():
    public_payload = "\n".join(
        (DATA_DIR / name).read_text(encoding="utf-8")
        for name in ["meters.json", "regulators-public.json", "service-capacity.json"]
    )

    assert "114713" not in public_payload
    assert "5512.49" not in public_payload
    assert "30827.07" not in public_payload
    assert "TURBINE METER 45˚ANGLE PRICING" not in public_payload


def test_audit_preserves_documented_nonmonotonic_values():
    audit = load("audit-report.json")
    anomalies = [
        finding
        for finding in audit["findings"]
        if finding["type"] == "nonmonotonic-length-capacity"
    ]

    assert len(anomalies) == 4
    assert {
        (finding["table"], finding["size"], finding["previous"]["capacityCfh"], finding["current"]["capacityCfh"])
        for finding in anomalies
    } == {
        ("plastic-existing-low", '1" CTS', 194, 198),
        ("plastic-existing-low", '1 1/4" IPS', 708, 746),
        ("plastic-new-intermediate", '2" IPS', 8030, 8037),
        ("steel-existing-low", '3" IPS', 3949, 3998),
    }
