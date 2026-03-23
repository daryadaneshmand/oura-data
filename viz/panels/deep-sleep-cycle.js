(function () {
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

    function getPhaseDay(dateStr, phaseDef) {
      return daysBetween(phaseDef.start, dateStr) + 1;
    }

    const DEEP_SLEEP_OUTLIER_THRESHOLD = 15;
    const EXCLUDED_DATES = new Set(["2026-02-03"]);
    function isPlausibleDeepSleep(val) {
      return val != null && val >= DEEP_SLEEP_OUTLIER_THRESHOLD;
    }
    function isExcludedDate(dateStr) {
      return EXCLUDED_DATES.has(dateStr);
    }

    function prevDate(dateStr) {
      const d = parseDate(dateStr);
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }

    function isNightAfterStrength(dateStr, byDate) {
      const prev = prevDate(dateStr);
      return byDate.get(prev)?.isStrengthDay === true;
    }

    function rolling3(arr, valueKey) {
      return arr.map((d, i) => {
        const vals = [];
        for (let j = Math.max(0, i - 1); j <= Math.min(arr.length - 1, i + 1); j++) {
          const v = arr[j][valueKey];
          if (v != null) vals.push(v);
        }
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        return { ...d, [valueKey]: avg };
      });
    }

    function rolling3Agg(aggArr) {
      return aggArr.map((d, i) => {
        const vals = [];
        for (let j = Math.max(0, i - 1); j <= Math.min(aggArr.length - 1, i + 1); j++) {
          vals.push(aggArr[j].mean);
        }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { ...d, mean };
      });
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
            if (!day || isExcludedDate(dateStr) || !isPlausibleDeepSleep(day.deepSleepMinutes)) { d.setDate(d.getDate() + 1); continue; }
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

      const aggFollicularRaw = aggregateByDay(
        cycles123.map((cd) => cd.follicularPoints),
        "follicularDay",
        (p) => p.deepSleepMinutes
      );
      const aggLutealRaw = aggregateByDay(
        cycles123.map((cd) => cd.lutealPoints),
        "lutealDay",
        (p) => p.deepSleepMinutes
      );

      const allDeepSleepValues = cycleData.flatMap((cd) =>
        [...cd.follicularPoints, ...cd.lutealPoints].map((p) => p.deepSleepMinutes)
      ).filter((v) => isPlausibleDeepSleep(v));
      const extent = allDeepSleepValues.length
        ? d3.extent(allDeepSleepValues)
        : [50, 90];
      const yMin = Math.floor((extent[0] - 5) / 5) * 5;
      const yMax = Math.ceil((extent[1] + 5) / 5) * 5;
      const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([innerHeight, 0]);

      const cycles123Color = "#64748b";
      const cycles123BandColor = "rgba(100, 116, 139, 0.2)";
      const cycle4Color = "#2563eb";

      const svg = d3.select("#viz-deep")
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
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).ticks(6))
        .attr("color", "#666");
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -36)
        .attr("text-anchor", "middle")
        .attr("fill", "#555")
        .attr("font-size", 11)
        .text("Deep sleep (min)");

      g.append("g")
        .attr("class", "x-axis-follicular")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScaleFollicular).ticks(Math.min(maxFollicularDays, 12)))
        .attr("color", "#666");
      g.append("g")
        .attr("class", "x-axis-luteal")
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
        const lines = [
          `Date: ${d.date}`,
          `${phase} day: ${phaseDay ?? "—"}`,
          `Deep sleep: ${d.deepSleepMinutes != null ? d.deepSleepMinutes + " min" : "—"}`,
          d.nightAfterStrength ? "Night after strength training" : "",
        ].filter(Boolean);
        tooltip
          .html(lines.join("<br>"))
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px")
          .classed("visible", true);
      }
      function showTooltipAgg(event, a, phase, useRolling) {
        const lines = [
          `Cycles 1–3 · ${phase} day ${a.day}`,
          `Deep sleep avg: ${a.mean.toFixed(1)} min`,
          `Range: ${a.min.toFixed(0)} – ${a.max.toFixed(0)} min`,
          useRolling ? "(3-day rolling avg)" : "",
        ].filter(Boolean);
        tooltip
          .html(lines.join("<br>"))
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px")
          .classed("visible", true);
      }
      function hideTooltip() {
        tooltip.classed("visible", false);
      }

      function render(useRolling) {
        lineGroup.selectAll("*").remove();

        const aggFollicularLine = useRolling ? rolling3Agg(aggFollicularRaw) : aggFollicularRaw;
        const aggLutealLine = useRolling ? rolling3Agg(aggLutealRaw) : aggLutealRaw;

        let follicular4 = useRolling
          ? rolling3(cycle4?.follicularPoints || [], "deepSleepMinutes").filter((d) => d.deepSleepMinutes != null)
          : cycle4?.follicularPoints || [];
        let luteal4 = useRolling
          ? rolling3(cycle4?.lutealPoints || [], "deepSleepMinutes").filter((d) => d.deepSleepMinutes != null)
          : cycle4?.lutealPoints || [];

        follicular4 = follicular4.map((d) => ({ ...d, nightAfterStrength: isNightAfterStrength(d.date, byDate) }));
        luteal4 = luteal4.map((d) => ({ ...d, nightAfterStrength: isNightAfterStrength(d.date, byDate) }));

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

        const lineF4 = d3.line()
          .x((d) => xScaleFollicular(d.follicularDay))
          .y((d) => yScale(d.deepSleepMinutes))
          .curve(d3.curveMonotoneX);
        const lineL4 = d3.line()
          .x((d) => xScaleLuteal(d.lutealDay))
          .y((d) => yScale(d.deepSleepMinutes))
          .curve(d3.curveMonotoneX);

        if (aggFollicularRaw.length > 0) {
          lineGroup.append("path")
            .attr("d", areaF(aggFollicularRaw))
            .attr("fill", cycles123BandColor);
          lineGroup.append("path")
            .attr("d", lineF(aggFollicularLine))
            .attr("fill", "none")
            .attr("stroke", cycles123Color)
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.day).left;
              const idx = Math.min(bisect(aggFollicularLine, xScaleFollicular.invert(pt[0])), aggFollicularLine.length - 1);
              showTooltipAgg(e, aggFollicularLine[idx], "follicular", useRolling);
            })
            .on("mousemove", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.day).left;
              const idx = Math.min(bisect(aggFollicularLine, xScaleFollicular.invert(pt[0])), aggFollicularLine.length - 1);
              showTooltipAgg(e, aggFollicularLine[idx], "follicular", useRolling);
            })
            .on("mouseout", hideTooltip);
        }

        if (aggLutealRaw.length > 0) {
          lineGroup.append("path")
            .attr("d", areaL(aggLutealRaw))
            .attr("fill", cycles123BandColor);
          lineGroup.append("path")
            .attr("d", lineL(aggLutealLine))
            .attr("fill", "none")
            .attr("stroke", cycles123Color)
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.day).left;
              const idx = Math.min(bisect(aggLutealLine, xScaleLuteal.invert(pt[0])), aggLutealLine.length - 1);
              showTooltipAgg(e, aggLutealLine[idx], "luteal", useRolling);
            })
            .on("mousemove", function(e) {
              const pt = d3.pointer(e, this);
              const bisect = d3.bisector((d) => d.day).left;
              const idx = Math.min(bisect(aggLutealLine, xScaleLuteal.invert(pt[0])), aggLutealLine.length - 1);
              showTooltipAgg(e, aggLutealLine[idx], "luteal", useRolling);
            })
            .on("mouseout", hideTooltip);
        }

        if (cycle4) {
          const { cycle, follicularPoints, lutealPoints } = cycle4;
          const pathGroup = lineGroup.append("g").attr("class", "cycle-4");

          if (follicular4.length > 0) {
            pathGroup.append("path")
              .attr("d", lineF4(follicular4))
              .attr("fill", "none")
              .attr("stroke", cycle4Color)
              .attr("stroke-width", 2.5)
              .style("cursor", "pointer")
              .on("mouseover", function(e) {
                const pt = d3.pointer(e, this);
                const bisect = d3.bisector((d) => d.follicularDay).left;
                const idx = Math.min(bisect(follicular4, xScaleFollicular.invert(pt[0])), follicular4.length - 1);
                showTooltip(e, follicular4[idx], cycle);
              })
              .on("mousemove", function(e) {
                const pt = d3.pointer(e, this);
                const bisect = d3.bisector((d) => d.follicularDay).left;
                const idx = Math.min(bisect(follicular4, xScaleFollicular.invert(pt[0])), follicular4.length - 1);
                showTooltip(e, follicular4[idx], cycle);
              })
              .on("mouseout", hideTooltip);

            follicular4.forEach((d) => {
              const val = d.deepSleepMinutes;
              if (val == null) return;
              pathGroup.append("circle")
                .attr("cx", xScaleFollicular(d.follicularDay))
                .attr("cy", yScale(val))
                .attr("r", 3.5)
                .attr("fill", d.nightAfterStrength ? cycle4Color : "#fff")
                .attr("stroke", cycle4Color)
                .attr("stroke-width", 1.5)
                .style("cursor", "pointer")
                .on("mouseover", (e) => showTooltip(e, d, cycle))
                .on("mouseout", hideTooltip);
            });
          }

          if (luteal4.length > 0) {
            pathGroup.append("path")
              .attr("d", lineL4(luteal4))
              .attr("fill", "none")
              .attr("stroke", cycle4Color)
              .attr("stroke-width", 2.5)
              .style("cursor", "pointer")
              .on("mouseover", function(e) {
                const pt = d3.pointer(e, this);
                const bisect = d3.bisector((d) => d.lutealDay).left;
                const idx = Math.min(bisect(luteal4, xScaleLuteal.invert(pt[0])), luteal4.length - 1);
                showTooltip(e, luteal4[idx], cycle);
              })
              .on("mousemove", function(e) {
                const pt = d3.pointer(e, this);
                const bisect = d3.bisector((d) => d.lutealDay).left;
                const idx = Math.min(bisect(luteal4, xScaleLuteal.invert(pt[0])), luteal4.length - 1);
                showTooltip(e, luteal4[idx], cycle);
              })
              .on("mouseout", hideTooltip);

            luteal4.forEach((d) => {
              const val = d.deepSleepMinutes;
              if (val == null) return;
              pathGroup.append("circle")
                .attr("cx", xScaleLuteal(d.lutealDay))
                .attr("cy", yScale(val))
                .attr("r", 3.5)
                .attr("fill", d.nightAfterStrength ? cycle4Color : "#fff")
                .attr("stroke", cycle4Color)
                .attr("stroke-width", 1.5)
                .style("cursor", "pointer")
                .on("mouseover", (e) => showTooltip(e, d, cycle))
                .on("mouseout", hideTooltip);
            });
          }
        }
      }

      render(false);

      d3.select("#rollingToggle").on("change", function() {
        render(this.checked);
      });

      const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${innerWidth - 200}, 12)`);
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
      const leg3 = legend.append("g").attr("transform", "translate(0, 48)");
      leg3.append("circle")
        .attr("cx", 6)
        .attr("cy", 0)
        .attr("r", 3.5)
        .attr("fill", cycle4Color)
        .attr("stroke", cycle4Color)
        .attr("stroke-width", 1.5);
      leg3.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .attr("fill", "#1a1a1a")
        .attr("font-size", 11)
        .text("Night after strength training");
      const leg4 = legend.append("g").attr("transform", "translate(0, 72)");
      leg4.append("circle")
        .attr("cx", 6)
        .attr("cy", 0)
        .attr("r", 3.5)
        .attr("fill", "#fff")
        .attr("stroke", cycle4Color)
        .attr("stroke-width", 1.5);
      leg4.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .attr("fill", "#1a1a1a")
        .attr("font-size", 11)
        .text("Other nights");

      d3.select("#viz-deep").append("p")
        .attr("class", "chart-annotation")
        .html(`Deep sleep values below ${DEEP_SLEEP_OUTLIER_THRESHOLD} min are excluded as measurement outliers. 2026-02-03 excluded (ring died during night, logged ~3 hr).`);
    }

    main().catch(console.error);
})();
