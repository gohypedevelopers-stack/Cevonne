import { useRef, useState, useEffect, useMemo } from "react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";

import { useShop } from "@/context/ShopContext";



/* ========================================================================

   PREMIUM AR LIPSTICK ENGINE G UI FIX v11 (SPACING CORRECTED)

   ======================================================================== */



/* =============================== SHADES ================================== */

const LIPSTICK_SHADES = [

  { id: 0, code: null, name: "Natural Finish", color: "transparent" },

  { id: 1, code: "601", name: "Scarlet Siren", color: "#B82229" },

  { id: 2, code: "602", name: "Rouge Eternelle", color: "#8D1D27" },

  { id: 3, code: "603", name: "Power Play", color: "#631820" },

  { id: 4, code: "604", name: "Spiced Silk", color: "#A64D3E" },

  { id: 5, code: "605", name: "Bare Bloom", color: "#D18A68" },

  { id: 6, code: "606", name: "Peach Tantra", color: "#F2A36E" },

  { id: 7, code: "607", name: "Rose Flame", color: "#C95A6C" },

  { id: 8, code: "608", name: "Whisper Nude", color: "#C79082" },

  { id: 9, code: "609", name: "Bloom Creme", color: "#D24E71" },

  { id: 10, code: "610", name: "Berry Amour", color: "#8A3832" },

  { id: 11, code: "611", name: "Cinnamon Saffron", color: "#B64A29" },

  { id: 12, code: "612", name: "Oud Royale", color: "#431621" },

  { id: 13, code: "613", name: "Velvet Crush", color: "#C22A2D" },

  { id: 14, code: "614", name: "Spiced Ember", color: "#A03529" },

  { id: 15, code: "615", name: "Creme Blush", color: "#CF5F4C" },

  { id: 16, code: "616", name: "Caramel Eclair", color: "#C77444" },

  { id: 17, code: "617", name: "Rose Fantasy", color: "#C25D6A" },

  { id: 18, code: "618", name: "Mauve Memoir", color: "#A86267" },

  { id: 19, code: "619", name: "Rouge Mistral", color: "#94373F" },

  { id: 20, code: "620", name: "Flushed Fig", color: "#9A4140" },

  { id: 21, code: "621", name: "Terracotta Dream", color: "#C5552F" },

  { id: 22, code: "622", name: "Nude Myth", color: "#AF705A" },

  { id: 23, code: "623", name: "Runway Rani", color: "#D13864" },

];



const PRODUCT_LINE_LABEL = "Cevonne Luxe";



/* ============================== LANDMARKS ================================= */

const UPPER_LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];

const LOWER_LIP_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

const UPPER_LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];

const LOWER_LIP_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324, 308];



const LIP_LANDMARK_INDICES = new Set([

  ...UPPER_LIP_OUTER,

  ...LOWER_LIP_OUTER,

  ...UPPER_LIP_INNER,

  ...LOWER_LIP_INNER,

]);



/* ============================ TUNABLE PARAMS ============================== */

const BASE_SMOOTHING = 0.94;

const MIN_LIP_SMOOTHING = 0.88;

const MAX_LIP_SMOOTHING = 0.99;

const POSITION_SNAP_THRESHOLD = 0.001;



const BASE_OPACITY = 0.78;

const SHADOW_BOOST = 0.2;



const DPR_DESKTOP = 2;

const DPR_MOBILE = 1.5;

const MAX_BBOX_PAD = 12;



const LIP_ON_FRAMES = 2;

const LIP_OFF_FRAMES = 2;



const MIN_LIP_AREA_PCT = 0.00012;

const MAX_LIP_AREA_PCT = 0.12;



const MAX_LIP_ASPECT = 60;



const STICKY_HOLD_FRAMES = 16;

const AREA_EMA_ALPHA = 0.18;

const OCCL_AREA_DROP = 0.85;



const OCCL_JITTER_THRESH = 0.2;

const OCCL_Z_STD_THRESH = 0.15;



const OCCL_MIN_FRAMES = 3;



const HAND_OVERLAP_RATIO = 0.035;

const HAND_BBOX_PAD_PX = 36;

const ONLY_HIDE_ON_HAND = true;



const MAX_LIP_JUMP_NORM = 0.07;

const MIN_LIP_MOVE_NORM = 0.0015;



const HEAD_VEL_THRESH = 0.03;



const MASK_EASE_ALPHA = 0.9;

const FEATHER_EMA_ALPHA = 0.25;

const FADE_IN_MS = 90;

const FADE_OUT_MS = 80;



/* --- FULLNESS TUNING --- */

const OUTER_SCALE = 1.03;

const INNER_SCALE = 0.96;

const UPPER_Y_BIAS_MAX = 0.15;

const SOFT_EDGE_BOOST = 0.6;



const LIP_SAT_TRIM = 0.9;



/* ========================== ROBUST MODEL LOADER =========================== */

const FACE_MESH_URLS = [

  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js",

  "https://unpkg.com/@mediapipe/face_mesh@0.4/face_mesh.js",

];

const HANDS_URLS = [

  "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js",

  "https://unpkg.com/@mediapipe/hands@0.4/hands.js",

];



function formatShadeLine(shade) {

  const displayName = shade.id === 0 ? "Natural Finish" : shade.name;

  const code =

    shade.code && String(shade.code).trim().length

      ? String(shade.code).trim()

      : null;

  return code ? `${code} - ${displayName}` : displayName;

}



function loadScript(src) {

  return new Promise((resolve, reject) => {

    const s = document.createElement("script");

    s.src = src;

    s.async = true;

    s.crossOrigin = "anonymous";

    s.onload = () => resolve(true);

    s.onerror = () => reject(new Error("Failed to load " + src));

    document.head.appendChild(s);

  });

}



function sleep(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}



async function ensureOne(className, urls) {

  if (window[className]) return true;

  for (const url of urls) {

    try {

      await loadScript(url);

      if (window[className]) return true;

    } catch (_) { }

  }

  return !!window[className];

}



async function ensureModels() {

  const okFace = await ensureOne("FaceMesh", FACE_MESH_URLS);

  const okHands = await ensureOne("Hands", HANDS_URLS);

  return okFace && okHands;

}



/* =============================== UTIL: COLOR ============================== */

function hexToRgb(hex) {

  if (hex === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  let h = hex.trim().replace(/^#/, "");

  if (h.length === 3) h = h.split("").map((c) => c + c).join("");

  const r = parseInt(h.slice(0, 2), 16);

  const g = parseInt(h.slice(2, 4), 16);

  const b = parseInt(h.slice(4, 6), 16);

  return {

    r: isNaN(r) ? 200 : r,

    g: isNaN(g) ? 0 : g,

    b: isNaN(b) ? 0 : b,

    a: 255,

  };

}



function rgbToHsl(r, g, b) {

  r /= 255;

  g /= 255;

  b /= 255;

  const max = Math.max(r, g, b);

  const min = Math.min(r, g, b);

  let h;

  let s;

  let l = (max + min) / 2;

  if (max === min) {

    h = s = 0;

  } else {

    const d = max - min;

    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {

      case r:

        h = (g - b) / d + (g < b ? 6 : 0);

        break;

      case g:

        h = (b - r) / d + 2;

        break;

      case b:

        h = (r - g) / d + 4;

        break;

      default:

        h = 0;

    }

    h /= 6;

  }

  return { h, s, l };

}



function hslToRgb(h, s, l) {

  function hue2rgb(p, q, t) {

    if (t < 0) t += 1;

    if (t > 1) t -= 1;

    if (t < 1 / 6) return p + (q - p) * 6 * t;

    if (t < 1 / 2) return q;

    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;

    return p;

  }

  let r;

  let g;

  let b;

  if (s === 0) {

    r = g = b = l;

  } else {

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;

    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);

    g = hue2rgb(p, q, h);

    b = hue2rgb(p, q, h - 1 / 3);

  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };

}



/* ============================== GEOMETRY ================================== */

function smoothPolyline(points, iterations = 1) {

  let pts = points.slice();

  for (let k = 0; k < iterations; k++) {

    const out = [];

    for (let i = 0; i < pts.length; i++) {

      const p0 = pts[i];

      const p1 = pts[(i + 1) % pts.length];

      const Q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };

      const R = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };

      out.push(Q, R);

    }

    pts = out;

  }

  return pts;

}



function makePathFromRings(outerPts, innerPts) {

  const path = new Path2D();

  path.moveTo(outerPts[0].x, outerPts[0].y);

  for (let i = 1; i < outerPts.length; i++) path.lineTo(outerPts[i].x, outerPts[i].y);

  path.closePath();

  if (innerPts && innerPts.length) {

    path.moveTo(innerPts[0].x, innerPts[0].y);

    for (let i = 1; i < innerPts.length; i++) path.lineTo(innerPts[i].x, innerPts[i].y);

    path.closePath();

  }

  return path;

}



function computeBBox(points) {

  let minX = Infinity;

  let minY = Infinity;

  let maxX = -Infinity;

  let maxY = -Infinity;

  for (const p of points) {

    if (p.x < minX) minX = p.x;

    if (p.y < minY) minY = p.y;

    if (p.x > maxX) maxX = p.x;

    if (p.y > maxY) maxY = p.y;

  }

  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };

}



const rectFromPoints = (pts) => computeBBox(pts);

const rectArea = (r) => Math.max(0, r.w) * Math.max(0, r.h);



function rectPad(r, pad) {

  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };

}



function rectIntersectArea(a, b) {

  const x1 = Math.max(a.x, b.x);

  const y1 = Math.max(a.y, b.y);

  const x2 = Math.min(a.x + a.w, b.x + b.w);

  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const w = Math.max(0, x2 - x1);

  const h = Math.max(0, y2 - y1);

  return w * h;

}



function polygonArea(points) {

  let area = 0;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {

    area += points[j].x * points[i].y - points[i].x * points[j].y;

  }

  return Math.abs(area) * 0.5;

}



function clamp01(x) {

  return Math.max(0, Math.min(1, x));

}



function computeCentroid(points) {

  let sx = 0;

  let sy = 0;

  for (const p of points) {

    sx += p.x;

    sy += p.y;

  }

  return { x: sx / points.length, y: sy / points.length };

}



function stddev(arr) {

  if (!arr.length) return 0;

  const m = arr.reduce((a, b) => a + b, 0) / arr.length;

  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;

  return Math.sqrt(v);

}



function lipsArePresentHysteresis(outer_px, frameW, frameH, wasVisible) {

  if (!outer_px || outer_px.length < 8) return false;

  const bbox = computeBBox(outer_px);

  if (bbox.w < 4 || bbox.h < 4) return false;



  const bleed = 2;

  const inFrame =

    bbox.x >= -bleed &&

    bbox.y >= -bleed &&

    bbox.x + bbox.w <= frameW + bleed &&

    bbox.y + bbox.h <= frameH + bleed;

  if (!inFrame) return false;



  const aspect = Math.max(bbox.w / bbox.h, bbox.h / bbox.w);

  if (aspect > MAX_LIP_ASPECT) return false;



  const pct = polygonArea(outer_px) / (frameW * frameH);



  const minOn = MIN_LIP_AREA_PCT * 1.05;

  const minOff = MIN_LIP_AREA_PCT * 0.9;

  const maxOn = MAX_LIP_AREA_PCT * 0.95;

  const maxOff = MAX_LIP_AREA_PCT * 1.05;



  if (wasVisible) {

    return pct >= minOff && pct <= maxOff;

  } else {

    return pct >= minOn && pct <= maxOn;

  }

}



function smoothTemporal(prev, curr, alpha) {

  if (!prev || prev.length !== curr.length) return curr.slice();

  return curr.map((p, i) => ({

    x: prev[i].x * (1 - alpha) + p.x * alpha,

    y: prev[i].y * (1 - alpha) + p.y * alpha,

  }));

}



function stabilizeWithMotion(prev, curr) {

  if (!prev || prev.length !== curr.length) return curr;

  const cPrev = computeCentroid(prev);

  const cCurr = computeCentroid(curr);

  const bbPrev = computeBBox(prev);

  const bbCurr = computeBBox(curr);

  const sPrev = Math.max(bbPrev.w, bbPrev.h) || 1;

  const sCurr = Math.max(bbCurr.w, bbCurr.h) || 1;

  const scale = Math.max(0.9, Math.min(1.15, sCurr / sPrev));

  const n = curr.length;

  const out = new Array(n);



  const alpha = 0.9;



  for (let i = 0; i < n; i++) {

    const pPrev = prev[i];

    const warpedPrev = {

      x: cCurr.x + (pPrev.x - cPrev.x) * scale,

      y: cCurr.y + (pPrev.y - cPrev.y) * scale,

    };

    out[i] = {

      x: warpedPrev.x * (1 - alpha) + curr[i].x * alpha,

      y: warpedPrev.y * (1 - alpha) + curr[i].y * alpha,

    };

  }

  return out;

}



/* ============================ AR INIT HELPERS ============================= */

function initFaceMeshIfReady(faceMeshRef, latestResultsRef, lastGoodLandmarksRef) {

  if (faceMeshRef.current || !window.FaceMesh) return false;

  const faceMesh = new window.FaceMesh({

    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,

  });

  faceMesh.setOptions({

    maxNumFaces: 1,

    refineLandmarks: true,

    minDetectionConfidence: 0.5,

    minTrackingConfidence: 0.72,

    selfieMode: false,

  });

  faceMesh.onResults((results) => {

    latestResultsRef.current = results;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {

      lastGoodLandmarksRef.current = results.multiFaceLandmarks[0];

    }

  });

  faceMeshRef.current = faceMesh;

  return true;

}



function initHandsIfReady(handsRef, latestHandsRef) {

  if (handsRef.current || !window.Hands) return false;

  const hands = new window.Hands({

    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,

  });

  hands.setOptions({

    maxNumHands: 2,

    modelComplexity: 0,

    minDetectionConfidence: 0.6,

    minTrackingConfidence: 0.6,

    selfieMode: false,

  });

  hands.onResults((results) => {

    latestHandsRef.current = results;

  });

  handsRef.current = hands;

  return true;

}



/* ============================ MOBILE HELPERS ============================== */

function isiOS() {

  return (

    /iPad|iPhone|iPod/.test(navigator.userAgent) ||

    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

  );

}



const isMobileUA = () =>

  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(

    navigator.userAgent

  ) || window.innerWidth <= 768;



async function ensureVideoReady(video) {

  video.setAttribute("playsinline", "true");

  video.setAttribute("webkit-playsinline", "true");

  video.setAttribute("muted", "");

  video.setAttribute("autoplay", "");

  video.muted = true;

  try {

    await video.play();

  } catch (_) { }

  if (video.readyState >= 2) return;

  await new Promise((resolve) => {

    const onCanPlay = () => {

      video.removeEventListener("canplay", onCanPlay);

      resolve();

    };

    video.addEventListener("canplay", onCanPlay, { once: true });

  });

}



async function tryOpenStream() {

  const mobile = isMobileUA();

  const tries = [

    {

      video: {

        facingMode: { ideal: "user" },

        width: { ideal: mobile ? 960 : 1280 },

        height: { ideal: mobile ? 540 : 720 },

        frameRate: { ideal: 30, max: mobile ? 30 : 60 },

      },

      audio: false,

    },

    { video: { facingMode: "user" }, audio: false },

    { video: { facingMode: { ideal: "environment" } }, audio: false },

    { video: true, audio: false },

  ];

  let lastError = null;

  for (const c of tries) {

    try {

      return await navigator.mediaDevices.getUserMedia(c);

    } catch (e) {

      lastError = e;

    }

  }

  throw lastError || new Error("getUserMedia failed");

}



/* =============================== COMPONENT ================================ */



export default function VirtualTryOn() {

  const videoRef = useRef(null);

  const canvasRef = useRef(null);

  const backCanvasRef = useRef(null);



  const tintCanvasLeftRef = useRef(null);

  const tintCanvasRightRef = useRef(null);



  const faceMeshRef = useRef(null);

  const handsRef = useRef(null);



  const streamRef = useRef(null);

  const afRef = useRef(null);



  const latestResultsRef = useRef(null);

  const latestHandsRef = useRef(null);



  const sendingFaceRef = useRef(false);

  const sendingHandsRef = useRef(false);



  const lastGoodLandmarksRef = useRef(null);

  const smoothedLandmarksRef = useRef(null);



  const maskCanvasRef = useRef(null);



  const [error, setError] = useState("");



  const [started, setStarted] = useState(false);

  const [loading, setLoading] = useState(false);

  const wantsRunningRef = useRef(false);



  /* ================= DUO-SHADE + COMPARE STATE ================== */



  const [baseShade, setBaseShade] = useState(LIPSTICK_SHADES[1]);

  const [leftShade, setLeftShade] = useState(LIPSTICK_SHADES[1]);

  const [rightShade, setRightShade] = useState(LIPSTICK_SHADES[0]);



  const [compareEnabled, setCompareEnabled] = useState(false);

  const [hasSecondShade, setHasSecondShade] = useState(false);



  const compareEnabledRef = useRef(compareEnabled);

  const hasSecondShadeRef = useRef(hasSecondShade);



  const [compareRatio, setCompareRatio] = useState(0.5);

  const compareRatioRef = useRef(compareRatio);



  const [isPanelMinimized, setIsPanelMinimized] = useState(false);



  useEffect(() => {

    compareEnabledRef.current = compareEnabled;

  }, [compareEnabled]);



  useEffect(() => {

    hasSecondShadeRef.current = hasSecondShade;

  }, [hasSecondShade]);



  useEffect(() => {

    compareRatioRef.current = compareRatio;

  }, [compareRatio]);



  // When toggling compare, manage shades and layout

  useEffect(() => {

    if (compareEnabled) {

      setLeftShade(baseShade);

      setRightShade(LIPSTICK_SHADES[0]); // bare at start

      setHasSecondShade(false);

      setIsPanelMinimized(true);

    } else {

      setBaseShade(leftShade);

      setHasSecondShade(false);

      setIsPanelMinimized(false);

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [compareEnabled]);



  const leftColorRef = useRef(leftShade.color);

  const rightColorRef = useRef(rightShade.color);

  useEffect(() => {

    leftColorRef.current = leftShade.color;

  }, [leftShade]);

  useEffect(() => {

    rightColorRef.current = rightShade.color;

  }, [rightShade]);



  // Shade for UI centering in strip

  const shadeForStrip = !compareEnabled

    ? baseShade

    : hasSecondShade

      ? rightShade

      : baseShade;



  /* ================= OTHER UI STATE ================== */



  const [snapshot, setSnapshot] = useState(null);

  const [isMobileView, setIsMobileView] = useState(false);

  const { cartItems, wishlist, addToCart, toggleWishlist, openDrawer } = useShop();

  const activeShade = compareEnabled && hasSecondShade ? rightShade : baseShade;

  const shadeKey =

    activeShade && activeShade.id != null ? `ar-${activeShade.id}` : null;

  const isWishlisted = useMemo(

    () => (shadeKey ? wishlist.some((item) => item.key === shadeKey) : false),

    [wishlist, shadeKey]

  );

  const activeShadeLabel = formatShadeLine(activeShade);



  const shadeScrollerRef = useRef(null);

  const shadeButtonsRef = useRef({});



  useEffect(() => {

    const mq = window.matchMedia("(max-width: 640px)");

    const update = () => setIsMobileView(mq.matches);

    update();

    const listener = () => update();

    mq.addEventListener?.("change", listener);

    window.addEventListener("resize", update);

    return () => {

      mq.removeEventListener?.("change", listener);

      window.removeEventListener("resize", update);

    };

  }, []);



  // Camera consent modal

  const [showConsent, setShowConsent] = useState(true);

  const [consentAccepted, setConsentAccepted] = useState(false);

  const [consentDeclined, setConsentDeclined] = useState(false);



  const handleConsentAccept = () => {

    setConsentAccepted(true);

    setConsentDeclined(false);

    setShowConsent(false);

  };



  const handleConsentDecline = () => {

    setConsentAccepted(false);

    setConsentDeclined(true);

    setShowConsent(false);

  };



  const reopenConsent = () => {

    setShowConsent(true);

    setConsentDeclined(false);

  };



  // Fade control for lipstick alpha

  const tintAlphaRef = useRef(0);

  const targetAlphaRef = useRef(0);

  const lastTimeRef = useRef(performance.now());



  // Occlusion / jitter state

  const goodStreakRef = useRef(0);

  const badStreakRef = useRef(0);

  const holdFramesRef = useRef(0);

  const occlAreaEmaRef = useRef(null);

  const occlCentroidEmaRef = useRef(null);

  const occlStreakRef = useRef(0);

  const occludedRef = useRef(false);

  const handFreeStreakRef = useRef(0);



  const prevOuterCssRef = useRef(null);

  const prevInnerCssRef = useRef(null);

  const prevOuterPxRef = useRef(null);

  const prevInnerPxRef = useRef(null);

  const edgeFeatherEmaRef = useRef(null);



  const lipsVisibleRef = useRef(false);

  const handOverlapOnStreakRef = useRef(0);



  /* ============ SHADE STRIP G KEEP ACTIVE IN CENTER ============ */



  useEffect(() => {

    if (isPanelMinimized) return;

    const scroller = shadeScrollerRef.current;

    const activeBtn = shadeButtonsRef.current[shadeForStrip.id];

    if (!scroller || !activeBtn) return;

    const target =

      activeBtn.offsetLeft -

      scroller.clientWidth / 2 +

      activeBtn.offsetWidth / 2;

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;

    const clamped = Math.min(Math.max(target, 0), Math.max(0, maxScroll));

    scroller.scrollTo({ left: clamped, behavior: "smooth" });

  }, [shadeForStrip, started, isPanelMinimized]);



  /* ================= BASIC LAYOUT HOOKS ================= */



  useEffect(() => {

    const { style } = document.body;

    const prev = style.overflow;

    style.overflow = "hidden";

    return () => {

      style.overflow = prev;

    };

  }, []);



  // Eager load scripts

  useEffect(() => {

    const s1 = document.createElement("script");

    s1.src = FACE_MESH_URLS[0];

    s1.crossOrigin = "anonymous";

    s1.async = true;

    s1.defer = true;

    s1.onerror = () =>

      setError("Failed to load FaceMesh. Check network/HTTPS.");

    document.head.appendChild(s1);



    const s2 = document.createElement("script");

    s2.src = HANDS_URLS[0];

    s2.crossOrigin = "anonymous";

    s2.async = true;

    s2.defer = true;

    s2.onerror = () => setError("Failed to load Hands. Check network/HTTPS.");

    document.head.appendChild(s2);



    return () => {

      if (s1 && s1.parentNode) s1.parentNode.removeChild(s1);

      if (s2 && s2.parentNode) s2.parentNode.removeChild(s2);

    };

  }, []);



  // Poll init for FaceMesh + Hands

  useEffect(() => {

    let cancelled = false;

    const POLL_MS = 350;

    const tryInit = () => {

      initFaceMeshIfReady(faceMeshRef, latestResultsRef, lastGoodLandmarksRef);

      initHandsIfReady(handsRef, latestHandsRef);

      if (!cancelled && (!faceMeshRef.current || !handsRef.current)) {

        setTimeout(tryInit, POLL_MS);

      }

    };

    tryInit();

    return () => {

      cancelled = true;

    };

  }, []);



  // Auto-resume when returning to tab

  useEffect(() => {

    const onVis = async () => {

      if (document.hidden) {

        stopCamera();

      } else if (wantsRunningRef.current) {

        await startCamera();

      }

    };

    document.addEventListener("visibilitychange", onVis);

    return () => document.removeEventListener("visibilitychange", onVis);

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  /* ================= CAMERA CONTROL ================= */



  function stopCamera() {

    if (afRef.current) {

      if (

        "cancelVideoFrameCallback" in HTMLVideoElement.prototype &&

        videoRef.current?.cancelVideoFrameCallback

      ) {

        try {

          videoRef.current.cancelVideoFrameCallback(afRef.current);

        } catch (e) { }

      } else {

        cancelAnimationFrame(afRef.current);

      }

      afRef.current = null;

    }

    if (streamRef.current) {

      streamRef.current.getTracks().forEach((t) => t.stop());

      streamRef.current = null;

    }



    smoothedLandmarksRef.current = null;

    goodStreakRef.current = 0;

    badStreakRef.current = LIP_OFF_FRAMES;

    holdFramesRef.current = 0;



    occlAreaEmaRef.current = null;

    occlCentroidEmaRef.current = null;

    occlStreakRef.current = 0;

    occludedRef.current = false;

    handFreeStreakRef.current = 0;



    prevOuterCssRef.current = null;

    prevInnerCssRef.current = null;

    prevOuterPxRef.current = null;

    prevInnerPxRef.current = null;



    edgeFeatherEmaRef.current = null;



    targetAlphaRef.current = 0;

    tintAlphaRef.current = 0;

    lastTimeRef.current = performance.now();



    window.removeEventListener("resize", setupCanvas);

    window.removeEventListener("orientationchange", setupCanvas);



    compareEnabledRef.current = false;

    setCompareEnabled(false);

    setStarted(false);

    setStarted(false);



  }



  function handleExit() {

    stopCamera();

    wantsRunningRef.current = false;

    setSnapshot(null);

    setError("");

    setCompareEnabled(false);

  }



  async function startCamera() {

    if (loading) return;

    if (!navigator.mediaDevices?.getUserMedia) {

      setError(

        "Camera not supported in this browser. Try Chrome/Edge on Android or Safari 15+ on iOS."

      );

      return;

    }

    setLoading(true);



    if (!window.FaceMesh || !window.Hands) {

      const ok = await ensureModels();

      if (!ok) {

        setError(

          "CouldnGt load vision models. Please allow cdn.jsdelivr.net or unpkg."

        );

        setLoading(false);

        return;

      }

      setError("");

      initFaceMeshIfReady(faceMeshRef, latestResultsRef, lastGoodLandmarksRef);

      initHandsIfReady(handsRef, latestHandsRef);

    }



    wantsRunningRef.current = true;



    try {

      stopCamera();

      const stream = await tryOpenStream();

      streamRef.current = stream;



      const video = videoRef.current;

      video.setAttribute("playsinline", "true");

      video.setAttribute("webkit-playsinline", "true");

      video.setAttribute("muted", "");

      video.setAttribute("autoplay", "");

      video.muted = true;

      video.srcObject = stream;



      await ensureVideoReady(video);



      setupCanvas();

      setStarted(true);







      startProcessing();



      window.addEventListener("resize", setupCanvas);

      window.addEventListener("orientationchange", setupCanvas);

      setLoading(false);

    } catch (e) {

      console.error(e);

      setError("Camera access failed. Please ensure permission is granted.");

      stopCamera();

      setLoading(false);



    }

  }



  function setupCanvas() {

    const video = videoRef.current;

    const canvas = canvasRef.current;

    if (!video || !canvas) return;



    const DPR = Math.min(

      window.devicePixelRatio || 1,

      isMobileUA() ? DPR_MOBILE : DPR_DESKTOP

    );

    const w = video.videoWidth || 1280;

    const h = video.videoHeight || 720;



    canvas.style.width = "100%";

    canvas.style.height = "100%";

    canvas.width = Math.max(2, Math.floor(w * DPR));

    canvas.height = Math.max(2, Math.floor(h * DPR));



    const ctx = canvas.getContext("2d", {

      alpha: true,

      willReadFrequently: true,

    });

    ctx.imageSmoothingEnabled = true;

    ctx.imageSmoothingQuality = "high";



    if (!backCanvasRef.current)

      backCanvasRef.current = document.createElement("canvas");

    backCanvasRef.current.width = canvas.width;

    backCanvasRef.current.height = canvas.height;



    if (!tintCanvasLeftRef.current)

      tintCanvasLeftRef.current = document.createElement("canvas");

    tintCanvasLeftRef.current.width = canvas.width;

    tintCanvasLeftRef.current.height = canvas.height;



    if (!tintCanvasRightRef.current)

      tintCanvasRightRef.current = document.createElement("canvas");

    tintCanvasRightRef.current.width = canvas.width;

    tintCanvasRightRef.current.height = canvas.height;



    if (!maskCanvasRef.current)

      maskCanvasRef.current = document.createElement("canvas");

  }



  /* ===================== AR PROCESSING LOOP ===================== */



  function startProcessing() {

    const video = videoRef.current;

    const frontCanvas = canvasRef.current;

    const frontCtx = frontCanvas.getContext("2d", { willReadFrequently: true });

    const backCanvas = backCanvasRef.current;

    const backCtx = backCanvas.getContext("2d", { willReadFrequently: true });



    const tintLeft = tintCanvasLeftRef.current;

    const tintRight = tintCanvasRightRef.current;

    const tintLeftCtx = tintLeft.getContext("2d", { willReadFrequently: true });

    const tintRightCtx = tintRight.getContext("2d", {

      willReadFrequently: true,

    });



    const DPR = Math.min(

      window.devicePixelRatio || 1,

      isMobileUA() ? DPR_MOBILE : DPR_DESKTOP

    );



    const tintOnCtx = (targetCtx, color, drawOuter, drawInner, w, h) => {

      if (!drawOuter || !drawInner) return;

      const bbox = computeBBox(drawOuter);

      const pad = Math.min(

        MAX_BBOX_PAD,

        Math.max(2, Math.round(Math.max(bbox.w, bbox.h) * 0.06))

      );

      const bx = Math.max(0, Math.floor(bbox.x - pad));

      const by = Math.max(0, Math.floor(bbox.y - pad));

      const bw = Math.min(w - bx, Math.ceil(bbox.w + pad * 2));

      const bh = Math.min(h - by, Math.ceil(bbox.h + pad * 2));



      const sx = Math.floor(bx * DPR);

      const sy = Math.floor(by * DPR);

      const sw = Math.max(1, Math.floor(bw * DPR));

      const sh = Math.max(1, Math.floor(bh * DPR));

      const frame = targetCtx.getImageData(sx, sy, sw, sh);



      const mCanvas = maskCanvasRef.current;

      mCanvas.width = sw;

      mCanvas.height = sh;

      const mctx = mCanvas.getContext("2d", { willReadFrequently: true });

      mctx.setTransform(1, 0, 0, 1, 0, 0);

      mctx.clearRect(0, 0, sw, sh);

      mctx.save();

      const toDevice = (p) => ({ x: (p.x - bx) * DPR, y: (p.y - by) * DPR });

      const outerD = (drawOuter || []).map(toDevice);

      const innerD = (drawInner || []).map(toDevice);

      const maskPath = makePathFromRings(outerD, innerD);



      let rawFeather = Math.max(

        1.2,

        Math.min(2.6, Math.max(bw * DPR, bh * DPR) * 0.005)

      );

      rawFeather *= 1 + SOFT_EDGE_BOOST;

      if (edgeFeatherEmaRef.current == null) edgeFeatherEmaRef.current = rawFeather;

      const edgeFeatherPx = (edgeFeatherEmaRef.current =

        edgeFeatherEmaRef.current * (1 - FEATHER_EMA_ALPHA) +

        rawFeather * FEATHER_EMA_ALPHA);



      mctx.filter = `blur(${edgeFeatherPx}px)`;

      mctx.fillStyle = "#fff";

      mctx.fill(maskPath, "evenodd");

      mctx.restore();

      const mask = mctx.getImageData(0, 0, sw, sh);



      const { r: tr, g: tg, b: tb } = hexToRgb(color);

      const thsl = rgbToHsl(tr, tg, tb);

      const data = frame.data;

      const mdata = mask.data;



      for (let i = 0; i < data.length; i += 4) {

        const ma = (mdata[i + 3] / 255) * tintAlphaRef.current;

        if (ma < 0.01) continue;



        const r = data[i];

        const g = data[i + 1];

        const b = data[i + 2];



        const { l } = rgbToHsl(r, g, b);

        const shadeL = l * 0.96 + 0.02;



        const a = clamp01(BASE_OPACITY + SHADOW_BOOST * (0.5 - l)) * ma;



        const nrgb = hslToRgb(thsl.h, thsl.s * LIP_SAT_TRIM, shadeL);



        data[i] = Math.round(nrgb.r * a + r * (1 - a));

        data[i + 1] = Math.round(nrgb.g * a + g * (1 - a));

        data[i + 2] = Math.round(nrgb.b * a + b * (1 - a));

      }

      targetCtx.putImageData(frame, sx, sy);

    };



    const step = async () => {

      const now = performance.now();

      const dt = Math.max(0.001, (now - (lastTimeRef.current || now)) / 1000);

      lastTimeRef.current = now;



      // Run hands model

      if (

        video.readyState >= 2 &&

        !sendingHandsRef.current &&

        handsRef.current

      ) {

        try {

          sendingHandsRef.current = true;

          await handsRef.current.send({ image: video });

        } finally {

          sendingHandsRef.current = false;

        }

      }

      // Run face mesh unless occluded

      if (

        !occludedRef.current &&

        video.readyState >= 2 &&

        !sendingFaceRef.current &&

        faceMeshRef.current

      ) {

        try {

          sendingFaceRef.current = true;

          await faceMeshRef.current.send({ image: video });

        } finally {

          sendingFaceRef.current = false;

        }

      }



      const w = frontCanvas.width / DPR;

      const h = frontCanvas.height / DPR;



      // Draw mirrored camera to back buffer

      backCtx.setTransform(1, 0, 0, 1, 0, 0);

      backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height);

      backCtx.setTransform(-DPR, 0, 0, DPR, backCanvas.width, 0);



      // PREMIUM CAMERA FILTER

      if (video.readyState >= 2) {

        backCtx.filter = "contrast(1.1) saturate(1.2) blur(0.5px)";

        backCtx.drawImage(video, 0, 0, w, h);

        backCtx.filter = "none";

      }



      // Smooth landmarks

      const raw = latestResultsRef.current?.multiFaceLandmarks?.[0] || null;

      if (raw && !occludedRef.current) {

        if (!smoothedLandmarksRef.current) {

          smoothedLandmarksRef.current = raw.map((p) => ({

            x: p.x,

            y: p.y,

            z: p.z || 0,

          }));

        } else {

          for (let i = 0; i < raw.length; i++) {

            const s = smoothedLandmarksRef.current[i];

            const c = raw[i];

            if (LIP_LANDMARK_INDICES.has(i)) {

              const dx = c.x - s.x;

              const dy = c.y - s.y;

              const planar = Math.hypot(dx, dy);

              const ratio = Math.min(1, planar / POSITION_SNAP_THRESHOLD);

              const blend =

                MIN_LIP_SMOOTHING +

                (MAX_LIP_SMOOTHING - MIN_LIP_SMOOTHING) * ratio;

              s.x += (c.x - s.x) * blend + dx * 0.08;

              s.y += (c.y - s.y) * blend + dy * 0.08;

              s.z += (c.z - s.z) * (blend * 0.5);

            } else {

              s.x += (c.x - s.x) * BASE_SMOOTHING;

              s.y += (c.y - s.y) * BASE_SMOOTHING;

              s.z += (c.z - s.z) * (BASE_SMOOTHING * 0.5);

            }

          }

        }

      }



      const drawLm = smoothedLandmarksRef.current || lastGoodLandmarksRef.current;



      if (drawLm) {

        let outerU = getLipPoints(drawLm, UPPER_LIP_OUTER, w, h);

        let outerL = getLipPoints(drawLm, LOWER_LIP_OUTER, w, h);

        let innerU = getLipPoints(drawLm, UPPER_LIP_INNER, w, h);

        let innerL = getLipPoints(drawLm, LOWER_LIP_INNER, w, h);



        let outerRing = smoothPolyline(

          [...outerU, ...outerL.slice().reverse()],

          0

        );

        let innerRing = smoothPolyline(

          [...innerU, ...innerL.slice().reverse()],

          0

        );



        let outerU_px = getLipPointsPx(drawLm, UPPER_LIP_OUTER, w, h);

        let outerL_px = getLipPointsPx(drawLm, LOWER_LIP_OUTER, w, h);

        let innerU_px = getLipPointsPx(drawLm, UPPER_LIP_INNER, w, h);

        let innerL_px = getLipPointsPx(drawLm, LOWER_LIP_INNER, w, h);



        const lipBox = computeBBox([...outerU_px, ...outerL_px]);

        const upBias = Math.min(UPPER_Y_BIAS_MAX, lipBox.h * 0.02);

        outerU_px = outerU_px.map((p) => ({ x: p.x, y: p.y - upBias }));



        let outer_px = smoothPolyline(

          [...outerU_px, ...outerL_px.slice().reverse()],

          0

        );

        let inner_px = smoothPolyline(

          [...innerU_px, ...innerL_px.slice().reverse()],

          0

        );



        const scalePoly = (poly, s) => {

          const c = computeCentroid(poly);

          return poly.map((p) => ({

            x: c.x + (p.x - c.x) * s,

            y: c.y + (p.y - c.y) * s,

          }));

        };



        // --- DYNAMIC MOUTH FILL LOGIC ---

        const innerBox = computeBBox(inner_px);

        const outerBox = computeBBox(outer_px);

        const openness = outerBox.h > 1 ? innerBox.h / outerBox.h : 0;



        const dynamicInnerScale = Math.max(

          0.72,

          INNER_SCALE - openness * 0.45

        );



        outer_px = scalePoly(outer_px, OUTER_SCALE);

        inner_px = scalePoly(inner_px, dynamicInnerScale);



        outer_px = stabilizeWithMotion(prevOuterPxRef.current, outer_px);

        inner_px = stabilizeWithMotion(prevInnerPxRef.current, inner_px);

        outerRing = stabilizeWithMotion(prevOuterCssRef.current, outerRing);

        innerRing = stabilizeWithMotion(prevInnerCssRef.current, innerRing);



        outer_px = smoothTemporal(prevOuterPxRef.current, outer_px, MASK_EASE_ALPHA);

        inner_px = smoothTemporal(prevInnerPxRef.current, inner_px, MASK_EASE_ALPHA);

        outerRing = smoothTemporal(prevOuterCssRef.current, outerRing, MASK_EASE_ALPHA);

        innerRing = smoothTemporal(prevInnerCssRef.current, innerRing, MASK_EASE_ALPHA);



        // TRUST GATE: kill jumps & micro jitter

        if (

          lipsVisibleRef.current &&

          prevOuterPxRef.current &&

          prevOuterPxRef.current.length === outer_px.length

        ) {

          const prevC = computeCentroid(prevOuterPxRef.current);

          const currC = computeCentroid(outer_px);

          const diag = Math.max(1, Math.hypot(w, h));

          const centroidShiftNorm =

            Math.hypot(currC.x - prevC.x, currC.y - prevC.y) / diag;



          if (centroidShiftNorm > MAX_LIP_JUMP_NORM) {

            outer_px = prevOuterPxRef.current.slice();

            inner_px = (prevInnerPxRef.current || inner_px).slice();

            outerRing = (prevOuterCssRef.current || outerRing).slice();

            innerRing = (prevInnerCssRef.current || innerRing).slice();

          } else if (centroidShiftNorm < MIN_LIP_MOVE_NORM) {

            outer_px = prevOuterPxRef.current.slice();

            inner_px = (prevInnerPxRef.current || inner_px).slice();

            outerRing = (prevOuterCssRef.current || outerRing).slice();

            innerRing = (prevInnerCssRef.current || innerRing).slice();

          }

        }



        const hasRaw = !!latestResultsRef.current?.multiFaceLandmarks?.[0];



        const lipsVisibleNow =

          hasRaw &&

          lipsArePresentHysteresis(outer_px, w, h, lipsVisibleRef.current);



        const handBoxes = getHandBBoxesMirrored(

          latestHandsRef.current,

          w,

          h,

          HAND_BBOX_PAD_PX

        );

        const lipRect = rectFromPoints(outer_px);

        const lipArea = rectArea(lipRect);

        const handOverlapNow = handBoxes.some(

          (hb) =>

            rectIntersectArea(hb, lipRect) >= lipArea * HAND_OVERLAP_RATIO

        );



        const outerArea = polygonArea(outer_px);

        if (occlAreaEmaRef.current == null)

          occlAreaEmaRef.current = outerArea;

        occlAreaEmaRef.current =

          occlAreaEmaRef.current * (1 - AREA_EMA_ALPHA) +

          outerArea * AREA_EMA_ALPHA;



        const cNow = computeCentroid(outer_px);

        const diag = Math.hypot(w, h);

        if (occlCentroidEmaRef.current == null)

          occlCentroidEmaRef.current = { ...cNow };

        const prevEx = { ...occlCentroidEmaRef.current };

        occlCentroidEmaRef.current.x +=

          (cNow.x - occlCentroidEmaRef.current.x) * 0.25;

        occlCentroidEmaRef.current.y +=

          (cNow.y - occlCentroidEmaRef.current.y) * 0.25;

        const headVel =

          Math.hypot(cNow.x - prevEx.x, cNow.y - prevEx.y) / diag;

        const jitter =

          Math.hypot(

            cNow.x - occlCentroidEmaRef.current.x,

            cNow.y - occlCentroidEmaRef.current.y

          ) / diag;

        const jitterSpike = jitter > OCCL_JITTER_THRESH;

        const fastHeadMove = headVel > HEAD_VEL_THRESH;



        const lipZ = Array.from(LIP_LANDMARK_INDICES).map(

          (i) => drawLm[i].z || 0

        );

        const zStd = stddev(lipZ);

        const zNoisy = zStd > OCCL_Z_STD_THRESH;



        const softOcclusionNow =

          (outerArea <

            occlAreaEmaRef.current * (1 - OCCL_AREA_DROP) &&

            !fastHeadMove) ||

          (jitterSpike && !fastHeadMove) ||

          zNoisy;



        let HARD_OCCLUSION;

        if (ONLY_HIDE_ON_HAND) {

          if (handOverlapNow) {

            handOverlapOnStreakRef.current = Math.min(

              2,

              handOverlapOnStreakRef.current + 1

            );

          } else {

            handOverlapOnStreakRef.current = 0;

          }

          HARD_OCCLUSION =

            handOverlapNow ||

            handOverlapOnStreakRef.current >= 2;

          occlStreakRef.current = 0;

        } else {

          const occludedNow = hasRaw && (handOverlapNow || softOcclusionNow);

          if (occludedNow || !lipsVisibleNow) occlStreakRef.current++;

          else occlStreakRef.current = 0;

          HARD_OCCLUSION =

            handOverlapNow || occlStreakRef.current >= OCCL_MIN_FRAMES;

        }



        if (!handOverlapNow) handFreeStreakRef.current++;

        else handFreeStreakRef.current = 0;

        if (handFreeStreakRef.current >= 2) occludedRef.current = false;



        const anyColorSelected =

          leftColorRef.current !== "transparent" ||

          (compareEnabledRef.current &&

            hasSecondShadeRef.current &&

            rightColorRef.current !== "transparent");



        const shouldShow =

          (lipsVisibleNow && !HARD_OCCLUSION) || holdFramesRef.current > 0;

        targetAlphaRef.current =

          anyColorSelected && shouldShow ? 1 : 0;



        if (lipsVisibleNow && !HARD_OCCLUSION) {

          goodStreakRef.current = Math.min(

            LIP_ON_FRAMES,

            goodStreakRef.current + 1

          );

          badStreakRef.current = 0;

          holdFramesRef.current = STICKY_HOLD_FRAMES;

        } else {

          badStreakRef.current = Math.min(

            LIP_OFF_FRAMES,

            badStreakRef.current + 1

          );

          goodStreakRef.current = 0;

          if (holdFramesRef.current > 0) holdFramesRef.current--;

        }



        if (HARD_OCCLUSION) {

          occludedRef.current = true;

          holdFramesRef.current = 0;

          targetAlphaRef.current = 0;

        }



        lipsVisibleRef.current = lipsVisibleNow;



        if (lipsVisibleNow) {

          prevOuterPxRef.current = outer_px.slice();

          prevInnerPxRef.current = inner_px.slice();

          prevOuterCssRef.current = outerRing.slice();

          prevInnerCssRef.current = innerRing.slice();

        }



        const validLipMesh =

          outer_px &&

          inner_px &&

          outer_px.length >= 8 &&

          inner_px.length >= 8;



        // Build left/right tinted canvases

        tintLeftCtx.setTransform(1, 0, 0, 1, 0, 0);

        tintRightCtx.setTransform(1, 0, 0, 1, 0, 0);

        tintLeftCtx.clearRect(0, 0, tintLeft.width, tintLeft.height);

        tintRightCtx.clearRect(0, 0, tintRight.width, tintRight.height);

        tintLeftCtx.drawImage(backCanvas, 0, 0);

        tintRightCtx.drawImage(backCanvas, 0, 0);



        const alpha = tintAlphaRef.current;

        const shouldPaintShade =

          validLipMesh && lipsVisibleNow && !HARD_OCCLUSION && anyColorSelected;

        const willDraw =

          shouldPaintShade &&

          (alpha > 0.02 || targetAlphaRef.current > 0.02);



        if (willDraw && shouldPaintShade) {

          const drawOuter = outer_px;

          const drawInner = inner_px;

          if (drawOuter && drawInner) {

            const lc = leftColorRef.current;

            const rc = rightColorRef.current;



            if (lc !== "transparent") {

              tintOnCtx(tintLeftCtx, lc, drawOuter, drawInner, w, h);

            }



            let rightTint = null;

            if (!compareEnabledRef.current) {

              rightTint = lc !== "transparent" ? lc : null;

            } else if (hasSecondShadeRef.current && rc !== "transparent") {

              rightTint = rc;

            }



            if (rightTint) {

              tintOnCtx(

                tintRightCtx,

                rightTint,

                drawOuter,

                drawInner,

                w,

                h

              );

            }

          }

        } else if (HARD_OCCLUSION) {

          tintAlphaRef.current *= 0.5;

        }



        const tau =

          (targetAlphaRef.current > tintAlphaRef.current

            ? FADE_IN_MS

            : FADE_OUT_MS) / 1000;

        const k = 1 - Math.exp(-dt / Math.max(0.001, tau));

        tintAlphaRef.current +=

          (targetAlphaRef.current - tintAlphaRef.current) * k;

      }



      // Present on main canvas

      frontCtx.setTransform(1, 0, 0, 1, 0, 0);

      frontCtx.clearRect(0, 0, frontCanvas.width, frontCanvas.height);



      if (compareEnabledRef.current) {

        const splitRatio = Math.min(0.93, Math.max(0.07, compareRatioRef.current));

        const splitPx = frontCanvas.width * splitRatio;



        frontCtx.save();

        frontCtx.beginPath();

        frontCtx.rect(0, 0, splitPx, frontCanvas.height);

        frontCtx.clip();

        frontCtx.drawImage(tintLeft, 0, 0);

        frontCtx.restore();



        frontCtx.save();

        frontCtx.beginPath();

        frontCtx.rect(

          splitPx,

          0,

          frontCanvas.width - splitPx,

          frontCanvas.height

        );

        frontCtx.clip();

        frontCtx.drawImage(tintRight, 0, 0);

        frontCtx.restore();



        frontCtx.save();

        frontCtx.fillStyle = "rgba(255,255,255,0.85)";

        frontCtx.fillRect(splitPx - 0.75, 0, 1.5, frontCanvas.height);

        frontCtx.restore();

      } else {

        frontCtx.drawImage(tintLeft, 0, 0);

      }



      if (

        "requestVideoFrameCallback" in HTMLVideoElement.prototype &&

        videoRef.current?.requestVideoFrameCallback

      ) {

        afRef.current = videoRef.current.requestVideoFrameCallback(() => step());

      } else {

        afRef.current = requestAnimationFrame(step);

      }

    };



    step();

  }



  /* ============== GEOMETRY HELPERS USING LANDMARKS ============== */



  function getLipPoints(landmarks, indices, w, h) {

    return indices.map((i) => ({

      x: landmarks[i].x * w,

      y: landmarks[i].y * h,

    }));

  }



  function getLipPointsPx(landmarks, indices, w, h) {

    return indices.map((i) => ({

      x: w - landmarks[i].x * w,

      y: landmarks[i].y * h,

    }));

  }



  function getHandBBoxesMirrored(handsResults, w, h, padPx = 0) {

    const boxes = [];

    if (!handsResults || !handsResults.multiHandLandmarks) return boxes;

    for (const lmArr of handsResults.multiHandLandmarks) {

      let minX = Infinity;

      let minY = Infinity;

      let maxX = -Infinity;

      let maxY = -Infinity;

      for (const lm of lmArr) {

        const x = w - lm.x * w;

        const y = lm.y * h;

        if (x < minX) minX = x;

        if (y < minY) minY = y;

        if (x > maxX) maxX = x;

        if (y > maxY) maxY = y;

      }

      const r = {

        x: minX,

        y: minY,

        w: Math.max(1, maxX - minX),

        h: Math.max(1, maxY - minY),

      };

      boxes.push(rectPad(r, padPx));

    }

    return boxes;

  }



  /* ================= SNAPSHOT ================= */



  function takeSnapshot() {

    const canvas = canvasRef.current;

    if (canvas) {

      const DPR = Math.min(

        window.devicePixelRatio || 1,

        isMobileUA() ? DPR_MOBILE : DPR_DESKTOP

      );

      const tmp = document.createElement("canvas");

      tmp.width = Math.floor(canvas.width / DPR);

      tmp.height = Math.floor(canvas.height / DPR);

      const tctx = tmp.getContext("2d");

      tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);

      setSnapshot(tmp.toDataURL("image/png"));

    }

  }



  const handleShadeSelect = (shade) => {

    if (!compareEnabledRef.current) {

      setBaseShade(shade);

      setLeftShade(shade);

      return;

    }



    setRightShade(shade);

    setHasSecondShade(shade.id !== 0);

  };



  const toggleCompare = () => {

    setCompareEnabled((prev) => {

      const next = !prev;

      compareEnabledRef.current = next;

      setCompareRatio(0.5);

      compareRatioRef.current = 0.5;

      return next;

    });

  };



  const handleAddAnother = () => {

    if (!compareEnabledRef.current) {

      toggleCompare();

      return;

    }

    setIsPanelMinimized(false);

  };



  const handleAddToCart = () => {

    if (!shadeKey) return;

    const added = addToCart({

      key: shadeKey,

      name: activeShadeLabel,

      color: activeShade.color,

    });

    if (added) {

      toast.success(`${activeShadeLabel} added to cart`);

      openDrawer("cart");

    } else {

      toast(`${activeShadeLabel} is already in your cart`);

    }

  };



  const handleToggleWishlist = () => {

    if (!shadeKey) return;

    const action = toggleWishlist({

      key: shadeKey,

      name: activeShadeLabel,

      color: activeShade.color,

    });

    if (action === "added") {

      toast.success(`${activeShadeLabel} saved to wishlist`);

      openDrawer("wishlist");

    } else if (action === "removed") {

      toast(`${activeShadeLabel} removed from wishlist`);

    }

  };



  /* ================= RENDER ================= */



  const displayLeftLine = formatShadeLine(leftShade);

  const displayRightLine = hasSecondShade

    ? formatShadeLine(rightShade)

    : "Add another";



  return (

    <div

      className="fixed inset-0 w-screen bg-black text-white font-sans overflow-hidden touch-manipulation select-none"

      // Change: 100dvh prevents URL bar scrolling issues on mobile

      style={{ height: "100dvh" }}

    >

      <div className="relative w-full h-full bg-black">

        <video ref={videoRef} className="hidden" playsInline muted autoPlay />

        <canvas

          ref={canvasRef}

          className="absolute inset-0 w-full h-full object-cover"

        />







        {/* TOP HEADER (Safe area padded) */}

        {consentAccepted && !showConsent && !snapshot && (

          <div className="absolute top-0 left-0 right-0 z-40 flex justify-between items-start p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/50 to-transparent pointer-events-none">

            <div className="text-xs font-bold tracking-[0.3em] uppercase text-white/90 drop-shadow-md pointer-events-auto">

              Cevonne AR

            </div>



            <button

              type="button"

              onClick={handleExit}

              className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-colors"

              aria-label="Close"

            >

              <svg

                className="w-5 h-5"

                viewBox="0 0 24 24"

                fill="none"

                stroke="currentColor"

                strokeWidth="1.5"

              >

                <line x1="18" y1="6" x2="6" y2="18" />

                <line x1="6" y1="6" x2="18" y2="18" />

              </svg>

            </button>

          </div>

        )}



        {/* CONSENT MODAL */}

        {showConsent && (

          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-fade-in">

            <div className="relative w-full max-w-md bg-[#1a1a1a] text-white rounded-2xl border border-white/10 p-8 shadow-2xl">

              <h2 className="text-2xl font-light tracking-wide mb-2">

                Virtual Try-On

              </h2>

              <p className="text-white/60 text-sm mb-8 leading-relaxed">

                Allow camera access to see how these shades look on you in

                real-time.

              </p>

              <div className="flex flex-col gap-3">

                <button

                  onClick={handleConsentAccept}

                  className="w-full py-3.5 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition"

                >

                  Enable Camera

                </button>

                <button

                  onClick={handleConsentDecline}

                  className="w-full py-3.5 rounded-full border border-white/10 hover:bg-white/5 transition font-medium text-white/70"

                >

                  Not Now

                </button>

              </div>

            </div>

          </div>

        )}



        {/* SNAPSHOT PREVIEW */}

        {snapshot && (

          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-fade-in">

            <div className="relative max-w-md w-full">

              <img

                src={snapshot}

                alt="Look"

                className="w-full rounded-xl shadow-2xl border border-white/10"

              />

              <div className="mt-6 flex gap-3">

                <button

                  onClick={() => setSnapshot(null)}

                  className="flex-1 py-3 rounded-full bg-zinc-800 text-white font-medium border border-zinc-700"

                >

                  Retake

                </button>

                <a

                  href={snapshot}

                  download="marvella-look.png"

                  className="flex-1 py-3 rounded-full bg-white text-black font-bold text-center flex items-center justify-center"

                >

                  Save

                </a>

              </div>

            </div>

          </div>

        )}



        {/* START BUTTON */}

        {!started && consentAccepted && !loading && (

          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 backdrop-blur-sm">

            <button

              onClick={startCamera}

              className="px-8 py-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-lg font-medium hover:bg-white/20 transition shadow-lg"

            >

              Start Camera

            </button>

          </div>

        )}



        {/* LOADING OVERLAY */}

        {loading && (

          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">

            <div className="flex flex-col items-center gap-3 text-white">

              <span className="loading loading-spinner text-white"></span>

              <span className="text-xs uppercase tracking-[0.3em] text-white/80">Loading...</span>

            </div>

          </div>

        )}



        {/* ERROR TOAST */}

        {error && (

          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full text-center backdrop-blur-md text-sm shadow-lg w-max max-w-[90%]">

            {error}

          </div>

        )}



        {/* SPLIT GUIDE + FACE LABELS */}

        {compareEnabled && started && !snapshot && (

          <>

            <div className="absolute inset-0 z-20 pointer-events-none">

              <div

                className="absolute top-0 bottom-0 w-[1px] bg-white/60 shadow-[0_0_15px_rgba(255,255,255,0.5)]"

                style={{ left: `50%` }}

              />

              <div

                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white/20 backdrop-blur-md border border-white/50 rounded-full shadow-xl flex items-center justify-center text-white"

                style={{ left: `50%` }}

              >

                <svg

                  className="w-4 h-4"

                  viewBox="0 0 24 24"

                  fill="none"

                  stroke="currentColor"

                  strokeWidth="2"

                >

                  <path d="M15 18l-6-6 6-6" />

                </svg>

                <svg

                  className="w-4 h-4 rotate-180"

                  viewBox="0 0 24 24"

                  fill="none"

                  stroke="currentColor"

                  strokeWidth="2"

                >

                  <path d="M15 18l-6-6 6-6" />

                </svg>

              </div>

            </div>



            <div className="absolute inset-0 z-20 pointer-events-none">

              {/* Left shade chip - Top-Relative positioning from v9 preserved */}

              <div className="absolute top-[40%] left-[25%] -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in pointer-events-none">

                <div

                  className="w-14 h-14 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] border-2 border-white"

                  style={{ backgroundColor: leftShade.color }}

                />

                <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full border border-white/10 shadow-lg whitespace-nowrap">

                  {leftShade.name || "Shade 1"}

                </span>

              </div>



              {/* Right G Add another */}

              <button

                type="button"

                onClick={handleAddAnother}

                className="absolute top-[40%] right-[25%] translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in pointer-events-auto"

              >

                <div

                  className="w-14 h-14 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] border-2 border-white"

                  style={{

                    backgroundColor: hasSecondShade

                      ? rightShade.color

                      : "rgba(255,255,255,0.1)",

                  }}

                />

                <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full border border-white/10 shadow-lg whitespace-nowrap">

                  {hasSecondShade ? rightShade.name : "Add another"}

                </span>

              </button>

            </div>

          </>

        )}



        {/* BOTTOM COMMAND CENTER */}

        {started && !snapshot && (

          <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col justify-end">

            {/* GRADIENT BACKGROUND */}

            <div className="absolute bottom-0 left-0 right-0 h-[45vh] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />



            {/* Changed: pb-safe for iPhone home bar */}

            <div className="relative w-full pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">

              {/* Minimise / expand tray */}

              <div className="absolute top-0 right-4 z-20 pointer-events-auto">

                <button

                  onClick={() => setIsPanelMinimized((v) => !v)}

                  className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all border border-white/5 shadow-lg backdrop-blur-md"

                >

                  <svg

                    className={`w-5 h-5 text-white/90 transition-transform duration-300 ${isPanelMinimized ? "rotate-180" : ""

                      }`}

                    fill="none"

                    viewBox="0 0 24 24"

                    stroke="currentColor"

                  >

                    <path

                      strokeLinecap="round"

                      strokeLinejoin="round"

                      strokeWidth={2}

                      d="M19 9l-7 7-7-7"

                    />

                  </svg>

                </button>

              </div>



              {/* HEADER / LABELS */}

              <div className="flex flex-col items-center justify-center px-6 mb-2 relative z-10">

                {!compareEnabled && (

                  <>

                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-1">

                      {PRODUCT_LINE_LABEL}

                    </div>

                    <div className="text-xl font-light text-white tracking-wide truncate max-w-[240px] md:max-w-[300px] text-center drop-shadow-md">

                      {formatShadeLine(baseShade)}

                    </div>

                  </>

                )}



                {compareEnabled && !isPanelMinimized && (

                  <>

                    <div className="text-[10px] md:text-xs font-medium text-white/70 uppercase tracking-[0.18em] mb-1">

                      Select a shade to compare

                    </div>

                    <div className="text-[10px] text-white/60 text-center">

                      {hasSecondShade

                        ? formatShadeLine(rightShade)

                        : "Tap a shade below"}

                    </div>

                  </>

                )}



                {compareEnabled && isPanelMinimized && hasSecondShade && (

                  <div className="flex items-center gap-2 text-[11px] text-white/70">

                    <span className="truncate max-w-[120px]">{displayLeftLine}</span>

                    <span className="opacity-40">-+</span>

                    <span className="truncate max-w-[120px]">{displayRightLine}</span>

                  </div>

                )}

              </div>



              {/* SHADE STRIP */}

              <div

                className={`overflow-hidden transition-all duration-500 ease-in-out relative z-10 ${isPanelMinimized

                  ? "max-h-0 opacity-0"

                  : "max-h-[260px] opacity-100"

                  }`}

              >
                <div className="relative w-full h-24 mb-1">
                  <div
                    ref={shadeScrollerRef}
                    className="absolute inset-0 flex items-center gap-4 px-[50vw] overflow-x-auto hide-scrollbar snap-x snap-center py-3"
                    style={{ scrollBehavior: "smooth" }}
                  >
                    {LIPSTICK_SHADES.map((shade) => {
                      const isActive =
                        (!compareEnabled && baseShade.id === shade.id) ||
                        (compareEnabled &&

                          hasSecondShade &&

                          rightShade.id === shade.id);



                      return (

                        <button

                          key={shade.id}
                          ref={(el) => (shadeButtonsRef.current[shade.id] = el)}
                          onClick={() => handleShadeSelect(shade)}
                          className={`relative flex-shrink-0 rounded-full overflow-hidden transition-all duration-300 snap-center group ${isActive
                              ? "w-14 h-14 md:w-16 md:h-16 ring-2 ring-white ring-offset-2 ring-offset-transparent shadow-xl scale-110"
                              : "w-12 h-12 md:w-14 md:h-14 opacity-75 hover:opacity-100 hover:scale-105"
                            }`}
                          style={{ borderRadius: "50%" }}
                        >
                          <div
                            className="w-full h-full rounded-full border border-white/15 shadow-inner"
                            style={{
                              backgroundColor:
                                shade.color === "transparent" ? "#333" : shade.color,
                              borderRadius: "50%",
                            }}
                          />
                          {shade.id === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-4 h-[1px] bg-white/50 -rotate-45" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>


              {(cartItems.length > 0 || wishlist.length > 0) && (

                <div className="relative z-10 mb-2 flex flex-wrap justify-center gap-3 px-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">

                  {cartItems.length > 0 && (

                    <Badge className="rounded-full bg-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.3em]">

                      Cart {cartItems.length} item

                      {cartItems.length === 1 ? "" : "s"}

                    </Badge>

                  )}

                  {wishlist.length > 0 && (

                    <Badge

                      variant="outline"

                      className="rounded-full border-white/30 px-3 py-1 text-[9px] uppercase tracking-[0.3em] text-white/80"

                    >

                      Saved {wishlist.length} look

                      {wishlist.length === 1 ? "" : "s"}

                    </Badge>

                  )}

                </div>

              )}



              {/* BOTTOM ACTIONS (FIXED SPACING) */}

              <div className="pb-4 px-4 pt-2 w-full relative z-10">

                <div className="grid grid-cols-[1fr_auto_1fr] items-center max-w-[520px] mx-auto w-full gap-4">

                  {/* LEFT: COMPARE (Centered in grid col) */}

                  <div className="flex justify-center items-center md:pl-14 sm:pl-24">

                    <button

                      onClick={toggleCompare}

                      className="flex flex-col items-center gap-1.5"

                    >

                      <div

                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 flex items-center justify-center transition-all backdrop-blur-sm ${compareEnabled

                          ? "bg-white text-black"

                          : "bg-black/25 text-white hover:bg-white/10 hover:border-white/50"

                          }`}

                      >

                        <svg

                          className="w-4 h-4 md:w-5 md:h-5"

                          viewBox="0 0 24 24"

                          fill="none"

                          stroke="currentColor"

                          strokeWidth="1.5"

                        >

                          <circle cx="12" cy="12" r="9" />

                          <path d="M12 3V21" />

                          <path

                            d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3V21Z"

                            fill="currentColor"

                            fillOpacity="0.35"

                          />

                        </svg>

                      </div>



                      <span className="min-h-[14px] flex items-center justify-center text-[8px] md:text-[9px] font-semibold tracking-[0.2em] uppercase text-white/70 leading-tight text-center">

                        COMPARE

                      </span>

                    </button>

                  </div>



                  {/* CENTER: SNAPSHOT */}

                  <div className="flex justify-center mb-4">

                    <button

                      onClick={takeSnapshot}

                      className="relative group"

                    >

                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] border-white flex items-center justify-center transition-all group-active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.15)] backdrop-blur-sm">

                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white transition-all group-hover:scale-95 shadow-inner" />

                      </div>

                    </button>

                  </div>



                  {/* RIGHT: CART + WISHLIST (Centered in grid col) */}

                  <div className="flex justify-center items-center">

                    <div className="flex items-start gap-3 md:gap-6">

                      {/* ADD TO CART */}

                      <button

                        type="button"

                        onClick={handleAddToCart}

                        aria-label={`Add ${activeShadeLabel} to cart`}

                        className="flex flex-col items-center gap-1.5"

                      >

                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/25 backdrop-blur-sm flex items-center justify-center text-white hover:border-white/60 hover:bg-white/10 transition-colors">

                          <svg

                            className="w-4 h-4 md:w-5 md:h-5"

                            viewBox="0 0 24 24"

                            fill="none"

                            stroke="currentColor"

                            strokeWidth="1.5"

                          >

                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />

                            <line x1="3" y1="6" x2="21" y2="6" />

                            <path d="M16 10a4 4 0 0 1-8 0" />

                          </svg>

                        </div>



                        <span className="min-h-[14px] flex items-center justify-center text-[8px] md:text-[9px] font-semibold tracking-[0.2em] uppercase text-white/70 leading-tight text-center">

                          CART

                        </span>

                      </button>



                      {/* WISHLIST */}

                      <button

                        type="button"

                        onClick={handleToggleWishlist}

                        aria-label={`${isWishlisted ? "Remove" : "Save"

                          } ${activeShadeLabel} ${isWishlisted ? "from" : "to"} wishlist`}

                        aria-pressed={isWishlisted}

                        className="flex flex-col items-center gap-1.5"

                      >

                        <div

                          className={`w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/25 backdrop-blur-sm flex items-center justify-center hover:border-white/60 hover:bg-white/10 transition-colors text-white ${isWishlisted

                            ? "text-rose-400 border-rose-400/60 hover:border-rose-400/80 shadow-[0_0_20px_rgba(239,68,68,0.4)]"

                            : ""

                            }`}

                        >

                          <svg

                            className="w-4 h-4 md:w-5 md:h-5"

                            viewBox="0 0 24 24"

                            fill="none"

                            stroke="currentColor"

                            strokeWidth="1.5"

                          >

                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />

                          </svg>

                        </div>



                        <span className="min-h-[14px] flex items-center justify-center text-[8px] md:text-[9px] font-semibold tracking-[0.2em] uppercase text-white/70 leading-tight text-center">

                          SAVE

                        </span>

                      </button>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}

