import type { Metadata } from "next";
import SlicerTool from "./SlicerTool";

export const metadata: Metadata = {
  title: "Slicer — kalkulator druku",
  description: "Wgraj plik STL, 3MF lub STEP i sprawdź szacowany czas druku, zużycie filamentu i podpory.",
};

export default function SlicerPage() {
  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <div className="crumbs mono">Narzędzia / <span>Slicer</span></div>
            <h1>Kalkulator druku</h1>
            <p>Wgraj model, a od razu zobaczysz szacowany czas druku, ilość filamentu i podpory.</p>
          </div>
        </div>
        <SlicerTool />
      </div>
    </div>
  );
}
