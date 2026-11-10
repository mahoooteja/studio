import type { Metadata } from "next";
import { listMakers, toPublic } from "@/lib/data";
import MakersBrowser from "./MakersBrowser";

export const metadata: Metadata = { title: "Drukarze" };
export const dynamic = "force-dynamic";

export default async function MakersPage() {
  const makers = (await listMakers()).map(toPublic);
  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <div className="crumbs mono">Sieć / Drukarze</div>
            <h1>Drukarze w sieci</h1>
            <p>Wybierz drukarza dopasowanego do materiału i terminu. Zapytanie jest bezpłatne i niezobowiązujące.</p>
          </div>
          <div className="mono dim">{makers.length} profili</div>
        </div>
        <MakersBrowser makers={makers} />
      </div>
    </div>
  );
}
