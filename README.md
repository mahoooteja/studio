# Warstwa — marketplace druku 3D

Zamawiający wysyłają zapytania do drukarzy. Drukarz może zapytanie **zaakceptować** (z wyceną i terminem), **odrzucić** (z powodem) albo kliknąć **„Poproś o pomoc”**. Wtedy powstaje drugie zapytanie do innego drukarza, który przejmuje część sztuk. Gdy pomocnik zaakceptuje, zlecenie główne jest przyjmowane automatycznie jako realizacja wspólna.

Stack: Next.js 15 (App Router, Server Actions), TypeScript, czysty CSS, Upstash Redis.

## Przepływ statusów

```
pending ──akceptuj──▶ accepted ──▶ printing ──▶ ready ──(odbiór)──▶ completed
   │  └─poproś o pomoc─▶ help_requested ──(pomocnik akceptuje)──▶ accepted
   └─odrzuć──▶ rejected ──(zamawiający: wyślij do innego)──▶ pending
```

## Lokalnie

```bash
npm install
npm run dev
```

Bez skonfigurowanego Redisa dane są trzymane w pamięci (z kontami demo). Hasło do kont demo: `demo1234`.

## Wdrożenie na Vercel

1. Vercel → **Add New → Project**, potem import tego repozytorium. Framework zostanie wykryty sam.
2. W projekcie: **Storage → Create → Upstash (Redis)**, potem *Connect to project*. Zmienne `KV_REST_API_URL` i `KV_REST_API_TOKEN` dodadzą się automatycznie.
3. **Settings → Environment Variables**: dodaj `SESSION_SECRET`, czyli losowy ciąg co najmniej 32 znaków (`openssl rand -hex 32`).
4. Redeploy. Każdy push na `main` wdraża się automatycznie.
