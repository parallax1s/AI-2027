import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../graph.html", import.meta.url), "utf8");
const js = fs.readFileSync(new URL("../graph.js", import.meta.url), "utf8");

assert.match(html, /id="customDoublingDays"/, "HTML should expose an adjustable doubling-days input");
assert.match(html, /id="pointLabelsToggle"/, "HTML should expose a model-label visibility toggle");
assert.match(html, /id="customDoublingIntercept"/, "HTML should expose the 101-day curve intercept offset input");
assert.match(html, /id="customDoublingIntercept"[^>]*value="0\.75"/, "101-day curve intercept should default to +0.75 doublings");
assert.match(html, /id="doublingInterceptDown"/, "HTML should expose a minus button for 101-day curve intercept");
assert.match(html, /id="doublingInterceptUp"/, "HTML should expose a plus button for 101-day curve intercept");
assert.match(html, /id="linearTopCutoff"/, "HTML should expose a slider for the linear y-axis top cutoff");
assert.match(html, /id="linearTopValue"/, "HTML should expose a readable linear y-axis top cutoff value");
assert.match(html, />On\/off</, "data table should label model visibility controls as on/off toggles");
assert.match(html, /id="yScaleMode"/, "HTML should expose a y-scale mode selector");
assert.match(html, /value="source"/, "y-scale selector should keep a source-image-aligned mode");
assert.match(html, /value="log"/, "y-scale selector should offer a true log mode");
assert.match(html, /value="linear"/, "y-scale selector should offer a linear mode");
assert.match(js, /customDoublingDays/, "graph code should read the adjustable doubling-days input");
assert.match(js, /getCustomDoublingIntercept/, "graph code should read the 101-day intercept offset");
assert.match(js, /2 \*\* getCustomDoublingIntercept/, "101-day intercept offset should shift the curve vertically in log space");
assert.match(js, /doublingInterceptDown/, "graph code should wire the intercept minus button");
assert.match(js, /doublingInterceptUp/, "graph code should wire the intercept plus button");
assert.match(js, /adjustable-doubling/, "graph code should update the adjustable doubling curve");

assert.match(js, /pointToggleInputs/, "graph code should keep per-point toggle state");
assert.match(js, /pointLabelsToggle/, "graph code should read the model-label visibility toggle");
assert.match(js, /Toggle \$\{point\.label\}/, "each model row should expose a point toggle control");
assert.match(js, /data-point/, "rendered point groups should carry point IDs for visibility toggles");
assert.match(js, /hidePoints/, "point visibility should be configurable from URL state");
assert.match(js, /params\.has\("labels"\)/, "model-label visibility should be configurable from URL state");
assert.match(js, /yScaleSource/, "graph code should retain source-aligned y-scale math");
assert.match(js, /yScaleLog/, "graph code should support true log y-scale math");
assert.match(js, /yScaleLinear/, "graph code should support linear y-scale math");
assert.match(js, /linearYMaxMinutes/, "linear y-scale should have a dedicated lower-range maximum");
assert.match(js, /getLinearTopCutoffMinutes/, "linear y-scale should read its top cutoff from the slider");
assert.match(js, /params\.has\("linearTop"\)/, "linear y-scale top cutoff should be configurable from URL state");
assert.match(js, /updateLinearTopCutoffLabel/, "graph code should update the visible linear top cutoff label");
assert.match(js, /linearVisibleYTicks/, "linear mode should reduce crowded low-end y tick labels");
assert.match(js, />= 72/, "linear mode should keep tick labels visually separated");
assert.match(js, /shouldDrawPointLabel/, "linear mode should suppress labels that would pile up near the baseline");
assert.match(js, /params\.has\("scale"\)/, "y-scale mode should be configurable from URL state");

console.log("graph UI controls ok");
