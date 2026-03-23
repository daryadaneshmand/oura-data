(function () {
const LIFTING_START = "2026-01-01";
    const CYCLES = [
      { id: "cycle_1", label: "Cycle 1", lifting: false, phases: [
        { phase: "follicular", start: "2025-10-28", end: "2025-11-11" },
        { phase: "luteal", start: "2025-11-12", end: "2025-11-23" },
      ]},
      { id: "cycle_2", label: "Cycle 2", lifting: false, phases: [
        { phase: "follicular", start: "2025-11-24", end: "2025-12-09" },
        { phase: "luteal", start: "2025-12-10", end: "2025-12-20" },
      ]},
      { id: "cycle_3", label: "Cycle 3", lifting: false, phases: [
        { phase: "follicular", start: "2025-12-21", end: "2026-01-05" },
        { phase: "luteal", start: "2026-01-06", end: "2026-01-18" },
      ]},
      { id: "cycle_4", label: "Cycle 4 — consistent lifting", lifting: true, phases: [
        { phase: "follicular", start: "2026-01-19", end: "2026-01-30" },
        { phase: "luteal", start: "2026-01-30", end: "2026-02-12" },
      ]},
    ];

    function parseDate(s) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    function daysBetween(a, b) {
      return Math.round((parseDate(b) - parseDate(a)) / 86400000);
    }
    function getPhaseForDate(dateStr, cycle) {
      for (const p of cycle.phases) {
        if (dateStr >= p.start && dateStr <= p.end) return p.phase;
      }
      return null;
    }
    function isDateInCycle(dateStr, cycle) {
      for (const p of cycle.phases) {
        if (dateStr >= p.start && dateStr <= p.end) return true;
      }
      return false;
    }

    function getPhaseDay(dateStr, phaseDef) {
      return daysBetween(phaseDef.start, dateStr) + 1;
    }
    function getFollicularDay(dateStr, cycle) {
      const p = cycle.phases.find((x) => x.phase === "follicular");
      return p ? getPhaseDay(dateStr, p) : null;
    }
    function getLutealDay(dateStr, cycle) {
      const p = cycle.phases.find((x) => x.phase === "luteal");
      return p ? getPhaseDay(dateStr, p) : null;
    }
    function getLiftingFollicularDay(cycle) {
      if (!isDateInCycle(LIFTING_START, cycle)) return null;
      return getFollicularDay(LIFTING_START, cycle);
    }

    async function main() {
      const dailyData = await fetch("./data/daily.json").then((r) => r.json());
      const byDate = new Map(dailyData.map((d) => [d.date, d]));

      const width = 900;
      const height = 500;
      const margins = { top: 32, right: 32, bottom: 48, left: 48 };
      const innerWidth = width - margins.left - margins.right;
      const innerHeight = height - margins.top - margins.bottom;

      const dividerWidth = 24;
      const panelWidth = (innerWidth - dividerWidth) / 2;

      const maxFollicularDays = Math.max(
        ...CYCLES.map((c) => {
          const p = c.phases.find((x) => x.phase === "follicular");
          return p ? getPhaseDay(p.end, p) : 0;
        })
      );
      const maxLutealDays = Math.max(
        ...CYCLES.map((c) => {
          const p = c.phases.find((x) => x.phase === "luteal");
          return p ? getPhaseDay(p.end, p) : 0;
        })
      );

      const xScaleFollicular = d3.scaleLinear()
        .domain([1, maxFollicularDays])
        .range([0, panelWidth]);
      const xScaleLuteal = d3.scaleLinear()
        .domain([1, maxLutealDays])
        .range([panelWidth + dividerWidth, innerWidth]);

      const hrvToDisplay = (v) => (v == null ? null : (v * 50) + 50);

      const cycleData = CYCLES.map((cycle) => {
        const follicularPoints = [];
        const lutealPoints = [];
        const luteal = cycle.phases.find((p) => p.phase === "luteal");
        const lutealStart = luteal ? luteal.start : null;

        for (const p of cycle.phases) {
          let d = parseDate(p.start);
          const end = parseDate(p.end);
          while (d <= end) {
            const dateStr = d.toISOString().slice(0, 10);
            const day = byDate.get(dateStr);
            if (!day || day.hrvBalance == null) { d.setDate(d.getDate() + 1); continue; }
            if (p.phase === "follicular" && dateStr === lutealStart) {
              d.setDate(d.getDate() + 1);
              continue;
            }
            const pt = { ...day, phase: p.phase };
            if (p.phase === "follicular") {
              pt.follicularDay = getPhaseDay(dateStr, p);
              follicularPoints.push(pt);
            } else {
              pt.lutealDay = getPhaseDay(dateStr, p);
              lutealPoints.push(pt);
            }
            d.setDate(d.getDate() + 1);
          }
        }
        follicularPoints.sort((a, b) => a.follicularDay - b.follicularDay);
        lutealPoints.sort((a, b) => a.lutealDay - b.lutealDay);
        return { cycle, follicularPoints, lutealPoints };
      });

      const cycles123 = cycleData.filter((cd) => !cd.cycle.lifting);
      const cycle4 = cycleData.find((cd) => cd.cycle.lifting);

      function aggregateByDay(pointsArrays, dayKey, valueFn) {
        const byDay = new Map();
        for (const points of pointsArrays) {
          for (const p of points) {
            const d = p[dayKey];
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d).push(valueFn(p));
          }
        }
        return [...byDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([day, vals]) => ({
            day,
            min: Math.min(...vals),
            max: Math.max(...vals),
            mean: vals.reduce((a, b) => a + b, 0) / vals.length,
          }));
      }

      const aggFollicular = aggregateByDay(
        cycles123.map((cd) => cd.follicularPoints),
        "follicularDay",
        (p) => hrvToDisplay(p.hrvBalance)
      );
      const aggLuteal = aggregateByDay(
        cycles123.map((cd) => cd.lutealPoints),
        "lutealDay",
        (p) => hrvToDisplay(p.hrvBalance)
      );

      const allHrvValues = cycleData.flatMap((cd) =>
        [...cd.follicularPoints, ...cd.lutealPoints].map((p) => hrvToDisplay(p.hrvBalance))
      );
      const yMin = Math.floor(Math.min(...allHrvValues) / 5) * 5;
      const yMax = 100;
      const yScale = d3.scaleLinear()
        .domain([Math.max(30, yMin - 5), yMax])
        .range([innerHeight, 0]);

      const svg = d3.select("#viz-hrv")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const g = svg.append("g")
        .attr("transform", `translate(${margins.left}, ${margins.top})`);

      const bgGroup = g.append("g").attr("class", "panel-bg");
      bgGroup.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", panelWidth)
        .attr("height", innerHeight)
        .attr("fill", "rgba(255, 248, 240, 0.6)");
      bgGroup.append("rect")
        .attr("x", panelWidth + dividerWidth)
        .attr("y", 0)
        .attr("width", innerWidth - panelWidth - dividerWidth)
        .attr("height", innerHeight)
        .attr("fill", "rgba(240, 248, 255, 0.5)");

      g.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1a1a")
        .attr("font-size", 14)
        .attr("font-weight", 600)
        .attr("letter-spacing", "0.02em")
        .text("Follicular");
      g.append("text")
        .attr("x", panelWidth + dividerWidth + (innerWidth - panelWidth - dividerWidth) / 2)
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1a1a")
        .attr("font-size", 14)
        .attr("font-weight", 600)
        .attr("letter-spacing", "0.02em")
        .text("Luteal");

      const dividerGroup = g.append("g").attr("class", "divider");
      dividerGroup.append("line")
        .attr("x1", panelWidth)
        .attr("x2", panelWidth)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#e5e5e5")
        .attr("stroke-width", 1);
      dividerGroup.append("line")
        .attr("x1", panelWidth + dividerWidth)
        .attr("x2", panelWidth + dividerWidth)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#e5e5e5")
        .attr("stroke-width", 1);

      g.append("g")
        .call(d3.axisLeft(yScale).ticks(6))
        .attr("color", "#666");
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -36)
        .attr("text-anchor", "middle")
        .attr("fill", "#555")
        .attr("font-size", 11)
        .text("HRV balance");

      g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScaleFollicular).ticks(Math.min(maxFollicularDays, 12)))
        .attr("color", "#666");
      g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScaleLuteal).ticks(Math.min(maxLutealDays, 12)))
        .attr("color", "#666");

      g.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", innerHeight + 38)
        .attr("text-anchor", "middle")
        .attr("fill", "#888")
        .attr("font-size", 10)
        .text("phase day");
      g.append("text")
        .attr("x", panelWidth + dividerWidth + (innerWidth - panelWidth - dividerWidth) / 2)
        .attr("y", innerHeight + 38)
        .attr("text-anchor", "middle")
        .attr("fill", "#888")
        .attr("font-size", 10)
        .text("phase day");

      const lineGroup = g.append("g").attr("class", "lines");
      const tooltip = d3.select("#tooltip");

      function showTooltip(event, d, cycle) {
        const phase = getPhaseForDate(d.date, cycle);
        const phaseDay = phase === "follicular" ? d.follicularDay : d.lutealDay;
        const hrv = hrvToDisplay(d.hrvBalance);
        const lines = [
          `Date: ${d.date}`,
          `${phase} day: ${phaseDay ?? "—"}`,
          `HRV balance: ${hrv != null ? hrv.toFixed(1) : "—"}`,
          `Readiness: ${d.readinessScore ?? "—"}`,
          `Strength training: ${d.isStrengthDay ? "yes" : "no"}`,
        ];
        tooltip
          .html(lines.join("<br>"))
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px")
          .classed("visible", true);
      }
      function showTooltipAgg(event, a, phase) {
        const lines = [
          `Cycles 1–3 · ${phase} day ${a.day}`,
          `HRV avg: ${a.mean.toFixed(1)}`,
          `Range: ${a.min.toFixed(1)} – ${a.max.toFixed(1)}`,
        ];
        tooltip
          .html(lines.join("<br>"))
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px")
          .classed("visible", true);
      }
      function hideTooltip() {
        tooltip.classed("visible", false);
      }

      const cycles123Color = "#64748b";
      const cycles123BandColor = "rgba(100, 116, 139, 0.2)";
      const cycle4Color = "#2563eb";

      const lineF = d3.line()
        .x((d) => xScaleFollicular(d.day))
        .y((d) => yScale(d.mean))
        .curve(d3.curveMonotoneX);
      const lineL = d3.line()
        .x((d) => xScaleLuteal(d.day))
        .y((d) => yScale(d.mean))
        .curve(d3.curveMonotoneX);

      const areaF = d3.area()
        .x((d) => xScaleFollicular(d.day))
        .y0((d) => yScale(d.min))
        .y1((d) => yScale(d.max))
        .curve(d3.curveMonotoneX);
      const areaL = d3.area()
        .x((d) => xScaleLuteal(d.day))
        .y0((d) => yScale(d.min))
        .y1((d) => yScale(d.max))
        .curve(d3.curveMonotoneX);

      const aggCycle = { label: "Cycles 1–3", lifting: false };

      if (aggFollicular.length > 0) {
        lineGroup.append("path")
          .attr("d", areaF(aggFollicular))
          .attr("fill", cycles123BandColor);
        lineGroup.append("path")
          .attr("d", lineF(aggFollicular))
          .attr("fill", "none")
          .attr("stroke", cycles123Color)
          .attr("stroke-width", 1.5)
          .style("cursor", "pointer")
          .on("mouseover", function(e) {
            const pt = d3.pointer(e, this);
            const bisect = d3.bisector((d) => d.day).left;
            const idx = Math.min(bisect(aggFollicular, xScaleFollicular.invert(pt[0])), aggFollicular.length - 1);
            const a = aggFollicular[idx];
            showTooltipAgg(e, a, "follicular");
          })
          .on("mousemove", function(e) {
            const pt = d3.pointer(e, this);
            const bisect = d3.bisector((d) => d.day).left;
            const idx = Math.min(bisect(aggFollicular, xScaleFollicular.invert(pt[0])), aggFollicular.length - 1);
            showTooltipAgg(e, aggFollicular[idx], "follicular");
          })
          .on("mouseout", hideTooltip);
      }

      if (aggLuteal.length > 0) {
        lineGroup.append("path")
          .attr("d", areaL(aggLuteal))
          .attr("fill", cycles123BandColor);
        lineGroup.append("path")
          .attr("d", lineL(aggLuteal))
          .attr("fill", "none")
          .attr("stroke", cycles123Color)
          .attr("stroke-width", 1.5)
          .style("cursor", "pointer")
          .on("mouseover", function(e) {
            const pt = d3.pointer(e, this);
            const bisect = d3.bisector((d) => d.day).left;
            const idx = Math.min(bisect(aggLuteal, xScaleLuteal.invert(pt[0])), aggLuteal.length - 1);
            showTooltipAgg(e, aggLuteal[idx], "luteal");
          })
          .on("mousemove", function(e) {
            const pt = d3.pointer(e, this);
            const bisect = d3.bisector((d) => d.day).left;
            const idx = Math.min(bisect(aggLuteal, xScaleLuteal.invert(pt[0])), aggLuteal.length - 1);
            showTooltipAgg(e, aggLuteal[idx], "luteal");
          })
          .on("mouseout", hideTooltip);
      }

      const lineF4 = d3.line()
        .x((d) => xScaleFollicular(d.follicularDay))
        .y((d) => yScale(hrvToDisplay(d.hrvBalance)))
        .curve(d3.curveMonotoneX);
      const lineL4 = d3.line()
        .x((d) => xScaleLuteal(d.lutealDay))
        .y((d) => yScale(hrvToDisplay(d.hrvBalance)))
        .curve(d3.curveMonotoneX);

      if (cycle4) {
        const { cycle, follicularPoints, lutealPoints } = cycle4;
        const pathGroup = lineGroup.append("g").attr("class", "cycle-4");

        if (follicularPoints.length > 0) {
          pathGroup.append("path")
            .attr("d", lineF4(follicularPoints))
            .attr("fill", "none")
            .attr("stroke", cycle4Color)
            .attr("stroke-width", 2.5)
            .style("cursor", "pointer")
            .on("mouseover", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.follicularDay).left;
              const idx = Math.min(bisect(follicularPoints, xScaleFollicular.invert(pt[0])), follicularPoints.length - 1);
              showTooltip(e, follicularPoints[idx], cycle);
            })
            .on("mousemove", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.follicularDay).left;
              const idx = Math.min(bisect(follicularPoints, xScaleFollicular.invert(pt[0])), follicularPoints.length - 1);
              showTooltip(e, follicularPoints[idx], cycle);
            })
            .on("mouseout", hideTooltip);

          follicularPoints.filter((d) => d.isStrengthDay).forEach((d) => {
            pathGroup.append("circle")
              .attr("cx", xScaleFollicular(d.follicularDay))
              .attr("cy", yScale(hrvToDisplay(d.hrvBalance)))
              .attr("r", 3)
              .attr("fill", cycle4Color)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1)
              .style("cursor", "pointer")
              .on("mouseover", (e) => showTooltip(e, d, cycle))
              .on("mouseout", hideTooltip);
          });
        }

        if (lutealPoints.length > 0) {
          pathGroup.append("path")
            .attr("d", lineL4(lutealPoints))
            .attr("fill", "none")
            .attr("stroke", cycle4Color)
            .attr("stroke-width", 2.5)
            .style("cursor", "pointer")
            .on("mouseover", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.lutealDay).left;
              const idx = Math.min(bisect(lutealPoints, xScaleLuteal.invert(pt[0])), lutealPoints.length - 1);
              showTooltip(e, lutealPoints[idx], cycle);
            })
            .on("mousemove", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.lutealDay).left;
              const idx = Math.min(bisect(lutealPoints, xScaleLuteal.invert(pt[0])), lutealPoints.length - 1);
              showTooltip(e, lutealPoints[idx], cycle);
            })
            .on("mouseout", hideTooltip);

          lutealPoints.filter((d) => d.isStrengthDay).forEach((d) => {
            pathGroup.append("circle")
              .attr("cx", xScaleLuteal(d.lutealDay))
              .attr("cy", yScale(hrvToDisplay(d.hrvBalance)))
              .attr("r", 3)
              .attr("fill", cycle4Color)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1)
              .style("cursor", "pointer")
              .on("mouseover", (e) => showTooltip(e, d, cycle))
              .on("mouseout", hideTooltip);
          });
        }
      }

      const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${innerWidth - 180}, 12)`);
      const leg1 = legend.append("g").attr("transform", "translate(0, 0)");
      leg1.append("rect")
        .attr("x", 0)
        .attr("y", -5)
        .attr("width", 24)
        .attr("height", 10)
        .attr("fill", cycles123BandColor)
        .attr("rx", 1);
      leg1.append("line")
        .attr("x1", 0)
        .attr("x2", 24)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", cycles123Color)
        .attr("stroke-width", 1.5);
      leg1.append("text")
        .attr("x", 32)
        .attr("y", 4)
        .attr("fill", "#1a1a1a")
        .attr("font-size", 11)
        .text("Cycles 1–3");
      const leg2 = legend.append("g").attr("transform", "translate(0, 24)");
      leg2.append("line")
        .attr("x1", 0)
        .attr("x2", 24)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", cycle4Color)
        .attr("stroke-width", 2.5);
      leg2.append("text")
        .attr("x", 32)
        .attr("y", 4)
        .attr("fill", "#1a1a1a")
        .attr("font-size", 11)
        .attr("font-weight", 500)
        .text("Cycle 4 — consistent lifting");
    }

    main().catch(console.error);
})();
