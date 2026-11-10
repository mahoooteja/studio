import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listMakers, toPublic } from "@/lib/data";
import NewRequestForm from "./NewRequestForm";

export const metadata: Metadata = { title: "Nowe zapytanie" };
export const dynamic = "force-dynamic";

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ drukarz?: string }> }) {
  const { drukarz } = await searchParams;
  const me = await currentUser();
  if (!me) redirect(`/logowanie?next=${encodeURIComponent(`/zapytania/nowe${drukarz ? `?drukarz=${drukarz}` : ""}`)}`);
  const makers = (await listMakers()).filter((m) => m.id !== me.id).map(toPublic);

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <div className="crumbs mono">
              <Link href="/drukarze">Drukarze</Link> / <span>Nowe zapytanie</span>
            </div>
            <h1>Nowe zapytanie o druk</h1>
            <p>Im dokładniejsza specyfikacja, tym szybsza i trafniejsza wycena.</p>
          </div>
        </div>
        <NewRequestForm makers={makers} initialMaker={makers.some((m) => m.id === drukarz) ? drukarz! : makers[0]?.id} />
      </div>
    </div>
  );
}
