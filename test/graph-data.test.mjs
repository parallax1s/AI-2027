import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const data = context.window.METR_GRAPH_DATA;
const points = data.metr80Points;

function findPoint(label) {
  return points.find((point) => point.label === label);
}

assert.ok(
  data.metrFrontierFit && data.metrFrontierFit.sourceUrl.includes("benchmark_results_1_1.yaml"),
  "METR p80 frontier fit should be generated from the public benchmark results",
);

assert.ok(
  !data.series.some((series) => series.id === "metr-frontier-p80"),
  "METR p80 frontier fit should stay out of the visible source-image curve set",
);

const exponential = data.series.find((series) => series.id === "metr-paper-exponential");
assert.equal(exponential?.doublingMonths, 7, "source exponential baseline should keep the 7-month doubling time");

const adjustableDoubling = data.series.find((series) => series.id === "adjustable-doubling");
assert.equal(adjustableDoubling?.doublingDays, 101, "adjustable doubling curve should default to 101 days");
assert.equal(adjustableDoubling?.kind, "exponential", "adjustable doubling curve should use exponential math");

const sourceCurveIds = ["original-erroneous", "daniel-mode", "daniel-median", "eli-median"];
assert.equal(
  JSON.stringify(data.series.map((series) => series.id)),
  JSON.stringify(["metr-paper-exponential", "adjustable-doubling", ...sourceCurveIds]),
  "visible curve controls should include source-image curves and the adjustable doubling curve",
);
for (const id of sourceCurveIds) {
  const series = data.series.find((candidate) => candidate.id === id);
  assert.equal(series?.kind, "points-log2", `${id} should be a digitized source curve, not a quadratic placeholder`);
  assert.ok(series.points.length >= 20, `${id} should contain enough source points for curve drawing`);
}

assert.equal(findPoint("Claude Mythos Preview (early)")?.releaseDate, "2026-04-07");
assert.equal(findPoint("Claude Mythos Preview (early)")?.minutes, 185.911829);
assert.equal(findPoint("Gemini 3.1 Pro")?.minutes, 89.801503);
assert.equal(findPoint("GPT-5.4 (xhigh)")?.minutes, 53.877851);

const frontierPoints = points.filter((point) => point.frontierP80);
assert.ok(frontierPoints.length >= 10, "expected enough frontier points for a real curve fit");
assert.equal(frontierPoints.at(-1)?.label, "Claude Mythos Preview (early)");

console.log("graph data ok");
