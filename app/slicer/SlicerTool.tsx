"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  DEFAULT_SETTINGS,
  MATERIALS,
  PROFILES,
  estimate,
  formatDuration,
  rotate90,
  type Estimate,
  type MaterialId,
  type PrintSettings,
  type SpeedProfile,
  type SupportType,
} from "@/lib/slicer/estimate";
import { ACCEPT, loadModel } from "@/lib/slicer/load";

const Viewer = dynamic(() => import("./Viewer"), { ssr: false, loading: () => <div className="viewer" /> });

const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4 } as const;
type Unit = keyof typeof UNITS;
type Turn = "x+" | "x-" | "y+" | "y-";

const fmt = (v: number, d = 0) => v.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function SlicerTool() {
  const [file, setFile] = useState<{ name: string; positions: Float32Array } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [unit, setUnit] = useState<Unit>("mm");
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [showOverhangs, setShowOverhangs] = useState(true);
  const input = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  // Skala jednostek + obroty użytkownika.
  const positions = useMemo(() => {
    if (!file) return null;
    let p = file.positions;
    const k = UNITS[unit];
    if (k !== 1) p = p.map((v) => v * k);
    for (const t of turns) p = rotate90(p, t[0] as "x" | "y", t[1] === "+" ? 1 : -1);
    return p;
  }, [file, unit, turns]);

  useEffect(() => {
    if (!positions) return setResult(null);
    const id = setTimeout(() => {
      try {
        setResult(estimate(positions, settings));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się przeanalizować modelu.");
      }
    }, 60);
    return () => clearTimeout(id);
  }, [positions, settings]);

  const open = useCallback(async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setLoading(/\.(step|stp)$/i.test(f.name) ? "Wczytywanie STEP (pierwszy raz pobiera moduł CAD)…" : "Wczytywanie modelu…");
    try {
      const m = await loadModel(f);
      setFile(m);
      setTurns([]);
      setUnit("mm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wczytać pliku.");
    } finally {
      setLoading(null);
    }
  }, []);

  const q = settings.quantity;
  const totalGrams = result ? (result.modelGrams + result.supportGrams) * q : 0;

  return (
    <div className="two-col slicer">
      <div className="stack">
        <div
          className={`panel dropzone${drag ? " drag" : ""}${file ? " has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            open(e.dataTransfer.files[0]);
          }}
        >
          <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { open(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="panel-head">
            <span className="mono">{file ? file.name : "01 · Model"}</span>
            {file && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>
                Zmień plik
              </button>
            )}
          </div>
          {positions ? (
            <div className="viewer-wrap">
              <Viewer positions={positions} overhang={result?.overhang ?? null} showOverhangs={showOverhangs} />
              <div className="viewer-tools">
                <div className="tool-group" role="group" aria-label="Obrót modelu">
                  <span className="mono dim">Obróć</span>
                  {(["x+", "x-", "y+", "y-"] as Turn[]).map((t) => (
                    <button key={t} type="button" className="btn btn-sm" onClick={() => setTurns((v) => [...v, t])} title={`90° wokół osi ${t[0].toUpperCase()}`}>
                      {t[0].toUpperCase()} {t[1] === "+" ? "↻" : "↺"}
                    </button>
                  ))}
                  {turns.length > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTurns([])}>
                      Reset
                    </button>
                  )}
                </div>
                <label className="check">
                  <input type="checkbox" checked={showOverhangs} onChange={(e) => setShowOverhangs(e.target.checked)} />
                  <span>
                    Pokaż nawisy <i className="swatch" />
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <button type="button" className="drop-cta" onClick={() => input.current?.click()} disabled={!!loading}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                <path d="M20 26V8M13 15l7-7 7 7" />
                <path d="M6 26v6h28v-6" />
              </svg>
              <b>Przeciągnij plik tutaj lub kliknij, aby wybrać</b>
              <span className="mono dim">STL · 3MF · STEP — plik nie opuszcza Twojej przeglądarki</span>
            </button>
          )}
          {loading && (
            <div className="viewer-status mono">
              <span className="spinner" /> {loading}
            </div>
          )}
        </div>

        {error && <div className="alert" role="alert">{error}</div>}

        {result && (
          <>
            <div className="kpis slicer-kpis">
              <div className="kpi">
                <span className="mono dim">Czas druku{q > 1 ? ` · ${q} szt.` : ""}</span>
                <b>{formatDuration(result.seconds * q)}</b>
                {q > 1 && <span className="mono dim">{formatDuration(result.seconds)} / szt.</span>}
              </div>
              <div className="kpi">
                <span className="mono dim">Filament{q > 1 ? ` · ${q} szt.` : ""}</span>
                <b>{fmt(totalGrams, totalGrams < 10 ? 1 : 0)} g</b>
                <span className="mono dim">{fmt(result.meters * q, 2)} m · {MATERIALS[settings.material].name}</span>
              </div>
              <div className="kpi">
                <span className="mono dim">W tym podpory</span>
                <b>{settings.supports === "none" ? "—" : `${fmt(result.supportGrams * q, 1)} g`}</b>
                <span className="mono dim">
                  {settings.supports === "none"
                    ? result.overhang.some(Boolean) ? "wyłączone · model ma nawisy" : "wyłączone"
                    : result.supportGrams > 0 ? `${fmt(result.overhangArea / 100, 1)} cm² nawisów` : "niepotrzebne"}
                </span>
              </div>
            </div>

            <div className="specs">
              <div><span className="mono dim">Wymiary</span><div className="v">{result.size.map((v) => fmt(v, 1)).join(" × ")} mm</div></div>
              <div><span className="mono dim">Objętość bryły</span><div className="v">{fmt(result.volume / 1000, 1)} cm³</div></div>
              <div><span className="mono dim">Model / podpory</span><div className="v">{fmt(result.modelGrams, 1)} g / {fmt(result.supportGrams, 1)} g</div></div>
              <div><span className="mono dim">Warstwy</span><div className="v">{fmt(result.layers)} × {settings.layerHeight} mm</div></div>
              <div><span className="mono dim">Obrysy</span><div className="v">{fmt(result.shell / 1000, 1)} cm³</div></div>
              <div><span className="mono dim">Wypełnienie</span><div className="v">{fmt(result.infill / 1000, 1)} cm³</div></div>
              <div><span className="mono dim">Podpory</span><div className="v">{fmt(result.support / 1000, 1)} cm³</div></div>
              <div><span className="mono dim">Trójkąty</span><div className="v">{fmt(result.triangles)}</div></div>
            </div>

            {result.warnings.map((w) => (
              <div key={w} className="alert warn">{w}</div>
            ))}
            <p className="mono dim slicer-note">
              Szacunek bez slicowania — zwykle ±20–30% względem PrusaSlicera/OrcaSlicera. Dokładną wycenę poda drukarz.
            </p>
          </>
        )}
      </div>

      <aside className="panel sticky">
        <div className="panel-head"><span className="mono">02 · Ustawienia druku</span></div>
        <div className="panel-body form">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="material">Materiał</label>
              <select className="select" id="material" value={settings.material} onChange={(e) => set("material", e.target.value as MaterialId)}>
                {Object.entries(MATERIALS).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quantity">Ilość (szt.)</label>
              <input className="input" id="quantity" type="number" min={1} max={1000} value={q}
                onChange={(e) => set("quantity", Math.max(1, Math.min(1000, Math.round(+e.target.value) || 1)))} />
            </div>
            <div className="field">
              <label htmlFor="layerHeight">Warstwa (mm)</label>
              <select className="select" id="layerHeight" value={settings.layerHeight} onChange={(e) => set("layerHeight", +e.target.value)}>
                {[0.08, 0.12, 0.16, 0.2, 0.24, 0.28].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="walls">Obrysy</label>
              <select className="select" id="walls" value={settings.walls} onChange={(e) => set("walls", +e.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="infill">Wypełnienie: {settings.infill}%</label>
            <input id="infill" className="range" type="range" min={0} max={100} step={5} value={settings.infill} onChange={(e) => set("infill", +e.target.value)} />
          </div>

          <div className="field">
            <span className="label">Drukarka</span>
            <div className="seg">
              {(Object.keys(PROFILES) as SpeedProfile[]).map((p) => (
                <label key={p}>
                  <input type="radio" name="profile" checked={settings.profile === p} onChange={() => set("profile", p)} />
                  <b>{PROFILES[p].name}</b>
                  <span>{PROFILES[p].hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Podpory</span>
            <div className="seg three">
              {([["none", "Brak"], ["normal", "Zwykłe"], ["tree", "Drzewiaste"]] as [SupportType, string][]).map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="supports" checked={settings.supports === v} onChange={() => set("supports", v)} />
                  <b>{l}</b>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="supportAngle">Próg nawisu: {settings.supportAngle}°</label>
            <input id="supportAngle" className="range" type="range" min={20} max={70} step={5} value={settings.supportAngle} onChange={(e) => set("supportAngle", +e.target.value)} />
            <span className="hint">Powierzchnie nachylone mniej niż {settings.supportAngle}° od poziomu dostaną podpory.</span>
          </div>

          {file && (
            <div className="field">
              <label htmlFor="unit">Jednostki pliku</label>
              <select className="select" id="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                <option value="mm">milimetry</option>
                <option value="cm">centymetry</option>
                <option value="m">metry</option>
                <option value="in">cale</option>
              </select>
            </div>
          )}

          <Link href="/zapytania/nowe" className="btn btn-primary btn-lg">
            Zamów wydruk u drukarza
          </Link>
        </div>
      </aside>
    </div>
  );
}
