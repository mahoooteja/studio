// Kopiuje moduł OpenCascade (import STEP) do public/occt, skąd ładuje go przeglądarka.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = dirname(require.resolve("occt-import-js"));
const dest = join(process.cwd(), "public", "occt");
mkdirSync(dest, { recursive: true });
for (const f of ["occt-import-js.js", "occt-import-js.wasm"]) copyFileSync(join(src, f), join(dest, f));
console.log("occt-import-js → public/occt");
