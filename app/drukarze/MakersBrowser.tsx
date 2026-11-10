"use client";
import { useMemo, useState } from "react";
import { MakerCard, Empty } from "@/components/ui";
import type { PublicUser } from "@/lib/types";

const FILTERS = ["PLA", "PETG", "ABS", "ASA", "TPU 95A", "PA-CF", "PC", "Żywica"];

export default function MakersBrowser({ makers }: { makers: PublicUser[] }) {
  const [mat, setMat] = useState<string | null>(null);
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return makers.filter((u) => {
      const m = u.maker!;
      if (onlyAvail && !m.available) return false;
      if (mat && !m.materials.some((x) => x.startsWith(mat))) return false;
      if (qq && ![u.name, u.city, m.headline, ...m.printers].join(" ").toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [makers, mat, onlyAvail, q]);

  return (
    <>
      <div className="filters">
        <button className="filter" aria-pressed={mat === null} onClick={() => setMat(null)}>
          Wszystkie
        </button>
        {FILTERS.map((f) => (
          <button key={f} className="filter" aria-pressed={mat === f} onClick={() => setMat(mat === f ? null : f)}>
            {f}
          </button>
        ))}
        <button className="filter" aria-pressed={onlyAvail} onClick={() => setOnlyAvail(!onlyAvail)}>
          Tylko dostępni
        </button>
        <input
          className="input search"
          placeholder="Szukaj: miasto, drukarka…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Szukaj drukarzy"
        />
      </div>
      {list.length ? (
        <div className="makers-grid" key={`${mat}-${onlyAvail}`} style={{ animation: "rowIn .5s var(--ease)" }}>
          {list.map((u) => (
            <MakerCard key={u.id} u={u} />
          ))}
        </div>
      ) : (
        <Empty title="Brak wyników" text="Zmień filtry albo wyczyść wyszukiwanie." />
      )}
    </>
  );
}
