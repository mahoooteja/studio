// Szacowanie druku FDM bez slicera: objętość, powłoki, wypełnienie, podpory i czas.
// Działa na „zupie trójkątów”: Float32Array po 9 liczb (3 wierzchołki × xyz) na trójkąt, w mm.
// Wyniki to przybliżenie (zwykle ±20–30% względem prawdziwego slicera).

export type MaterialId = "PLA" | "PETG" | "ABS" | "ASA" | "TPU" | "PA" | "PC";

export const MATERIALS: Record<MaterialId, { name: string; density: number; speedFactor: number }> = {
  PLA: { name: "PLA", density: 1.24, speedFactor: 1 },
  PETG: { name: "PETG", density: 1.27, speedFactor: 0.85 },
  ABS: { name: "ABS", density: 1.04, speedFactor: 0.95 },
  ASA: { name: "ASA", density: 1.07, speedFactor: 0.95 },
  TPU: { name: "TPU", density: 1.21, speedFactor: 0.35 },
  PA: { name: "PA (nylon)", density: 1.14, speedFactor: 0.8 },
  PC: { name: "PC", density: 1.2, speedFactor: 0.8 },
};

export type SpeedProfile = "standard" | "fast";

/** Parametry ruchu drukarki. Prędkości w mm/s, przepływy w mm³/s. */
export const PROFILES: Record<
  SpeedProfile,
  { name: string; hint: string; perimeter: number; infill: number; support: number; maxFlow: number; overhead: number; layerChange: number; startup: number }
> = {
  standard: {
    name: "Standardowa",
    hint: "Prusa MK3, Ender 3 i podobne",
    perimeter: 45,
    infill: 80,
    support: 50,
    maxFlow: 11,
    overhead: 1.35,
    layerChange: 3,
    startup: 240,
  },
  fast: {
    name: "Szybka",
    hint: "Bambu Lab, Prusa MK4/Core One, Voron",
    perimeter: 120,
    infill: 200,
    support: 150,
    maxFlow: 20,
    overhead: 1.55,
    layerChange: 1.5,
    startup: 180,
  },
};

export type SupportType = "none" | "normal" | "tree";

export type PrintSettings = {
  material: MaterialId;
  profile: SpeedProfile;
  layerHeight: number; // mm
  infill: number; // %
  walls: number; // liczba obrysów
  supports: SupportType;
  supportAngle: number; // próg nawisu w stopniach od poziomu (Orca/Bambu: „threshold angle”)
  nozzle: number; // mm
  filamentDiameter: number; // mm
  quantity: number;
};

export const DEFAULT_SETTINGS: PrintSettings = {
  material: "PLA",
  profile: "fast",
  layerHeight: 0.2,
  infill: 15,
  walls: 2,
  supports: "normal",
  supportAngle: 45,
  nozzle: 0.4,
  filamentDiameter: 1.75,
  quantity: 1,
};

export type Estimate = {
  triangles: number;
  size: [number, number, number]; // mm
  volume: number; // mm³ (bryła modelu)
  area: number; // mm²
  layers: number;
  /** Objętości faktycznie wytłoczonego materiału (mm³) na 1 sztukę. */
  shell: number;
  infill: number;
  support: number;
  /** Na 1 sztukę. */
  modelGrams: number;
  supportGrams: number;
  meters: number;
  seconds: number;
  overhangArea: number; // mm², rzut nawisów wymagających podpór
  /** 1 = trójkąt wymaga podpory (do podświetlenia w podglądzie). */
  overhang: Uint8Array;
  warnings: string[];
};

/** Gęstość wypełnienia podpór i mnożnik dla podpór drzewiastych. */
const SUPPORT_DENSITY = 0.15;
const SUPPORT_INTERFACE_LAYERS = 2;
const TREE_FACTOR = 0.6;
const MIN_LAYER_TIME = 6; // s – chłodzenie małych warstw

export function estimate(pos: Float32Array, s: PrintSettings): Estimate {
  const n = Math.floor(pos.length / 9);
  const warnings: string[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n * 9; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  if (n === 0 || !isFinite(minX)) throw new Error("Plik nie zawiera żadnych trójkątów.");
  const size: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];

  // Pole, objętość (twierdzenie o dywergencji) i składowa Z normalnej każdego trójkąta.
  const area = new Float32Array(n);
  const nz = new Float32Array(n);
  let volume = 0;
  let totalArea = 0;
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    // współrzędne względem rogu bryły – mniejsze błędy zaokrągleń
    const ax = pos[o] - minX, ay = pos[o + 1] - minY, az = pos[o + 2] - minZ;
    const bx = pos[o + 3] - minX, by = pos[o + 4] - minY, bz = pos[o + 5] - minZ;
    const cx = pos[o + 6] - minX, cy = pos[o + 7] - minY, cz = pos[o + 8] - minZ;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nzz);
    area[t] = len / 2;
    nz[t] = len > 0 ? nzz / len : 0;
    totalArea += len / 2;
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  // Odwrócone normalne (cała siatka „na lewą stronę”) → ujemna objętość.
  if (volume < 0) {
    volume = -volume;
    for (let t = 0; t < n; t++) nz[t] = -nz[t];
  }
  const boxVol = size[0] * size[1] * size[2];
  if (volume < boxVol * 1e-4) warnings.push("Siatka wygląda na otwartą lub niespójną – objętość może być niepoprawna.");
  if (Math.max(...size) < 2) warnings.push("Model ma poniżej 2 mm – sprawdź jednostki pliku (może być w metrach lub calach).");
  if (size[0] > 256 || size[1] > 256 || size[2] > 256) warnings.push("Model jest większy niż typowy stół 256 × 256 × 256 mm.");

  // Powłoki: obrysy na ścianach pionowych, warstwy górne/dolne na poziomych.
  const lineW = s.nozzle * 1.125;
  const wallT = s.walls * lineW;
  const topT = Math.max(0.7, 4 * s.layerHeight);
  let shell = 0;
  for (let t = 0; t < n; t++) {
    const h = Math.abs(nz[t]);
    shell += area[t] * (wallT * (1 - h) + topT * h);
  }
  shell = Math.min(shell, volume);
  const infill = (volume - shell) * (s.infill / 100);

  // Podpory.
  const overhang = new Uint8Array(n);
  let support = 0;
  let overhangArea = 0;
  if (s.supports !== "none") {
    const r = supportVolume(pos, n, nz, minX, minY, minZ, size, s, overhang);
    overhangArea = r.footprint;
    const body = r.volume * SUPPORT_DENSITY + r.footprint * SUPPORT_INTERFACE_LAYERS * s.layerHeight * 0.8;
    support = s.supports === "tree" ? body * TREE_FACTOR : body;
  } else {
    markOverhangs(nz, n, s.supportAngle, overhang, pos, minZ, s.layerHeight);
  }

  // Materiał.
  const mat = MATERIALS[s.material];
  const modelVol = shell + infill;
  const modelGrams = (modelVol / 1000) * mat.density;
  const supportGrams = (support / 1000) * mat.density;
  const filamentArea = Math.PI * (s.filamentDiameter / 2) ** 2;
  const meters = (modelVol + support) / filamentArea / 1000;

  // Czas: objętość / przepływ, z narzutem na przyspieszenia i jałowe przejazdy.
  const p = PROFILES[s.profile];
  const flow = (speed: number) => Math.min(speed * lineW * s.layerHeight, p.maxFlow) * mat.speedFactor;
  const layers = Math.max(1, Math.ceil(size[2] / s.layerHeight));
  let printTime = (shell / flow(p.perimeter) + infill / flow(p.infill) + support / flow(p.support)) * p.overhead;
  printTime += layers * p.layerChange;
  printTime = Math.max(printTime, layers * MIN_LAYER_TIME);
  const seconds = p.startup + printTime;

  return {
    triangles: n,
    size,
    volume,
    area: totalArea,
    layers,
    shell,
    infill,
    support,
    modelGrams,
    supportGrams,
    meters,
    seconds,
    overhangArea,
    overhang,
    warnings,
  };
}

function markOverhangs(nz: Float32Array, n: number, angle: number, out: Uint8Array, pos: Float32Array, minZ: number, lh: number) {
  const limit = -Math.cos((angle * Math.PI) / 180);
  for (let t = 0; t < n; t++) {
    if (nz[t] >= limit) continue;
    const o = t * 9;
    const zc = (pos[o + 2] + pos[o + 5] + pos[o + 8]) / 3 - minZ;
    if (zc > lh) out[t] = 1;
  }
}

/**
 * Objętość „słupów” podpór. Rzutujemy model na siatkę XY; w każdej komórce zapamiętujemy
 * wysokości powierzchni skierowanych do góry. Dla każdego punktu nawisu słup sięga do najbliższej
 * takiej powierzchni pod nim (podpora na modelu) albo do stołu.
 */
function supportVolume(
  pos: Float32Array,
  n: number,
  nz: Float32Array,
  minX: number,
  minY: number,
  minZ: number,
  size: [number, number, number],
  s: PrintSettings,
  overhang: Uint8Array,
) {
  const limit = -Math.cos((s.supportAngle * Math.PI) / 180);
  const diag = Math.hypot(size[0], size[1]);
  let cell = Math.min(3, Math.max(0.5, diag / 250));
  while ((size[0] / cell + 1) * (size[1] / cell + 1) > 1_500_000) cell *= 1.25;
  const gx = Math.ceil(size[0] / cell) + 1;
  const gy = Math.ceil(size[1] / cell) + 1;

  // Przesunięcie punktów próbkowania o nieokrągły ułamek komórki – w siatkach z CAD punkty
  // inaczej trafiają dokładnie w krawędzie wspólne dwóch trójkątów i liczą się podwójnie.
  const jx = 0.5 + 0.0137, jy = 0.5 + 0.0291;

  // Przechodzi po punktach próbkowania leżących w rzucie trójkąta i podaje wysokość z w tym punkcie.
  const raster = (t: number, visit: (c: number, z: number) => void) => {
    const o = t * 9;
    const ax = pos[o] - minX, ay = pos[o + 1] - minY, az = pos[o + 2] - minZ;
    const bx = pos[o + 3] - minX, by = pos[o + 4] - minY, bz = pos[o + 5] - minZ;
    const cx = pos[o + 6] - minX, cy = pos[o + 7] - minY, cz = pos[o + 8] - minZ;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) return;
    const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) / cell - jx));
    const i1 = Math.min(gx - 1, Math.floor(Math.max(ax, bx, cx) / cell - jx));
    const j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) / cell - jy));
    const j1 = Math.min(gy - 1, Math.floor(Math.max(ay, by, cy) / cell - jy));
    for (let j = j0; j <= j1; j++) {
      const py = (j + jy) * cell;
      for (let i = i0; i <= i1; i++) {
        const px = (i + jx) * cell;
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        visit(j * gx + i, l1 * az + l2 * bz + l3 * cz);
      }
    }
  };

  // Dwa przebiegi (zliczenie + wypełnienie) → płaska tablica wysokości powierzchni górnych.
  const count = new Uint32Array(gx * gy + 1);
  for (let t = 0; t < n; t++) if (nz[t] > 1e-3) raster(t, (c) => count[c + 1]++);
  for (let c = 1; c < count.length; c++) count[c] += count[c - 1];
  const tops = new Float32Array(count[count.length - 1]);
  const fill = count.slice(0, gx * gy);
  for (let t = 0; t < n; t++) if (nz[t] > 1e-3) raster(t, (c, z) => (tops[fill[c]++] = z));

  const gap = s.layerHeight; // odstęp Z podpory od modelu
  const cellArea = cell * cell;
  let volume = 0;
  let footprint = 0;
  for (let t = 0; t < n; t++) {
    if (nz[t] >= limit) continue;
    let used = false;
    raster(t, (c, z) => {
      if (z < s.layerHeight) return; // leży na stole
      let land = 0;
      for (let k = count[c]; k < count[c + 1]; k++) {
        const top = tops[k];
        if (top < z - gap * 0.5 && top > land) land = top;
      }
      const h = z - land - (land > 0 ? 2 * gap : gap);
      if (h < s.layerHeight) return;
      volume += cellArea * h;
      footprint += cellArea;
      used = true;
    });
    // Małe trójkąty mogą nie trafić w żaden środek komórki – i tak je zaznacz.
    if (used || area2d(pos, t) < cellArea) {
      const o = t * 9;
      if ((pos[o + 2] + pos[o + 5] + pos[o + 8]) / 3 - minZ > s.layerHeight) overhang[t] = 1;
    }
  }
  return { volume, footprint };
}

function area2d(pos: Float32Array, t: number) {
  const o = t * 9;
  return Math.abs((pos[o + 3] - pos[o]) * (pos[o + 7] - pos[o + 1]) - (pos[o + 6] - pos[o]) * (pos[o + 4] - pos[o + 1])) / 2;
}

/** Obrót siatki o 90° wokół osi X lub Y (zwraca nową tablicę). */
export function rotate90(pos: Float32Array, axis: "x" | "y", dir: 1 | -1 = 1): Float32Array {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (axis === "x") {
      out[i] = x;
      out[i + 1] = -dir * z;
      out[i + 2] = dir * y;
    } else {
      out[i] = dir * z;
      out[i + 1] = y;
      out[i + 2] = -dir * x;
    }
  }
  // Obrót zachowuje orientację trójkątów, więc normalne pozostają poprawne.
  return out;
}

export function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} d ${h % 24} h ${m % 60} min`;
  if (h > 0) return `${h} h ${m % 60} min`;
  return `${m} min`;
}
