"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser, endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import * as D from "@/lib/data";
import { MATERIALS } from "@/lib/types";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const num = (f: FormData, k: string) => {
  const v = Number(String(f.get(k) ?? "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

async function requireUser(next = "/panel") {
  const u = await currentUser();
  if (!u) redirect(`/logowanie?next=${encodeURIComponent(next)}`);
  return u;
}

function fail(e: unknown): FormState {
  if (e instanceof D.DomainError) return { error: e.message };
  if (e && typeof e === "object" && "digest" in e) throw e; // redirect / notFound
  console.error(e);
  return { error: "Coś poszło nie tak. Spróbuj ponownie." };
}

/* ───────── auth ───────── */

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email");
  const pw = String(f.get("password") ?? "");
  const next = str(f, "next") || "/panel";
  const u = await D.getUserByEmail(email);
  if (!u || !verifyPassword(pw, u.passHash)) return { error: "Nieprawidłowy e-mail lub hasło." };
  await startSession(u.id);
  redirect(next.startsWith("/") ? next : "/panel");
}

export async function demoLoginAction(f: FormData) {
  const id = str(f, "id");
  const u = await D.getUser(id);
  if (!u) return;
  await startSession(u.id);
  redirect("/panel");
}

export async function registerAction(_: FormState, f: FormData): Promise<FormState> {
  const name = str(f, "name", 60);
  const email = str(f, "email", 120).toLowerCase();
  const pw = String(f.get("password") ?? "");
  const city = str(f, "city", 60);
  const role = str(f, "role") === "maker" ? "maker" : "client";
  if (name.length < 2) return { error: "Podaj imię i nazwisko." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Podaj poprawny adres e-mail." };
  if (pw.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków." };
  try {
    const u = await D.createUser({ name, email, passHash: hashPassword(pw), role, city: city || "Polska" });
    await startSession(u.id);
  } catch (e) {
    return fail(e);
  }
  redirect(role === "maker" ? "/profil?nowy=1" : "/drukarze");
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

/* ───────── profil drukarza ───────── */

export async function saveProfileAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser("/profil");
  u.name = str(f, "name", 60) || u.name;
  u.city = str(f, "city", 60);
  u.bio = str(f, "bio", 600);
  const becomeMaker = f.get("isMaker") === "on";
  if (becomeMaker) {
    const prev = u.maker;
    u.role = "maker";
    u.maker = {
      headline: str(f, "headline", 80) || "Drukarz w sieci Warstwa",
      printers: str(f, "printers", 400).split(/\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 8),
      materials: f.getAll("materials").map(String).filter((m) => (MATERIALS as readonly string[]).includes(m)),
      buildVolume: str(f, "buildVolume", 40),
      hourlyRate: num(f, "hourlyRate") ?? 15,
      leadDays: Math.round(num(f, "leadDays") ?? 3),
      available: f.get("available") === "on",
      rating: prev?.rating ?? 0,
      jobsDone: prev?.jobsDone ?? 0,
    };
  } else {
    u.role = "client";
  }
  await D.saveUser(u);
  revalidatePath("/", "layout");
  return { ok: "Zapisano profil." };
}

/* ───────── zapytania ───────── */

export async function createRequestAction(_: FormState, f: FormData): Promise<FormState> {
  const makerId = str(f, "makerId");
  const u = await requireUser(`/zapytania/nowe?drukarz=${makerId}`);
  const title = str(f, "title", 120);
  const description = str(f, "description", 3000);
  const material = str(f, "material", 40);
  if (title.length < 4) return { error: "Nadaj zleceniu krótki tytuł (min. 4 znaki)." };
  if (description.length < 10) return { error: "Opisz, czego potrzebujesz (min. 10 znaków)." };
  if (!material) return { error: "Wybierz materiał." };
  const fileUrl = str(f, "fileUrl", 500);
  if (fileUrl && !/^https?:\/\//.test(fileUrl)) return { error: "Link do pliku musi zaczynać się od http(s)://" };
  let id: string;
  try {
    const r = await D.createRequest(u, {
      title,
      description,
      makerId,
      material,
      color: str(f, "color", 40) || "Dowolny",
      quantity: Math.round(num(f, "quantity") ?? 1),
      dims: str(f, "dims", 60) || "—",
      infill: Math.min(100, Math.round(num(f, "infill") ?? 20)),
      layerHeight: num(f, "layerHeight") ?? 0.2,
      deadline: str(f, "deadline", 10) || undefined,
      budget: num(f, "budget"),
      fileUrl: fileUrl || undefined,
    });
    id = r.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/panel");
  redirect(`/zapytania/${id}?wyslano=1`);
}

async function run(id: string, fn: () => Promise<unknown>): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/zapytania/${id}`);
  revalidatePath("/panel");
  return { ok: "ok" };
}

export async function decideAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const u = await requireUser(`/zapytania/${id}`);
  const decision = str(f, "decision");
  const note = str(f, "note", 1000);
  if (decision === "accept")
    return run(id, () => D.acceptRequest(id, u, num(f, "quote"), str(f, "eta", 10) || undefined, note));
  if (decision === "reject") return run(id, () => D.rejectRequest(id, u, note));
  if (decision === "help") {
    const helperId = str(f, "helperId");
    if (!helperId) return { error: "Wybierz drukarza, którego poprosisz o pomoc." };
    return run(id, () => D.askForHelp(id, u, helperId, Math.round(num(f, "quantity") ?? 0), note));
  }
  return { error: "Nieznana akcja." };
}

export async function advanceAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const u = await requireUser(`/zapytania/${id}`);
  return run(id, () => D.advanceRequest(id, u, str(f, "note", 1000)));
}

export async function completeAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const u = await requireUser(`/zapytania/${id}`);
  return run(id, () => D.completeRequest(id, u));
}

export async function cancelAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const u = await requireUser(`/zapytania/${id}`);
  return run(id, () => D.cancelRequest(id, u));
}

export async function reassignAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const u = await requireUser(`/zapytania/${id}`);
  return run(id, () => D.reassignRequest(id, u, str(f, "makerId")));
}

export async function commentAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const u = await requireUser(`/zapytania/${id}`);
  return run(id, () => D.addComment(id, u, str(f, "text", 2000)));
}
