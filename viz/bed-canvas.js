/**
 * Couples bed canvas — glyph language for phase concordance + restfulness.
 * - Single bed: #bed + #bed-cap
 * - 2×7 grid: #bed-grid + #bed-grid-cap (14 consecutive calendar nights, complete data only)
 */
(function () {
  const VB_W = 1280;
  const VB_H = 1024;

  const BLANKET_ANCHOR_X = 655;
  const BLANKET_ANCHOR_Y = 468;

  const colors = {
    canvasBg: "#f5f2eb",
    headboard: "#ebe6dc",
    headboardStroke: "#d4cfc4",
    mattress: "#f0ebe3",
    mattressStroke: "#c9c3b8",
    mattressSeam: "#d8d2c7",
    blanket: "#e8e2d6",
    blanketStroke: "#beb8ad",
    pillow: "#f2ede4",
    pillowStroke: "#c4beb3",
  };

  const dMattressTopOuter =
    "M831.14,310.9l178.04,266.01H301.18s178.04-266.01,178.04-266.01h351.92";
  const dMattressTopInner =
    "M832.74,307.9h-355.13l-182.05,272.01h719.23s-182.05-272.01,-182.05-272.01h0Z";
  const dMattressFrontOuter =
    "M293.94,645.49l722.57.9-16.96,192.96-689.13-.86-16.48-193";
  const dMattressFrontInner =
    "M290.67,642.49l16.99,199,694.63.87,17.49-198.96-729.11-.91h0Z";
  const dBlanket =
    "M429.51,345.47c8.6-7.04,21.35-21.21,38.43-23.11s56.94,3.57,67.89,4.35c10.94.78,69.57-3.25,94.59-4.75s89.11-1.62,109.44,0c20.32,1.62,68.01,7.09,78.95,5.53s38.3,1.89,46.12,5.64,155.38,215.21,154.86,221.45c-.52,6.24,19.45,37.44,13.21,74.89s-19.97,42.44-53.67,44.93-71.14-21.22-89.87-14.98c-18.72,6.24-152.27,16.6-217.18,15.16-64.9-1.43-71.14-16.41-86.12-15.16-14.98,1.25-16.23,1.25-43.69,8.74-27.46,7.49-152.27,18.11-194.71,6.56s-109.84,49.61-88.62-57.73c21.22-107.34,170.37-271.52,170.37-271.52Z";
  const dPillowLeft =
    "M503.29,233.57c8.8.61,30.22,2.38,38.48,5.94,8.26,3.56,38.84-4.75,44.5-4.58,5.66.17,26.24-6.01,45.76-4.61,19.52,1.39,14.7,9.68,15,21.61.3,11.93-1.61,14.49,1.23,25.73,2.84,11.24,5.69,24.36-7.55,22.81-13.24-1.55-25.6,6.38-37.53,6.68-11.93.3-66.63-.91-77.31-.64-10.68.27-33.03,10.89-28.03-15,5-25.89,4.92-29.03,2.14-39.64-2.78-10.61-4.86-18.87,3.31-18.31Z";
  const dPillowRight =
    "M669.93,229.04c8.74,1.18,30,4.36,38.01,8.46s39.07-2.19,44.7-1.65,26.58-4.27,45.96-1.59c19.38,2.67,14.03,10.63,13.55,22.55s-2.56,14.36-.46,25.76,4.07,24.68-9.03,22.27-25.97,4.69-37.89,4.2-66.43-5.29-77.1-5.72-33.67,8.69-26.98-16.81c6.69-25.51,6.82-28.64,4.74-39.42-2.08-10.77-3.61-19.15,4.5-18.05Z";

  const MATTRESS_FRONT_POLY = [
    [309.04, 839.99],
    [292.3, 643.99],
    [1018.14, 644.89],
    [1000.92, 840.85],
  ];

  function lerp(a, b, u) {
    return a + (b - a) * u;
  }

  function lerpRgb(a, b, u) {
    return `rgb(${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(
      lerp(a[2], b[2], u)
    )})`;
  }

  /** Editorial seam: low match = warm unease, high = saturated cool (Fragapane-style clarity). */
  function seamColorGlyph(c) {
    const t = c == null ? 0.5 : Math.max(0, Math.min(1, c));
    const dust = [236, 210, 202];
    const mid = [198, 186, 178];
    const teal = [32, 118, 128];
    if (t < 0.5) return lerpRgb(dust, mid, t * 2);
    return lerpRgb(mid, teal, (t - 0.5) * 2);
  }

  function nightHarmony(night) {
    const p =
      night && typeof night.phaseConcordance === "number"
        ? night.phaseConcordance
        : 0.5;
    let r = 0.5;
    if (
      night &&
      typeof night.restfulnessYou === "number" &&
      typeof night.restfulnessDale === "number"
    ) {
      r = ((night.restfulnessYou + night.restfulnessDale) / 2) / 100;
    } else if (night && typeof night.restfulnessCombined === "number") {
      r = night.restfulnessCombined / 100;
    }
    return Math.max(0, Math.min(1, p * 0.55 + r * 0.45));
  }

  /** Wash behind the whole glyph: calmer nights lean cool mint; rough nights lean warm blush. */
  function drawCellAtmosphere(ctx, night) {
    const h = nightHarmony(night);
    const troubled = 1 - h;
    const calm = h;
    const r = lerp(252, 244, calm) + troubled * 4;
    const g = lerp(238, 236, calm) - troubled * 6;
    const b = lerp(234, 242, calm);
    const a = 0.11 + troubled * 0.1;
    ctx.save();
    ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    ctx.fillRect(0, 0, VB_W, VB_H);
    ctx.restore();
  }

  /** Headboard: a horizontal band whose length tracks phase concordance (redundant with seams). */
  function drawHeadboardPhaseBar(ctx, phaseConcordance) {
    const p =
      typeof phaseConcordance === "number"
        ? Math.max(0, Math.min(1, phaseConcordance))
        : 0.5;
    const hx = 477.62;
    const hy = 216.87;
    const hw = 355.33;
    const barH = 5;
    const barW = Math.max(24, hw * (0.2 + 0.8 * p));
    ctx.save();
    ctx.fillStyle = seamColorGlyph(p);
    ctx.globalAlpha = 0.85;
    ctx.fillRect(hx, hy, barW, barH);
    ctx.restore();
  }

  function drawHeadboard(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(477.62, 216.87, 355.33, 91.03);
    ctx.fillStyle = colors.headboard;
    ctx.fill();
    ctx.strokeStyle = colors.headboardStroke;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.restore();
  }

  function drawMattressBase(ctx, lineWeightMul) {
    const lw = 1.25 * (lineWeightMul || 1);
    ctx.save();
    ctx.fillStyle = colors.mattress;
    ctx.strokeStyle = colors.mattressStroke;
    ctx.lineWidth = lw;

    const topOuter = new Path2D(dMattressTopOuter);
    ctx.fill(topOuter);
    ctx.stroke(topOuter);
    ctx.stroke(new Path2D(dMattressTopInner));

    const frontOuter = new Path2D(dMattressFrontOuter);
    ctx.fill(frontOuter);
    ctx.stroke(frontOuter);
    ctx.stroke(new Path2D(dMattressFrontInner));
    ctx.restore();
  }

  function drawSeams(ctx, segmentConcordance, phaseConcordance, opts) {
    const o = opts || {};
    const bowMul = o.bowMul != null ? o.bowMul : 1;
    const baseBow = 6 * bowMul;
    const lwMin = o.seamLwMin != null ? o.seamLwMin : 0.85;
    const lwMax = o.seamLwMax != null ? o.seamLwMax : 2.2;
    const colorAt = o.seamColorAt || seamColorGlyph;
    const bowA = o.bowLow != null ? o.bowLow : 1.12;
    const bowB = o.bowHigh != null ? o.bowHigh : 0.88;

    const count = 5;
    const bl = MATTRESS_FRONT_POLY[0];
    const tl = MATTRESS_FRONT_POLY[1];
    const tr = MATTRESS_FRONT_POLY[2];
    const br = MATTRESS_FRONT_POLY[3];

    ctx.save();
    ctx.lineCap = "round";

    for (let i = 1; i <= count; i++) {
      const segIdx = i - 1;
      let c =
        segmentConcordance && typeof segmentConcordance[segIdx] === "number"
          ? segmentConcordance[segIdx]
          : null;
      if (c == null && typeof phaseConcordance === "number") c = phaseConcordance;
      if (c == null) c = 0.5;

      const t = i / (count + 1);
      const lx = tl[0] + (bl[0] - tl[0]) * t;
      const ly = tl[1] + (bl[1] - tl[1]) * t;
      const rx = tr[0] + (br[0] - tr[0]) * t;
      const ry = tr[1] + (br[1] - tr[1]) * t;
      const dx = rx - lx;
      const dy = ry - ly;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const bow = baseBow * (bowA - bowB * c);

      const c1x = lx + dx * 0.35 + nx * bow;
      const c1y = ly + dy * 0.35 + ny * bow;
      const c2x = lx + dx * 0.65 + nx * bow;
      const c2y = ly + dy * 0.65 + ny * bow;

      ctx.strokeStyle = colorAt(c);
      ctx.lineWidth = lwMin + (lwMax - lwMin) * c;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, rx, ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Five vertical blocks: height + fill = segment-wise phase match (scan across the foot). */
  function drawSegmentRibbon(ctx, segmentConcordance, seamColorFn) {
    if (!segmentConcordance || segmentConcordance.length !== 5) return;
    const x0 = 300;
    const x1 = 1012;
    const gap = 5;
    const inner = x1 - x0 - gap * 4;
    const barW = inner / 5;
    const baseY = 848;
    const maxH = 28;
    const fn = seamColorFn || seamColorGlyph;

    ctx.save();
    for (let i = 0; i < 5; i++) {
      const c = segmentConcordance[i];
      const t = typeof c === "number" ? Math.max(0, Math.min(1, c)) : 0.5;
      const h = 4 + maxH * t;
      const bx = x0 + i * (barW + gap);
      const by = baseY + maxH - h;
      ctx.fillStyle = fn(t);
      ctx.fillRect(bx, by, barW, h);
      ctx.strokeStyle = "rgba(45, 48, 52, 0.28)";
      ctx.lineWidth = 0.75;
      ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, h - 1);
    }
    ctx.restore();
  }

  function blanketTransformForRestfulness(score, skewMul) {
    const m = skewMul != null ? skewMul : 1;
    let skewX = 0;
    let skewY = 0;
    let scaleY = 1;
    if (typeof score === "number" && !Number.isNaN(score)) {
      const calm = Math.max(0, Math.min(1, score / 100));
      const restless = 1 - calm;
      skewX = (restless - 0.35) * 0.07 * m;
      skewY = restless * 0.055 * m;
      scaleY = 1 + (restless - 0.4) * 0.035 * Math.min(m, 1.4);
    }
    return { skewX, skewY, scaleY };
  }

  function blanketStrokeForNight(night, skewMul) {
    const m = skewMul != null ? skewMul : 1;
    let minR = 100;
    if (typeof night?.restfulnessYou === "number")
      minR = Math.min(minR, night.restfulnessYou);
    if (typeof night?.restfulnessDale === "number")
      minR = Math.min(minR, night.restfulnessDale);
    if (minR === 100 && typeof night?.restfulnessCombined === "number")
      minR = night.restfulnessCombined;
    if (minR === 100) return 1.25;
    const restless = 1 - Math.max(0, Math.min(1, minR / 100));
    return 1.05 + 0.85 * restless * m;
  }

  function blanketFillForNight(night) {
    const h = nightHarmony(night);
    const t = h;
    const base = [232, 226, 214];
    const rich = [218, 228, 224];
    return lerpRgb(base, rich, t);
  }

  function applyBlanketTransform(ctx, t) {
    ctx.translate(BLANKET_ANCHOR_X, BLANKET_ANCHOR_Y);
    ctx.transform(1, t.skewY, t.skewX, t.scaleY, 0, 0);
    ctx.translate(-BLANKET_ANCHOR_X, -BLANKET_ANCHOR_Y);
  }

  function drawBlanketHalf(ctx, clipX, clipY, clipW, clipH, t, fillHex, strokeW) {
    const p = new Path2D(dBlanket);
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipW, clipH);
    ctx.clip();
    ctx.save();
    applyBlanketTransform(ctx, t);
    ctx.fillStyle = fillHex;
    ctx.fill(p);
    ctx.strokeStyle = colors.blanketStroke;
    ctx.lineWidth = strokeW;
    ctx.stroke(p);
    ctx.restore();
    ctx.restore();
  }

  function drawBlanket(ctx, night, skewMul) {
    const restfulnessYou = night && night.restfulnessYou;
    const restfulnessDale = night && night.restfulnessDale;
    const restfulnessCombined = night && night.restfulnessCombined;
    const youOk = typeof restfulnessYou === "number" && !Number.isNaN(restfulnessYou);
    const daleOk = typeof restfulnessDale === "number" && !Number.isNaN(restfulnessDale);
    const neutral = blanketTransformForRestfulness(undefined, skewMul);
    let tYou;
    let tDale;
    if (youOk && daleOk) {
      tYou = blanketTransformForRestfulness(restfulnessYou, skewMul);
      tDale = blanketTransformForRestfulness(restfulnessDale, skewMul);
    } else if (youOk || daleOk) {
      tYou = youOk ? blanketTransformForRestfulness(restfulnessYou, skewMul) : neutral;
      tDale = daleOk ? blanketTransformForRestfulness(restfulnessDale, skewMul) : neutral;
    } else if (
      typeof restfulnessCombined === "number" &&
      !Number.isNaN(restfulnessCombined)
    ) {
      const t = blanketTransformForRestfulness(restfulnessCombined, skewMul);
      tYou = t;
      tDale = t;
    } else {
      tYou = neutral;
      tDale = neutral;
    }

    const fill = blanketFillForNight(night);
    const sw = blanketStrokeForNight(night, skewMul);
    const ax = BLANKET_ANCHOR_X;
    drawBlanketHalf(ctx, 0, 0, ax, VB_H, tDale, fill, sw);
    drawBlanketHalf(ctx, ax, 0, VB_W - ax, VB_H, tYou, fill, sw);
  }

  function pillowRgb(side, score) {
    const calm =
      typeof score === "number" && !Number.isNaN(score)
        ? Math.max(0, Math.min(1, score / 100))
        : null;
    if (calm === null) return colors.pillow;
    const u = 1 - calm;
    if (side === "left") {
      return lerpRgb([248, 236, 232], [214, 150, 138], u * 0.85);
    }
    return lerpRgb([236, 242, 246], [120, 132, 148], u * 0.85);
  }

  function drawPillows(ctx, night) {
    const ly = night && night.restfulnessDale;
    const ry = night && night.restfulnessYou;
    ctx.save();
    const left = new Path2D(dPillowLeft);
    ctx.fillStyle = pillowRgb("left", ly);
    ctx.fill(left);
    ctx.strokeStyle = colors.pillowStroke;
    ctx.lineWidth = 1.1 + (typeof ly === "number" ? (1 - ly / 100) * 0.9 : 0);
    ctx.stroke(left);

    const right = new Path2D(dPillowRight);
    ctx.fillStyle = pillowRgb("right", ry);
    ctx.fill(right);
    ctx.lineWidth = 1.1 + (typeof ry === "number" ? (1 - ry / 100) * 0.9 : 0);
    ctx.stroke(right);
    ctx.restore();
  }

  function defaultDrawOpts(mode) {
    if (mode === "grid") {
      return {
        mode: "grid",
        bowMul: 2.35,
        bowLow: 1.28,
        bowHigh: 0.92,
        seamLwMin: 0.55,
        seamLwMax: 3.15,
        blanketSkewMul: 2.4,
        mattressLineMul: 1.08,
        showSegmentRibbon: true,
        showCellAtmosphere: true,
        showHeadboardBar: true,
      };
    }
    return {
      mode: "single",
      bowMul: 1.15,
      bowLow: 1.1,
      bowHigh: 0.82,
      seamLwMin: 0.75,
      seamLwMax: 2.65,
      blanketSkewMul: 1.35,
      mattressLineMul: 1,
      showSegmentRibbon: false,
      showCellAtmosphere: false,
      showHeadboardBar: true,
    };
  }

  function drawAll(ctx, night, options) {
    const o = Object.assign(defaultDrawOpts(options && options.mode), options || {});

    ctx.fillStyle = colors.canvasBg;
    ctx.fillRect(0, 0, VB_W, VB_H);

    if (night && o.showCellAtmosphere) drawCellAtmosphere(ctx, night);

    drawHeadboard(ctx);
    if (night && o.showHeadboardBar) {
      drawHeadboardPhaseBar(ctx, night.phaseConcordance);
    }

    const segs = night && night.segmentConcordance;
    const overall = night && night.phaseConcordance;

    drawMattressBase(ctx, o.mattressLineMul);
    drawSeams(ctx, segs, overall, {
      bowMul: o.bowMul,
      seamLwMin: o.seamLwMin,
      seamLwMax: o.seamLwMax,
      seamColorAt: o.seamColorAt || seamColorGlyph,
      bowLow: o.bowLow,
      bowHigh: o.bowHigh,
    });
    drawBlanket(ctx, night, o.blanketSkewMul);
    if (night && o.showSegmentRibbon) {
      drawSegmentRibbon(ctx, segs, o.seamColorAt || seamColorGlyph);
    }
    drawPillows(ctx, night);
  }

  function isNightDataComplete(n) {
    if (!n || !n.date) return false;
    if (typeof n.phaseConcordance !== "number" || Number.isNaN(n.phaseConcordance)) return false;
    const segs = n.segmentConcordance;
    if (!Array.isArray(segs) || segs.length !== 5) return false;
    for (let i = 0; i < 5; i++) {
      if (typeof segs[i] !== "number" || Number.isNaN(segs[i])) return false;
    }
    if (n.bedtimeStartYou == null || n.bedtimeStartDale == null) return false;
    return true;
  }

  function parseYMD(s) {
    const parts = s.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }

  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }

  function formatYMD(d) {
    return d.toISOString().slice(0, 10);
  }

  /** Most recent calendar block of 14 consecutive dates where each day is present and complete. */
  function pickFourteenConsecutiveClearNights(nights) {
    if (!nights || !nights.length) return null;
    const byDate = new Map();
    for (const n of nights) byDate.set(n.date, n);
    const dates = [...byDate.keys()].sort();
    let best = null;
    for (const start of dates) {
      const d0 = parseYMD(start);
      const run = [];
      let ok = true;
      for (let i = 0; i < 14; i++) {
        const key = formatYMD(addDays(d0, i));
        const n = byDate.get(key);
        if (!n || !isNightDataComplete(n)) {
          ok = false;
          break;
        }
        run.push(n);
      }
      if (ok && run.length === 14) {
        if (!best || run[13].date > best[13].date) best = run;
      }
    }
    if (!best) return null;
    return { nights: best, startDate: best[0].date, endDate: best[13].date };
  }

  function pickLatestNight(nights) {
    if (!nights || !nights.length) return null;
    const scored = nights.filter(
      (n) =>
        n.phaseConcordance != null ||
        n.restfulnessCombined != null ||
        n.restfulnessYou != null ||
        n.restfulnessDale != null ||
        (n.segmentConcordance && n.segmentConcordance.some((x) => x != null))
    );
    const pool = scored.length ? scored : nights;
    if (!pool.length) return null;
    return pool.reduce((a, b) => (a.date >= b.date ? a : b));
  }

  const COUPLES_URLS = [
    "data/couples.json",
    "/data/couples.json",
    "../data/couples.json",
  ];

  async function loadCouplesJson() {
    for (const url of COUPLES_URLS) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (_) {
        /* try next */
      }
    }
    return null;
  }

  window.CouplesBed = {
    VB_W,
    VB_H,
    drawAll,
    isNightDataComplete,
    pickFourteenConsecutiveClearNights,
    pickLatestNight,
    nightHarmony,
  };

  const canvasSingle = document.getElementById("bed");
  const capSingle = document.getElementById("bed-cap");
  const canvasGrid = document.getElementById("bed-grid");
  const capGrid = document.getElementById("bed-grid-cap");

  const COLS = 7;
  const ROWS = 2;
  const GAP = 12;
  /** Pixels below each bed for the date label (CSS px, same space as grid layout). */
  const GRID_DATE_STRIP = 22;

  function formatGridCellDate(iso) {
    if (!iso || typeof iso !== "string") return "";
    const p = iso.split("-");
    if (p.length < 3) return iso;
    const m = Number(p[1]);
    const d = Number(p[2]);
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (m >= 1 && m <= 12 && d >= 1) return `${mo[m - 1]} ${d}`;
    return iso;
  }

  function setupGridCanvas(canvas, cap, data) {
    const run = data && pickFourteenConsecutiveClearNights(data.nights);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const maxCssW = Math.min(1380, Math.max(320, window.innerWidth - 40));
    const cellCssW = (maxCssW - GAP * (COLS - 1)) / COLS;
    const cellPlotH = cellCssW * (VB_H / VB_W);
    const cellCssH = cellPlotH + GRID_DATE_STRIP;
    const totalCssW = cellCssW * COLS + GAP * (COLS - 1);
    const totalCssH = cellCssH * ROWS + GAP * (ROWS - 1);

    canvas.style.width = `${totalCssW}px`;
    canvas.style.height = `${totalCssH}px`;
    canvas.width = Math.round(totalCssW * dpr);
    canvas.height = Math.round(totalCssH * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;

    if (!data) {
      cap.textContent =
        "Could not load data/couples.json. From the project root run: npx serve . then open Couples Sleep.";
      return;
    }

    if (!run) {
      cap.textContent =
        "No block of 14 consecutive calendar nights with complete overlap (phase, all five segments, both bedtimes). Merge fresher couples data or relax gaps in the source exports.";
      return;
    }

    const gridOpts = defaultDrawOpts("grid");
    const s = cellCssW / VB_W;
    let idx = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const night = run.nights[idx++];
        const x = col * (cellCssW + GAP);
        const y = row * (cellCssH + GAP);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        drawAll(ctx, night, gridOpts);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3d3a36";
    const fontPx = Math.max(10, Math.min(12, cellCssW * 0.09));
    ctx.font = `600 ${fontPx}px "DM Sans", system-ui, -apple-system, sans-serif`;
    idx = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const night = run.nights[idx++];
        const cx = col * (cellCssW + GAP) + cellCssW / 2;
        const cy = row * (cellCssH + GAP) + cellPlotH + GRID_DATE_STRIP / 2;
        ctx.fillText(formatGridCellDate(night.date), cx, cy);
      }
    }
    ctx.restore();

    cap.innerHTML = "";
    const p1 = document.createElement("p");
    p1.className = "grid-cap-main";
    p1.textContent = `Fourteen clear nights: ${run.startDate} → ${run.endDate}. Read left → right, top row then bottom; each date sits under its bed.`;
    cap.appendChild(p1);
    const leg = document.createElement("div");
    leg.className = "bed-legend";
    leg.setAttribute("aria-label", "Visual encoding legend");
    leg.innerHTML = [
      "<p><span class='chip chip-seam' aria-hidden='true'></span>Seams — straighter curves, thicker strokes, cooler teal: phases more in sync.</p>",
      "<p><span class='chip chip-bars' aria-hidden='true'></span>Foot bars — five segments of the night; taller and cooler = more match then.</p>",
      "<p><span class='chip chip-head' aria-hidden='true'></span>Headboard band — longer bar = stronger overall match that night.</p>",
      "<p><span class='chip chip-wash' aria-hidden='true'></span>Cell wash — warmer blush vs cooler mint: rougher vs calmer night (phase + restfulness when available).</p>",
      "<p><span class='chip chip-blanket' aria-hidden='true'></span>Blanket & pillows — more skew and warmer pillow tones when restfulness scores show restlessness (per side).</p>",
    ].join("");
    cap.appendChild(leg);
  }

  function setupSingleCanvas(canvas, cap, data) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const night = data && pickLatestNight(data.nights);
    drawAll(ctx, night, defaultDrawOpts("single"));

    if (!data) {
      cap.textContent =
        "Could not load data/couples.json. From the project root run: npx serve . then open Couples Sleep (or merge: npm run merge-couples).";
      return;
    }
    if (!night) {
      cap.textContent = `couples.json has ${data.nights?.length ?? 0} nights; none with concordance/restfulness. Re-fetch and merge.`;
      return;
    }
    const c =
      night.phaseConcordance != null
        ? `${Math.round(night.phaseConcordance * 100)}% phase match`
        : "phase n/a";
    const ry =
      night.restfulnessYou != null ? `you ~${Math.round(night.restfulnessYou)}` : null;
    const rd =
      night.restfulnessDale != null ? `Dale ~${Math.round(night.restfulnessDale)}` : null;
    const rc =
      night.restfulnessCombined != null
        ? `combined ~${Math.round(night.restfulnessCombined)}`
        : null;
    const rParts = [rd, ry].filter(Boolean);
    const r =
      rParts.length > 0
        ? `restfulness ${rParts.join(", ")}`
        : rc != null
          ? `restfulness ${rc}`
          : "restfulness n/a";
    cap.textContent = `Night ${night.date} — ${c}; ${r}. Blanket: Dale left / you right; seams & bars: phase match. Aggregate: ${
      data.aggregate?.meanPhaseConcordance != null
        ? Math.round(data.aggregate.meanPhaseConcordance * 100) + "%"
        : "n/a"
    } mean match.`;
  }

  if (canvasGrid && capGrid) {
    capGrid.textContent = "Loading couples data…";
    let gridDataCache = null;
    loadCouplesJson().then((data) => {
      gridDataCache = data;
      setupGridCanvas(canvasGrid, capGrid, data);
    });
    let resizeT = null;
    window.addEventListener("resize", () => {
      if (!gridDataCache) return;
      clearTimeout(resizeT);
      resizeT = setTimeout(() => setupGridCanvas(canvasGrid, capGrid, gridDataCache), 120);
    });
  } else if (canvasSingle && capSingle) {
    capSingle.textContent = "Loading couples data…";
    loadCouplesJson().then((data) => setupSingleCanvas(canvasSingle, capSingle, data));
  }
})();
