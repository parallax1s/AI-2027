(function () {
  "use strict";

  const data = window.METR_GRAPH_DATA;
  const overlay = document.getElementById("overlay");
  const tooltip = document.getElementById("graphTooltip");
  const table = document.getElementById("graphDataTable");
  const graphImage = document.querySelector(".graph-image");
  const backgroundToggle = document.getElementById("backgroundToggle");
  const backgroundOpacity = document.getElementById("backgroundOpacity");
  const pointSize = document.getElementById("pointSize");
  const curvesToggle = document.getElementById("curvesToggle");
  const curveSmoothToggle = document.getElementById("curveSmoothToggle");
  const curveOpacity = document.getElementById("curveOpacity");
  const customDoublingDays = document.getElementById("customDoublingDays");
  const customDoublingIntercept = document.getElementById("customDoublingIntercept");
  const doublingInterceptDown = document.getElementById("doublingInterceptDown");
  const doublingInterceptUp = document.getElementById("doublingInterceptUp");
  const linearTopCutoff = document.getElementById("linearTopCutoff");
  const linearTopValue = document.getElementById("linearTopValue");
  const yScaleMode = document.getElementById("yScaleMode");
  const curveToggles = document.getElementById("curveToggles");
  const params = new URLSearchParams(window.location.search);
  const yScaleModes = new Set(["source", "log", "linear"]);
  const curveToggleInputs = new Map();
  const curveToggleLabels = new Map();
  const pointToggleInputs = new Map();
  const hiddenPointIds = new Set((params.get("hidePoints") || "").split(",").filter(Boolean));

  const chart = {
    left: 330,
    right: 2412,
    top: 146,
    bottom: 1442,
    xMin: 2021,
    xMax: 2028,
    yMin: 0.0833333333,
    yMax: 2628000,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  if (params.has("bg")) {
    const opacity = clamp(Number(params.get("bg")), 0, 1);
    backgroundOpacity.value = String(opacity);
    backgroundToggle.checked = opacity > 0;
  }

  if (params.has("curves")) curvesToggle.checked = params.get("curves") !== "0";
  if (params.has("smooth")) curveSmoothToggle.checked = params.get("smooth") !== "0";

  if (params.has("curveOpacity")) {
    curveOpacity.value = String(clamp(Number(params.get("curveOpacity")), 0, 1));
  }

  if (params.has("doublingDays")) {
    customDoublingDays.value = String(clamp(Number(params.get("doublingDays")), 14, 730));
  }

  if (params.has("intercept")) {
    customDoublingIntercept.value = String(
      clamp(Number(params.get("intercept")), Number(customDoublingIntercept.min), Number(customDoublingIntercept.max)),
    );
  }

  if (params.has("scale") && yScaleModes.has(params.get("scale"))) {
    yScaleMode.value = params.get("scale");
  }

  if (params.has("linearTop")) {
    const topMinutes = Number(params.get("linearTop"));
    if (Number.isFinite(topMinutes) && topMinutes > 0) {
      linearTopCutoff.value = String(
        clamp(Math.log2(topMinutes), Number(linearTopCutoff.min), Number(linearTopCutoff.max)),
      );
    }
  }

  function decimalYear(dateString) {
    const date = new Date(`${dateString}T00:00:00Z`);
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
    return date.getUTCFullYear() + (date.getTime() - start) / (end - start);
  }

  function xScale(year) {
    return chart.left + ((year - chart.xMin) / (chart.xMax - chart.xMin)) * (chart.right - chart.left);
  }

  function yTickPosition(index) {
    const tickBottom = data.yAxisScale.tickBottom;
    const tickTop = data.yAxisScale.tickTop;
    const gap = (tickBottom - tickTop) / (data.yTicks.length - 1);
    return tickBottom - index * gap;
  }

  function yScaleSource(minutes) {
    const ticks = data.yTicks;
    if (minutes <= ticks[0].minutes) {
      const t =
        (Math.log(ticks[0].minutes) - Math.log(minutes)) /
        (Math.log(ticks[1].minutes) - Math.log(ticks[0].minutes));
      return yTickPosition(0) + t * (yTickPosition(0) - yTickPosition(1));
    }
    for (let index = 0; index < ticks.length - 1; index += 1) {
      const low = ticks[index].minutes;
      const high = ticks[index + 1].minutes;
      if (minutes <= high) {
        const t = (Math.log(minutes) - Math.log(low)) / (Math.log(high) - Math.log(low));
        return yTickPosition(index) + t * (yTickPosition(index + 1) - yTickPosition(index));
      }
    }
    const last = ticks.length - 1;
    const t =
      (Math.log(minutes) - Math.log(ticks[last].minutes)) /
      (Math.log(ticks[last].minutes) - Math.log(ticks[last - 1].minutes));
    return yTickPosition(last) + t * (yTickPosition(last) - yTickPosition(last - 1));
  }

  function yScaleLog(minutes) {
    const ticks = data.yTicks;
    const min = ticks[0].minutes;
    const max = ticks[ticks.length - 1].minutes;
    const t = (Math.log(minutes) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return chart.bottom - t * (chart.bottom - chart.top);
  }

  function yScaleLinear(minutes) {
    const min = 0;
    const max = linearYMaxMinutes();
    const t = (minutes - min) / (max - min);
    return chart.bottom - t * (chart.bottom - chart.top);
  }

  function linearYMaxMinutes() {
    return getLinearTopCutoffMinutes();
  }

  function getLinearTopCutoffMinutes() {
    const parsed = Number(linearTopCutoff.value);
    const logMinutes = Number.isFinite(parsed)
      ? clamp(parsed, Number(linearTopCutoff.min), Number(linearTopCutoff.max))
      : Math.log2(480);
    return 2 ** logMinutes;
  }

  function linearVisibleYTicks() {
    const max = linearYMaxMinutes();
    const topTick = { minutes: max, label: formatMinutes(max) };
    const candidates = [...data.yTicks.filter((tick) => tick.minutes <= max), topTick]
      .sort((a, b) => a.minutes - b.minutes)
      .filter((tick, index, ticks) => index === 0 || Math.abs(tick.minutes - ticks[index - 1].minutes) > 0.001);
    const selected = [];
    candidates.forEach((tick) => {
      const y = yScaleLinear(tick.minutes);
      const previous = selected[selected.length - 1];
      if (!previous || Math.abs(previous.y - y) >= 72 || tick === topTick) {
        if (tick === topTick && previous && Math.abs(previous.y - y) < 72 && selected.length > 1) selected.pop();
        selected.push({ ...tick, y });
      }
    });
    return selected;
  }

  function visibleYTicks() {
    return getYScaleMode() === "linear" ? linearVisibleYTicks() : data.yTicks;
  }

  function getYScaleMode() {
    return yScaleModes.has(yScaleMode.value) ? yScaleMode.value : "source";
  }

  function yScale(minutes) {
    const mode = getYScaleMode();
    if (mode === "log") return yScaleLog(minutes);
    if (mode === "linear") return yScaleLinear(minutes);
    return yScaleSource(minutes);
  }

  function formatMinutes(minutes) {
    if (minutes < 1 / 60) return `${Math.round(minutes * 3600)} sec`;
    if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
    if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
    if (minutes < 1440) return `${Math.round((minutes / 60) * 10) / 10} hrs`;
    return `${Math.round((minutes / 1440) * 10) / 10} days`;
  }

  function svgElement(name, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function showTooltipContent(event, title, rows) {
    const rect = overlay.parentElement.getBoundingClientRect();
    tooltip.innerHTML = `<strong>${title}</strong>${rows.map((row) => `<div>${row}</div>`).join("")}`;
    tooltip.style.display = "block";
    tooltip.style.left = `${Math.min(rect.width - 330, Math.max(12, event.clientX - rect.left + 14))}px`;
    tooltip.style.top = `${Math.min(rect.height - 120, Math.max(12, event.clientY - rect.top + 14))}px`;
  }

  function showTooltip(event, point) {
    showTooltipContent(event, point.label, [
      point.lab,
      point.releaseDate,
      `${formatMinutes(point.minutes)} (${point.minutes} min)`,
      point.frontierP80 ? "p80 frontier point" : "non-frontier measured point",
    ]);
  }

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function getCustomDoublingDays() {
    const parsed = Number(customDoublingDays.value);
    if (!Number.isFinite(parsed)) return 101;
    return clamp(parsed, Number(customDoublingDays.min), Number(customDoublingDays.max));
  }

  function getCustomDoublingIntercept() {
    const parsed = Number(customDoublingIntercept.value);
    if (!Number.isFinite(parsed)) return 0.75;
    return clamp(parsed, Number(customDoublingIntercept.min), Number(customDoublingIntercept.max));
  }

  function updateLinearTopCutoffLabel() {
    linearTopValue.textContent = formatMinutes(getLinearTopCutoffMinutes());
  }

  function nudgeDoublingIntercept(direction) {
    const step = Number(customDoublingIntercept.step) || 0.25;
    const next = clamp(
      getCustomDoublingIntercept() + direction * step,
      Number(customDoublingIntercept.min),
      Number(customDoublingIntercept.max),
    );
    customDoublingIntercept.value = String(Math.round(next * 100) / 100);
    renderOverlay();
  }

  function getSeriesAnchorMinutes(series) {
    if (series.id !== "adjustable-doubling") return series.anchorMinutes;
    return series.anchorMinutes * (2 ** getCustomDoublingIntercept());
  }

  function getSeriesDoublingDays(series) {
    if (series.id === "adjustable-doubling") return getCustomDoublingDays();
    if (series.doublingDays) return series.doublingDays;
    return series.doublingMonths * 30.4375;
  }

  function getSeriesLabel(series) {
    if (series.id === "adjustable-doubling") return `${Math.round(getCustomDoublingDays())}-day doubling`;
    return series.label;
  }

  function getQuadraticCoefficients(points) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => Math.log2(point[1]));
    const [x1, x2, x3] = xs;
    const [y1, y2, y3] = ys;
    const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
    const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
    const b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / denom;
    const c =
      (x2 * x3 * (x2 - x3) * y1 +
        x3 * x1 * (x3 - x1) * y2 +
        x1 * x2 * (x1 - x2) * y3) /
      denom;
    return [a, b, c];
  }

  function interpolateLog2Points(points, year) {
    if (year <= points[0][0]) return points[0][1];
    const last = points[points.length - 1];
    if (year >= last[0]) return last[1];

    for (let index = 0; index < points.length - 1; index += 1) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[index + 1];
      if (year <= x1) {
        const t = (year - x0) / (x1 - x0);
        return 2 ** (Math.log2(y0) + t * (Math.log2(y1) - Math.log2(y0)));
      }
    }

    return last[1];
  }

  function linePathForScreenPoints(points) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");
  }

  function smoothPathForScreenPoints(points) {
    if (points.length < 3) return linePathForScreenPoints(points);

    const slopes = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      slopes.push((points[index + 1].y - points[index].y) / (points[index + 1].x - points[index].x));
    }

    const tangents = points.map((_, index) => {
      if (index === 0) return slopes[0];
      if (index === points.length - 1) return slopes[slopes.length - 1];
      return slopes[index - 1] * slopes[index] <= 0 ? 0 : (slopes[index - 1] + slopes[index]) / 2;
    });

    for (let index = 0; index < slopes.length; index += 1) {
      if (slopes[index] === 0) {
        tangents[index] = 0;
        tangents[index + 1] = 0;
        continue;
      }
      const a = tangents[index] / slopes[index];
      const b = tangents[index + 1] / slopes[index];
      const magnitude = Math.hypot(a, b);
      if (magnitude > 3) {
        const scale = 3 / magnitude;
        tangents[index] = scale * a * slopes[index];
        tangents[index + 1] = scale * b * slopes[index];
      }
    }

    const commands = [`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`];
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const dx = next.x - current.x;
      const c1x = current.x + dx / 3;
      const c1y = current.y + (tangents[index] * dx) / 3;
      const c2x = next.x - dx / 3;
      const c2y = next.y - (tangents[index + 1] * dx) / 3;
      commands.push(
        `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`,
      );
    }
    return commands.join(" ");
  }

  function fitLogLinear(points) {
    const rows = points
      .filter((point) => point.minutes > 0)
      .map((point) => ({
        x: decimalYear(point.releaseDate) - 2020,
        y: Math.log(point.minutes),
      }));
    const n = rows.length;
    const sumX = rows.reduce((sum, row) => sum + row.x, 0);
    const sumY = rows.reduce((sum, row) => sum + row.y, 0);
    const sumXY = rows.reduce((sum, row) => sum + row.x * row.y, 0);
    const sumXX = rows.reduce((sum, row) => sum + row.x * row.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return {
      intercept,
      slope,
      minYear: Math.min(...points.map((point) => decimalYear(point.releaseDate))),
      maxYear: Math.max(...points.map((point) => decimalYear(point.releaseDate))),
      doublingDays: slope > 0 ? (Math.LN2 / slope) * 365.25 : Infinity,
      count: n,
    };
  }

  function valueForSeries(series, year, fit) {
    if (series.kind === "fit-log-linear") return Math.exp(fit.intercept + fit.slope * (year - 2020));
    if (series.kind === "exponential") {
      const doublingYears = getSeriesDoublingDays(series) / 365.25;
      return getSeriesAnchorMinutes(series) * 2 ** ((year - series.anchorYear) / doublingYears);
    }
    if (series.kind === "points-log2") return interpolateLog2Points(series.points, year);
    const [a, b, c] = getQuadraticCoefficients(series.controls);
    return 2 ** (a * year * year + b * year + c);
  }

  function seriesYearRange(series) {
    if (series.kind === "points-log2") {
      return [series.points[0][0], series.points[series.points.length - 1][0]];
    }
    return [chart.xMin, chart.xMax];
  }

  function screenPointsForPointSeries(series, startYear, endYear, fit) {
    const years = [
      startYear,
      ...series.points.map((point) => point[0]).filter((year) => year > startYear && year < endYear),
      endYear,
    ];
    return years.map((year) => ({
      x: xScale(year),
      y: yScale(valueForSeries(series, year, fit)),
    }));
  }

  function pathForSeries(series, startYear, endYear, fit) {
    if (endYear <= startYear) return "";
    if (curveSmoothToggle.checked && series.kind === "points-log2") {
      return smoothPathForScreenPoints(screenPointsForPointSeries(series, startYear, endYear, fit));
    }

    const steps = Math.max(16, Math.round((endYear - startYear) * 90));
    const commands = [];
    for (let i = 0; i <= steps; i += 1) {
      const year = startYear + ((endYear - startYear) * i) / steps;
      const minutes = valueForSeries(series, year, fit);
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      const command = commands.length === 0 ? "M" : "L";
      commands.push(`${command}${xScale(year).toFixed(2)},${yScale(minutes).toFixed(2)}`);
    }
    return commands.join(" ");
  }

  function drawTrendPath(group, series, path, className, fit) {
    if (!path) return;
    const visible = svgElement("path", {
      class: className,
      d: path,
      stroke: series.color,
    });
    group.appendChild(visible);

    const hit = svgElement("path", {
      class: "trend-hit",
      d: path,
    });
    hit.addEventListener("pointermove", (event) => {
      const rect = overlay.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const year = chart.xMin + ratio * (chart.xMax - chart.xMin);
      const minutes = valueForSeries(series, year, fit);
      const rows = [series.sublabel, `Approx year: ${year.toFixed(2)}`, `80% horizon: ${formatMinutes(minutes)}`];
      if (fit) rows.push(`Fit points: ${fit.count}`, `Doubling time: ${Math.round(fit.doublingDays)} days`);
      if (series.kind === "exponential") rows.push(`Doubling time: ${Math.round(getSeriesDoublingDays(series))} days`);
      if (series.id === "adjustable-doubling") {
        const intercept = getCustomDoublingIntercept();
        rows.push(`Y offset: ${intercept >= 0 ? "+" : ""}${intercept.toFixed(2)} doublings`);
      }
      showTooltipContent(event, getSeriesLabel(series), rows);
    });
    hit.addEventListener("pointerleave", hideTooltip);
    group.appendChild(hit);
  }

  function drawCurveLabel(group, series, fit, fallbackYear) {
    const year = series.labelYear || fallbackYear;
    const minutes = valueForSeries(series, year, fit);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const x = xScale(year) + 12;
    const y = yScale(minutes) - 10;
    if (getYScaleMode() === "linear" && y > chart.bottom - 80) return;
    const label = svgElement("text", { class: "curve-label", x, y, fill: series.color });
    label.textContent = getSeriesLabel(series);
    group.appendChild(label);
  }

  function drawTrendLines() {
    const layer = svgElement("g", {
      class: "trend-layer",
      "clip-path": "url(#plotClip)",
    });

    data.series.forEach((series) => {
      const group = svgElement("g", { "data-series": series.id });
      if (series.kind === "fit-log-linear") {
        const sourcePoints = data.metr80Points.filter((point) => point[series.sourceField]);
        const fit = fitLogLinear(sourcePoints);
        const solidStart = Math.max(chart.xMin, fit.minYear);
        const solidEnd = Math.min(chart.xMax, fit.maxYear);
        drawTrendPath(group, series, pathForSeries(series, chart.xMin, solidStart, fit), "trend-line projected", fit);
        drawTrendPath(group, series, pathForSeries(series, solidStart, solidEnd, fit), "trend-line", fit);
        drawTrendPath(group, series, pathForSeries(series, solidEnd, chart.xMax, fit), "trend-line projected", fit);
        drawCurveLabel(group, series, fit, solidEnd);
      } else {
        const [rangeStart, rangeEnd] = seriesYearRange(series);
        const splitYear = data.domains.projectionStartsAt;
        const solidStart = Math.max(chart.xMin, rangeStart);
        const solidEnd = Math.min(splitYear, chart.xMax, rangeEnd);
        const projectedStart = Math.max(splitYear, chart.xMin, rangeStart);
        const projectedEnd = Math.min(chart.xMax, rangeEnd);
        drawTrendPath(group, series, pathForSeries(series, solidStart, solidEnd), "trend-line", null);
        drawTrendPath(group, series, pathForSeries(series, projectedStart, projectedEnd), "trend-line projected", null);
        drawCurveLabel(group, series, null, Math.min(projectedEnd, splitYear + 1.5));
      }
      layer.appendChild(group);
    });

    overlay.appendChild(layer);
  }

  function createCurveToggles() {
    const hiddenCurveIds = new Set((params.get("hideCurves") || "").split(",").filter(Boolean));
    data.series.forEach((series) => {
      const label = document.createElement("label");
      label.className = "curve-toggle";
      label.style.color = series.color;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !hiddenCurveIds.has(series.id);
      input.dataset.seriesId = series.id;
      input.addEventListener("change", applyControls);
      curveToggleInputs.set(series.id, input);

      const swatch = document.createElement("span");
      swatch.className = "curve-swatch";
      swatch.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.textContent = getSeriesLabel(series);
      curveToggleLabels.set(series.id, text);

      label.append(input, swatch, text);
      curveToggles.appendChild(label);
    });
  }

  function isSeriesVisible(seriesId) {
    return curveToggleInputs.get(seriesId)?.checked !== false;
  }

  function isPointVisible(pointId) {
    return pointToggleInputs.get(pointId)?.checked !== false;
  }

  function updateDynamicLabels() {
    const label = curveToggleLabels.get("adjustable-doubling");
    if (label) label.textContent = getSeriesLabel(data.series.find((series) => series.id === "adjustable-doubling"));
  }

  function drawVectorGrid() {
    const grid = svgElement("g", { class: "vector-grid" });
    visibleYTicks().forEach((tick) => {
      const y = yScale(tick.minutes);
      if (y < chart.top - 0.5 || y > chart.bottom + 0.5) return;
      grid.appendChild(svgElement("line", { class: "grid-line", x1: chart.left, y1: y, x2: chart.right, y2: y }));
      const text = svgElement("text", { class: "tick-text", x: chart.left - 26, y: y + 9, "text-anchor": "end" });
      text.textContent = tick.label;
      grid.appendChild(text);
    });

    for (let year = chart.xMin; year <= chart.xMax; year += 1) {
      const x = xScale(year);
      grid.appendChild(svgElement("line", { class: "grid-line", x1: x, y1: chart.top, x2: x, y2: chart.bottom }));
      const text = svgElement("text", { class: "tick-text", x: x, y: chart.bottom + 54, "text-anchor": "middle" });
      text.textContent = String(year);
      grid.appendChild(text);
    }

    grid.appendChild(svgElement("line", { class: "axis-line", x1: chart.left, y1: chart.bottom, x2: chart.right, y2: chart.bottom }));
    grid.appendChild(svgElement("line", { class: "axis-line", x1: chart.left, y1: chart.top, x2: chart.left, y2: chart.bottom }));

    const xLabel = svgElement("text", { class: "axis-text", x: (chart.left + chart.right) / 2, y: chart.bottom + 102, "text-anchor": "middle" });
    xLabel.textContent = "AI Model Release Date";
    grid.appendChild(xLabel);

    const yLabel = svgElement("text", {
      class: "axis-text",
      x: 76,
      y: (chart.top + chart.bottom) / 2,
      transform: `rotate(-90 76 ${(chart.top + chart.bottom) / 2})`,
      "text-anchor": "middle",
    });
    yLabel.textContent = "Task time for humans, 80% success rate";
    grid.appendChild(yLabel);
    overlay.appendChild(grid);
  }

  function shouldDrawPointLabel(point, y) {
    if (!point.showLabel) return false;
    return getYScaleMode() !== "linear" || y < chart.bottom - 80;
  }

  function drawPoint(point) {
    const x = xScale(decimalYear(point.releaseDate));
    const y = yScale(point.minutes);
    if (x < chart.left || x > chart.right || y < chart.top || y > chart.bottom) return;
    const group = svgElement("g", { class: "hotspot", "data-point": point.id });
    const radius = Number(pointSize.value);
    group.appendChild(svgElement("circle", {
      cx: x,
      cy: y,
      r: radius,
      fill: point.color,
      stroke: "#ffffff",
      "stroke-width": Math.max(3, Math.round(radius * 0.24)),
      opacity: 0.92,
    }));
    group.appendChild(svgElement("circle", {
      cx: x,
      cy: y,
      r: Math.max(28, radius + 18),
      fill: "transparent",
    }));
    if (shouldDrawPointLabel(point, y)) {
      const [dx, dy] = point.labelOffset || [radius + 8, -radius - 6];
      const label = svgElement("text", {
        class: "point-label",
        x: x + dx,
        y: y + dy,
        "text-anchor": dx < 0 ? "end" : "start",
      });
      label.textContent = point.shortLabel || point.label;
      group.appendChild(label);
    }
    group.addEventListener("pointermove", (event) => showTooltip(event, point));
    group.addEventListener("pointerleave", hideTooltip);
    overlay.appendChild(group);
  }

  function applyControls() {
    const opacity = backgroundToggle.checked ? Number(backgroundOpacity.value) : 0;
    graphImage.style.opacity = String(opacity);
    const grid = overlay.querySelector(".vector-grid");
    if (grid) grid.style.opacity = String(opacity < 0.35 ? 1 : 0.18);
    const trends = overlay.querySelector(".trend-layer");
    if (trends) {
      trends.style.opacity = curvesToggle.checked ? String(Number(curveOpacity.value)) : "0";
      trends.style.pointerEvents = curvesToggle.checked ? "all" : "none";
      trends.querySelectorAll("[data-series]").forEach((group) => {
        const visible = isSeriesVisible(group.getAttribute("data-series"));
        group.style.display = visible ? "" : "none";
        group.style.pointerEvents = visible ? "" : "none";
      });
    }
    overlay.querySelectorAll("[data-point]").forEach((group) => {
      const visible = isPointVisible(group.getAttribute("data-point"));
      group.style.display = visible ? "" : "none";
      group.style.pointerEvents = visible ? "" : "none";
    });
  }

  function renderOverlay() {
    updateLinearTopCutoffLabel();
    updateDynamicLabels();
    overlay.replaceChildren();
    const defs = svgElement("defs", {});
    const clipPath = svgElement("clipPath", { id: "plotClip" });
    clipPath.appendChild(svgElement("rect", {
      x: chart.left,
      y: chart.top,
      width: chart.right - chart.left,
      height: chart.bottom - chart.top,
    }));
    defs.appendChild(clipPath);
    overlay.appendChild(defs);
    drawVectorGrid();
    drawTrendLines();
    data.metr80Points.forEach(drawPoint);
    applyControls();
  }

  function createDataTable() {
    data.metr80Points.forEach((point) => {
      const row = document.createElement("tr");

      const visibilityCell = document.createElement("td");
      visibilityCell.className = "visibility-cell";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !hiddenPointIds.has(point.id);
      input.dataset.pointId = point.id;
      input.setAttribute("aria-label", `Toggle ${point.label}`);
      input.addEventListener("change", applyControls);
      pointToggleInputs.set(point.id, input);
      visibilityCell.appendChild(input);
      row.appendChild(visibilityCell);

      [
        point.label,
        point.lab,
        point.releaseDate,
        `${formatMinutes(point.minutes)} (${point.minutes} min)`,
        point.frontierP80 ? "yes" : "no",
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      table.appendChild(row);
    });
  }

  createCurveToggles();
  createDataTable();
  backgroundToggle.addEventListener("change", applyControls);
  backgroundOpacity.addEventListener("input", applyControls);
  curvesToggle.addEventListener("change", applyControls);
  curveOpacity.addEventListener("input", applyControls);
  curveSmoothToggle.addEventListener("change", renderOverlay);
  customDoublingDays.addEventListener("input", renderOverlay);
  customDoublingIntercept.addEventListener("input", renderOverlay);
  doublingInterceptDown.addEventListener("click", () => nudgeDoublingIntercept(-1));
  doublingInterceptUp.addEventListener("click", () => nudgeDoublingIntercept(1));
  linearTopCutoff.addEventListener("input", renderOverlay);
  yScaleMode.addEventListener("change", renderOverlay);
  pointSize.addEventListener("input", renderOverlay);
  renderOverlay();
})();
