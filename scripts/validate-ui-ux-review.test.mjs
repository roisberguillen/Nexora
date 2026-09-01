import assert from "node:assert/strict";
import test from "node:test";

import { requiresReview, validateReviewContent } from "./validate-ui-ux-review.mjs";

const validReview = `# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-08-22
Schermata: Dashboard dei conti
Route: /dashboard
Flusso principale: Consultazione saldo e movimenti
Reviewer/fase: Codex — quality system
Modifiche: Verifica del sistema di qualità UI.

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Gerarchia e feedback verificati. |
| Mobile | M-01 | PASS | Viewport e touch verificati. |
| Desktop | D-01 | PASS | Griglia e tastiera verificate. |
| Tablet | T-01 | PASS | Orientamenti verificati. |
| Visuale | V-01 | PASS | Stati e contrasto verificati. |
| Ricerca | R-01 | N/A | La schermata non offre ricerca. |
| Form | F-01 | N/A | La schermata non contiene form. |
| Feedback | FB-01 | PASS | Errori e loading verificati. |
| Accessibilità | A-01 | PASS | Focus e semantica verificati. |
| Finanza | FN-01 | PASS | Saldi e locale verificati. |
| Performance | P-01 | PASS | Rendering e offline verificati. |

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS
`;

test("accetta una review completa", () => {
  assert.deepEqual(validateReviewContent(validReview), []);
});

test("rileva campi e verifiche mancanti", () => {
  const invalidReview = validReview
    .replace("Route: /dashboard\n", "")
    .replace("| Mobile | M-01 | PASS | Viewport e touch verificati. |\n", "");
  assert.match(validateReviewContent(invalidReview).join("\n"), /Route/);
  assert.match(validateReviewContent(invalidReview).join("\n"), /Mobile/);
});

test("rileva P0 aperti", () => {
  const invalidReview = validReview.replace(
    "P0 aperti: Nessuno",
    "P0 aperti: Contrasto insufficiente",
  );
  assert.match(validateReviewContent(invalidReview).join("\n"), /P0 aperti/);
});

test("richiede una review per ogni modifica nello stage", () => {
  assert.equal(requiresReview(["apps/web/src/routes/dashboard.tsx"]), true);
  assert.equal(requiresReview(["docs/ux/guide.md"]), true);
  assert.equal(requiresReview([]), false);
});
