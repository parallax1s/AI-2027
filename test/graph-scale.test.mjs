import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const data = context.window.METR_GRAPH_DATA;

assert.equal(
  data.yAxisScale?.mode,
  "equal-tick-log",
  "y-axis should match the source image's evenly spaced labeled log ticks",
);

const top = 146;
const bottom = 1442;
const tickBottom = data.yAxisScale.tickBottom;
const tickTop = data.yAxisScale.tickTop;
const ticks = data.yTicks;
const gap = (tickBottom - tickTop) / (ticks.length - 1);
const positions = ticks.map((_, index) => tickBottom - gap * index);

assert.equal(tickTop, top, "5 years tick should stay aligned to the source chart top");
assert.ok(tickBottom < bottom, "8 sec tick should sit above the source chart bottom axis");

for (let i = 1; i < positions.length; i += 1) {
  assert.ok(Math.abs(positions[i - 1] - positions[i] - gap) < 0.000001);
}

const eightHoursIndex = ticks.findIndex((tick) => tick.label === "8 hrs");
const oneWeekIndex = ticks.findIndex((tick) => tick.label === "1 week");
assert.equal(oneWeekIndex - eightHoursIndex, 1);
assert.ok(
  Math.abs(positions[eightHoursIndex] - positions[oneWeekIndex] - gap) < 0.000001,
  "8 hrs -> 1 week should be one visual tick step, not a double step",
);

console.log("graph scale ok");
