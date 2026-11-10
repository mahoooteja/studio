// Wczytywanie STL / 3MF / STEP w przeglądarce do „zupy trójkątów” (Float32Array, 9 liczb na trójkąt, mm).
import type { BufferGeometry, Object3D } from "three";

export const ACCEPT = ".stl,.3mf,.step,.stp";

export type LoadedModel = { name: string; positions: Float32Array };

export async function loadModel(file: File): Promise<LoadedModel> {
  const ext = file.name.toLowerCase().split(".").pop();
  const buffer = await file.arrayBuffer();
  let positions: Float32Array;
  if (ext === "stl") positions = await loadStl(buffer);
  else if (ext === "3mf") positions = await load3mf(buffer);
  else if (ext === "step" || ext === "stp") positions = await loadStep(buffer);
  else throw new Error("Nieobsługiwany format. Wybierz plik STL, 3MF lub STEP.");
  if (positions.length < 9) throw new Error("Plik nie zawiera żadnej siatki do druku.");
  return { name: file.name, positions };
}

async function loadStl(buffer: ArrayBuffer) {
  const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
  return soup(new STLLoader().parse(buffer));
}

async function load3mf(buffer: ArrayBuffer) {
  const { ThreeMFLoader } = await import("three/addons/loaders/3MFLoader.js");
  let group: Object3D;
  try {
    group = new ThreeMFLoader().parse(buffer);
  } catch {
    throw new Error("Nie udało się odczytać pliku 3MF.");
  }
  group.updateMatrixWorld(true);
  const parts: Float32Array[] = [];
  group.traverse((o) => {
    const mesh = o as Object3D & { isMesh?: boolean; geometry?: BufferGeometry };
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    parts.push(soup(g));
  });
  return concat(parts);
}

type OcctMesh = { attributes: { position: { array: number[] } }; index?: { array: number[] } };
type Occt = { ReadStepFile: (data: Uint8Array, params: unknown) => { success: boolean; meshes: OcctMesh[] } };
let occtPromise: Promise<Occt> | null = null;

/** OpenCascade (WASM, ~7,6 MB) ładowany dopiero przy pierwszym pliku STEP. Pliki kopiuje scripts/copy-occt.mjs. */
function occt(): Promise<Occt> {
  if (!occtPromise) {
    occtPromise = new Promise<Occt>((resolve, reject) => {
      const w = window as unknown as { occtimportjs?: (o: object) => Promise<Occt> };
      const init = () => w.occtimportjs!({ locateFile: (f: string) => `/occt/${f}` }).then(resolve, reject);
      if (w.occtimportjs) return init();
      const s = document.createElement("script");
      s.src = "/occt/occt-import-js.js";
      s.onload = init;
      s.onerror = () => reject(new Error("Nie udało się załadować modułu STEP."));
      document.head.appendChild(s);
    }).catch((e) => {
      occtPromise = null;
      throw e;
    });
  }
  return occtPromise;
}

async function loadStep(buffer: ArrayBuffer) {
  const lib = await occt();
  const res = lib.ReadStepFile(new Uint8Array(buffer), {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.001,
    angularDeflection: 0.25,
  });
  if (!res.success) throw new Error("Nie udało się odczytać pliku STEP.");
  const parts = res.meshes.map((m) => {
    const p = m.attributes.position.array;
    const idx = m.index?.array;
    if (!idx) return Float32Array.from(p);
    const out = new Float32Array(idx.length * 3);
    for (let i = 0; i < idx.length; i++) {
      out[i * 3] = p[idx[i] * 3];
      out[i * 3 + 1] = p[idx[i] * 3 + 1];
      out[i * 3 + 2] = p[idx[i] * 3 + 2];
    }
    return out;
  });
  return concat(parts);
}

function soup(g: BufferGeometry): Float32Array {
  const geo = g.index ? g.toNonIndexed() : g;
  const arr = geo.getAttribute("position").array as ArrayLike<number>;
  return arr instanceof Float32Array ? arr : Float32Array.from(arr);
}

function concat(parts: Float32Array[]) {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
