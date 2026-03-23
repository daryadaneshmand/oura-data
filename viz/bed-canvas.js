/**
 * Couples bed canvas — hypnogram strips (clock overlap) + restfulness blanket.
 * - Single bed: #bed + #bed-cap
 * - 2×7 grid: #bed-grid + #bed-grid-cap (14 consecutive calendar nights, complete data only)
 */
(function () {
  const VB_W = 1280;
  const VB_H = 1024;
  const MS_5MIN = 5 * 60 * 1000;

  const BLANKET_ANCHOR_X = 655;
  const BLANKET_ANCHOR_Y = 468;

  /** Hypnogram strip band on mattress front (below blanket); x = time in overlap window. */
  const HYPN_LABEL_RIGHT = 308;
  const HYPN_STRIP_X0 = 318;
  const HYPN_STRIP_X1 = 1008;
  const HYPN_Y_TOP = 702;

  const PHASE_COLORS = {
    1: "#1a3d35",
    2: "#4a9e8a",
    3: "#7dd4b8",
    4: "#e0f5ef",
  };

  const colors = {
    canvasBg: "#f5f2eb",
    headboard: "#ebe6dc",
    headboardStroke: "#d4cfc4",
    mattress: "#f0ebe3",
    mattressStroke: "#c9c3b8",
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

  function lerp(a, b, u) {
    return a + (b - a) * u;
  }

  function lerpRgb(a, b, u) {
    return `rgb(${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(
      lerp(a[2], b[2], u)
    )})`;
  }

  function phaseAt(phaseStr, bedtimeStart, tMs) {
    if (!phaseStr || !bedtimeStart) return null;
    const t0 = new Date(bedtimeStart).getTime();
    if (!Number.isFinite(t0)) return null;
    const idx = Math.floor((tMs - t0) / MS_5MIN);
    if (idx < 0 || idx >= phaseStr.length) return null;
    return phaseStr[idx];
  }

  function inferBedtimeEndMs(bedtimeStart, phaseStr) {
    const t0 = new Date(bedtimeStart).getTime();
    if (!Number.isFinite(t0) || !phaseStr || !phaseStr.length) return NaN;
    return t0 + phaseStr.length * MS_5MIN;
  }

  function overlapWindow(night) {
    if (!night) return { ok: false, overlapStart: 0, overlapEnd: 0 };
    const su = new Date(night.bedtimeStartYou).getTime();
    const sd = new Date(night.bedtimeStartDale).getTime();
    let eu = night.bedtimeEndYou
      ? new Date(night.bedtimeEndYou).getTime()
      : inferBedtimeEndMs(night.bedtimeStartYou, night.sleepPhase5MinYou);
    let ed = night.bedtimeEndDale
      ? new Date(night.bedtimeEndDale).getTime()
      : inferBedtimeEndMs(night.bedtimeStartDale, night.sleepPhase5MinDale);
    if (!Number.isFinite(su) || !Number.isFinite(sd)) return { ok: false, overlapStart: 0, overlapEnd: 0 };
    if (!Number.isFinite(eu)) eu = su;
    if (!Number.isFinite(ed)) ed = sd;
    const overlapStart = Math.max(su, sd);
    const overlapEnd = Math.min(eu, ed);
    const ok = overlapEnd > overlapStart + MS_5MIN;
    return { ok, overlapStart, overlapEnd };
  }

  function phaseBucketColor(ch) {
    if (ch == null) return "#c8c4be";
    const k = typeof ch === "string" ? ch : String(ch);
    return PHASE_COLORS[k] || "#c8c4be";
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

  /** Bold wash: clear warm blush vs cool mint for troubled vs calm nights. */
  function drawCellAtmosphere(ctx, night) {
    const h = nightHarmony(night);
    const troubled = 1 - h;
    const calm = h;
    const warmR = lerp(255, 248, calm);
    const warmG = lerp(218, 235, calm);
    const warmB = lerp(208, 238, calm);
    const coolR = lerp(248, 196, troubled);
    const coolG = lerp(232, 228, troubled);
    const coolB = lerp(228, 232, troubled);
    const r = lerp(warmR, coolR, troubled);
    const g = lerp(warmG, coolG, troubled);
    const b = lerp(warmB, coolB, troubled);
    const a = 0.28 + troubled * 0.22;
    ctx.save();
    ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    ctx.fillRect(0, 0, VB_W, VB_H);
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

  /**
   * Two stacked strips: you (Darya) on top, Dale below; 5-min buckets in clock overlap, left→right.
   */
  function drawHypnogramStrips(ctx, night, opts) {
    const o = opts || {};
    const inv = o.inverseLayoutScale != null ? o.inverseLayoutScale : 1;
    const stripH = (o.stripCssHeight != null ? o.stripCssHeight : 10) * inv;
    const gap = (o.stripGapCss != null ? o.stripGapCss : 1) * inv;
    const fontUser = Math.min(96, Math.max(10, 9 * inv));
    const youStr = night && night.sleepPhase5MinYou;
    const daleStr = night && night.sleepPhase5MinDale;
    const { ok, overlapStart, overlapEnd } = overlapWindow(night);
    const w = HYPN_STRIP_X1 - HYPN_STRIP_X0;
    const yYou = HYPN_Y_TOP;
    const yDale = yYou + stripH + gap;

    ctx.save();
    ctx.lineWidth = Math.max(0.5, inv * 0.85);
    ctx.strokeStyle = "rgba(35, 40, 42, 0.35)";
    ctx.fillStyle = "#d5d0c8";
    ctx.fillRect(HYPN_STRIP_X0, yYou, w, stripH);
    ctx.fillRect(HYPN_STRIP_X0, yDale, w, stripH);
    ctx.strokeRect(HYPN_STRIP_X0 + 0.5, yYou + 0.5, w - 1, stripH - 1);
    ctx.strokeRect(HYPN_STRIP_X0 + 0.5, yDale + 0.5, w - 1, stripH - 1);

    if (ok && youStr && daleStr) {
      let n = 0;
      for (let t = overlapStart; t < overlapEnd; t += MS_5MIN) n++;
      if (n < 1) n = 1;
      let i = 0;
      for (let t = overlapStart; t < overlapEnd; t += MS_5MIN) {
        const x0 = HYPN_STRIP_X0 + (i / n) * w;
        const x1 = HYPN_STRIP_X0 + ((i + 1) / n) * w;
        const bw = Math.max(0.5, x1 - x0);
        const py = phaseAt(youStr, night.bedtimeStartYou, t);
        const pd = phaseAt(daleStr, night.bedtimeStartDale, t);
        ctx.fillStyle = phaseBucketColor(py);
        ctx.fillRect(x0, yYou, bw, stripH);
        ctx.fillStyle = phaseBucketColor(pd);
        ctx.fillRect(x0, yDale, bw, stripH);
        i++;
      }
      ctx.strokeStyle = "rgba(35, 40, 42, 0.28)";
      ctx.strokeRect(HYPN_STRIP_X0 + 0.5, yYou + 0.5, w - 1, stripH - 1);
      ctx.strokeRect(HYPN_STRIP_X0 + 0.5, yDale + 0.5, w - 1, stripH - 1);
    }

    ctx.fillStyle = "rgba(45, 44, 40, 0.82)";
    ctx.font = `600 ${fontUser}px "DM Sans", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("you", HYPN_LABEL_RIGHT, yYou + stripH / 2);
    ctx.fillText("D", HYPN_LABEL_RIGHT, yDale + stripH / 2);
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
      scaleY = 1 + (restless - 0.4) * 0.035 * Math.min(m, 2.2);
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
    return 1.05 + 0.95 * restless * Math.min(m, 2.5);
  }

  function blanketFillForNight(night) {
    const h = nightHarmony(night);
    const base = [232, 226, 214];
    const rich = [218, 228, 224];
    return lerpRgb(base, rich, h);
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

  function blanketSkewMulForCell(layoutScale) {
    const s = layoutScale != null ? layoutScale : 1;
    const ref = 200 / VB_W;
    const ratio = ref / Math.max(0.08, s);
    return Math.min(12, Math.max(2.6, 2.9 * ratio));
  }

  function defaultDrawOpts(mode, layoutScale) {
    const skew = blanketSkewMulForCell(layoutScale);
    if (mode === "grid") {
      return {
        mode: "grid",
        blanketSkewMul: skew,
        mattressLineMul: 1.06,
        showCellAtmosphere: true,
        inverseLayoutScale: layoutScale ? 1 / layoutScale : 1,
        stripCssHeight: 10,
        stripGapCss: 1,
      };
    }
    return {
      mode: "single",
      blanketSkewMul: Math.min(5, 2.8 * 1.15),
      mattressLineMul: 1,
      showCellAtmosphere: false,
      inverseLayoutScale: 1,
      stripCssHeight: 10,
      stripGapCss: 1,
    };
  }

  function drawAll(ctx, night, options) {
    const layoutScale = options && options.layoutScale != null ? options.layoutScale : 1;
    const base = defaultDrawOpts(options && options.mode, layoutScale);
    const o = Object.assign(base, options || {});

    ctx.fillStyle = colors.canvasBg;
    ctx.fillRect(0, 0, VB_W, VB_H);

    if (night && o.showCellAtmosphere) drawCellAtmosphere(ctx, night);

    drawHeadboard(ctx);
    drawMattressBase(ctx, o.mattressLineMul);
    drawBlanket(ctx, night, o.blanketSkewMul);
    drawHypnogramStrips(ctx, night, o);
    drawPillows(ctx, night);
  }

  function isNightDataComplete(n) {
    if (!n || !n.date) return false;
    if (typeof n.phaseConcordance !== "number" || Number.isNaN(n.phaseConcordance)) return false;
    if (typeof n.sleepPhase5MinYou !== "string" || !n.sleepPhase5MinYou.length) return false;
    if (typeof n.sleepPhase5MinDale !== "string" || !n.sleepPhase5MinDale.length) return false;
    if (n.bedtimeStartYou == null || n.bedtimeStartDale == null) return false;
    const ov = overlapWindow(n);
    if (!ov.ok) return false;
    const segs = n.segmentConcordance;
    if (!Array.isArray(segs) || segs.length !== 5) return false;
    for (let i = 0; i < 5; i++) {
      if (typeof segs[i] !== "number" || Number.isNaN(segs[i])) return false;
    }
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
        (n.segmentConcordance && n.segmentConcordance.some((x) => x != null)) ||
        (n.sleepPhase5MinYou && n.sleepPhase5MinDale)
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
    overlapWindow,
    phaseBucketColor,
  };

  const canvasSingle = document.getElementById("bed");
  const capSingle = document.getElementById("bed-cap");
  const canvasGrid = document.getElementById("bed-grid");
  const capGrid = document.getElementById("bed-grid-cap");

  const COLS = 7;
  const ROWS = 2;
  const GAP = 12;

  /** Latest grid geometry + night run for hit-testing (CSS pixel space). */
  const gridHitLayout = {
    run: null,
    cellCssW: 0,
    cellCssH: 0,
    totalCssW: 0,
    totalCssH: 0,
  };

  function nightAtGridPosition(canvas, clientX, clientY) {
    const L = gridHitLayout;
    if (!L.run || !L.totalCssW) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const cssX = ((clientX - rect.left) / rect.width) * L.totalCssW;
    const cssY = ((clientY - rect.top) / rect.height) * L.totalCssH;
    const col = Math.floor(cssX / (L.cellCssW + GAP));
    const xIn = cssX - col * (L.cellCssW + GAP);
    if (col < 0 || col >= COLS || xIn < 0 || xIn > L.cellCssW) return null;
    const row = Math.floor(cssY / (L.cellCssH + GAP));
    const yIn = cssY - row * (L.cellCssH + GAP);
    if (row < 0 || row >= ROWS || yIn < 0 || yIn > L.cellCssH) return null;
    return L.run.nights[row * COLS + col] || null;
  }

  function prettyLocalTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (_) {
      return String(iso);
    }
  }

  function fillModalMeta(container, night) {
    container.replaceChildren();
    const dl = document.createElement("dl");
    const add = (label, value) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    add(
      "Phase concordance",
      typeof night.phaseConcordance === "number"
        ? `${Math.round(night.phaseConcordance * 100)}% of overlap buckets match`
        : "—"
    );
    const ov = overlapWindow(night);
    if (ov.ok) {
      add(
        "Overlap window",
        `${prettyLocalTime(new Date(ov.overlapStart).toISOString())} → ${prettyLocalTime(new Date(ov.overlapEnd).toISOString())}`
      );
    } else {
      add("Overlap window", "—");
    }
    add("Bedtime (you)", prettyLocalTime(night.bedtimeStartYou));
    add("Bedtime (Dale)", prettyLocalTime(night.bedtimeStartDale));
    const ry =
      typeof night.restfulnessYou === "number"
        ? String(Math.round(night.restfulnessYou))
        : "—";
    const rd =
      typeof night.restfulnessDale === "number"
        ? String(Math.round(night.restfulnessDale))
        : "—";
    add("Restfulness", `you ${ry} · Dale ${rd}`);
    if (Array.isArray(night.segmentConcordance)) {
      const parts = night.segmentConcordance.map((x, i) =>
        typeof x === "number" ? `S${i + 1} ${Math.round(x * 100)}%` : `S${i + 1} —`
      );
      add("Segments (5 parts of overlap)", parts.join(" · "));
    }
    container.appendChild(dl);
  }

  function renderNightDetailCanvas(canvasEl, night) {
    const wrapW = Math.min(920, Math.max(280, window.innerWidth - 64));
    const dprM = Math.min(2, window.devicePixelRatio || 1);
    const cssH = (wrapW * VB_H) / VB_W;
    canvasEl.style.width = `${wrapW}px`;
    canvasEl.style.height = `${cssH}px`;
    canvasEl.width = Math.round(wrapW * dprM);
    canvasEl.height = Math.round(cssH * dprM);
    const mctx = canvasEl.getContext("2d");
    if (!mctx) return;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.scale(dprM, dprM);
    const sModal = wrapW / VB_W;
    const opts = Object.assign(defaultDrawOpts("grid", sModal), { layoutScale: sModal });
    drawAll(mctx, night, opts);
  }

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

  function formatConcordancePct(night) {
    if (!night || typeof night.phaseConcordance !== "number" || Number.isNaN(night.phaseConcordance)) {
      return "—";
    }
    return `${Math.round(night.phaseConcordance * 100)}% match`;
  }

  /** Pixels below bed art: two lines (date + concordance). */
  const GRID_DATE_STRIP = 40;

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
      gridHitLayout.run = null;
      canvas.removeAttribute("tabindex");
      canvas.style.cursor = "";
      cap.textContent =
        "Could not load data/couples.json. From the project root run: npx serve . then open Couples Sleep.";
      return;
    }

    if (!run) {
      gridHitLayout.run = null;
      canvas.removeAttribute("tabindex");
      canvas.style.cursor = "";
      cap.textContent =
        "No block of 14 consecutive calendar nights with complete overlap and hypnograms (sleepPhase5MinYou/Dale, bedtimes, overlap). Run npm run merge-couples after fetching daily + dale JSON.";
      return;
    }

    gridHitLayout.run = run;
    gridHitLayout.cellCssW = cellCssW;
    gridHitLayout.cellCssH = cellCssH;
    gridHitLayout.totalCssW = totalCssW;
    gridHitLayout.totalCssH = totalCssH;
    canvas.setAttribute("tabindex", "0");
    canvas.style.cursor = "pointer";

    const s = cellCssW / VB_W;
    const gridOpts = Object.assign(defaultDrawOpts("grid", s), {
      layoutScale: s,
    });

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
    const datePx = Math.max(10, Math.min(12, cellCssW * 0.062));
    const subPx = Math.max(9, Math.min(11, cellCssW * 0.056));
    idx = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const night = run.nights[idx++];
        const cx = col * (cellCssW + GAP) + cellCssW / 2;
        const baseY = row * (cellCssH + GAP) + cellPlotH;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#3d3a36";
        ctx.font = `600 ${datePx}px "DM Sans", system-ui, -apple-system, sans-serif`;
        ctx.fillText(formatGridCellDate(night.date), cx, baseY + 14);
        ctx.fillStyle = "#6a655e";
        ctx.font = `500 ${subPx}px "DM Sans", system-ui, -apple-system, sans-serif`;
        ctx.fillText(formatConcordancePct(night), cx, baseY + 30);
      }
    }
    ctx.restore();

    cap.innerHTML = "";
    const p1 = document.createElement("p");
    p1.className = "grid-cap-main";
    p1.textContent = `Fourteen clear nights: ${run.startDate} → ${run.endDate}. Left → right, top then bottom. Same-time stripe colors = concordance. Click any cell to enlarge.`;
    cap.appendChild(p1);
    const leg = document.createElement("div");
    leg.className = "bed-legend";
    leg.setAttribute("aria-label", "Visual encoding legend");
    leg.innerHTML = [
      "<p><span class='chip chip-deep' aria-hidden='true'></span>Deep <code>#1a3d35</code> · Light <code>#4a9e8a</code> · REM <code>#7dd4b8</code> · Awake <code>#e0f5ef</code> — 5-min buckets in shared clock overlap.</p>",
      "<p><span class='chip chip-wash' aria-hidden='true'></span>Cell wash — warm blush vs cool mint: rougher vs calmer night (phase + restfulness when present).</p>",
      "<p><span class='chip chip-blanket' aria-hidden='true'></span>Blanket — stronger skew when restfulness shows restlessness (you right, Dale left).</p>",
    ].join("");
    cap.appendChild(leg);
  }

  function setupSingleCanvas(canvas, cap, data) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const night = data && pickLatestNight(data.nights);
    drawAll(ctx, night, defaultDrawOpts("single", 1));

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
    cap.textContent = `Night ${night.date} — ${c}; ${r}. Hypnograms: overlap window; blanket: per-person restfulness. Aggregate: ${
      data.aggregate?.meanPhaseConcordance != null
        ? Math.round(data.aggregate.meanPhaseConcordance * 100) + "%"
        : "n/a"
    } mean match.`;
  }

  const bedCellModal = document.getElementById("bed-cell-modal");
  const bedModalTitle = document.getElementById("bed-modal-title");
  const bedModalCanvas = document.getElementById("bed-modal-canvas");
  const bedModalMeta = document.getElementById("bed-modal-meta");
  let modalPrevFocus = null;

  function closeBedCellModal() {
    if (!bedCellModal || bedCellModal.hidden) return;
    bedCellModal.hidden = true;
    document.body.style.overflow = "";
    if (modalPrevFocus && typeof modalPrevFocus.focus === "function") {
      modalPrevFocus.focus();
    }
    modalPrevFocus = null;
  }

  function openBedCellModal(night) {
    if (!bedCellModal || !bedModalCanvas || !bedModalTitle || !bedModalMeta || !night) return;
    modalPrevFocus = document.activeElement;
    bedModalTitle.textContent = night.date;
    fillModalMeta(bedModalMeta, night);
    renderNightDetailCanvas(bedModalCanvas, night);
    bedCellModal.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = bedCellModal.querySelector("[data-close-modal].bed-modal-close");
    if (closeBtn) closeBtn.focus();
  }

  if (bedCellModal) {
    bedCellModal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest("[data-close-modal]")) closeBedCellModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && bedCellModal && !bedCellModal.hidden) {
        e.preventDefault();
        closeBedCellModal();
      }
    });
  }

  if (canvasGrid && capGrid) {
    capGrid.textContent = "Loading couples data…";
    let gridDataCache = null;
    canvasGrid.addEventListener("click", (e) => {
      const night = nightAtGridPosition(canvasGrid, e.clientX, e.clientY);
      if (night) openBedCellModal(night);
    });
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
