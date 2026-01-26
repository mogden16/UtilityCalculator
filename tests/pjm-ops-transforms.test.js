const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  computePeak,
  computeMinMax,
  aggregateEmissionsMedian,
} = require("../lib/pjm-ops/transforms.js");

test("computePeak returns highest value and timestamp", () => {
  const points = [
    { timestamp: new Date("2024-01-01T00:00:00Z"), value: 10 },
    { timestamp: new Date("2024-01-01T01:00:00Z"), value: 25 },
    { timestamp: new Date("2024-01-01T02:00:00Z"), value: 5 },
  ];
  const peak = computePeak(points);
  assert.equal(peak.value, 25);
  assert.equal(peak.timestamp?.toISOString(), "2024-01-01T01:00:00.000Z");
});

test("computeMinMax returns nulls for empty series", () => {
  const result = computeMinMax([]);
  assert.equal(result.min, null);
  assert.equal(result.max, null);
});

test("aggregateEmissionsMedian returns median by timestamp", () => {
  const records = [
    { timestamp: "2024-01-01T00:00:00Z", value: 100 },
    { timestamp: "2024-01-01T00:00:00Z", value: 200 },
    { timestamp: "2024-01-01T00:00:00Z", value: 300 },
    { timestamp: "2024-01-01T01:00:00Z", value: 50 },
    { timestamp: "2024-01-01T01:00:00Z", value: 70 },
  ];
  const result = aggregateEmissionsMedian(records);
  assert.equal(result.length, 2);
  assert.equal(result[0].value, 200);
  assert.equal(result[1].value, 60);
});
