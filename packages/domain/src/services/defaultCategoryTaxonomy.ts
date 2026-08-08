import { Category } from "../entities/Category";

type TaxonomyGroup = readonly [macro: string, children: readonly string[]];

const expenseGroups: readonly TaxonomyGroup[] = [
  ["Casa e utenze", ["Affitto", "Luce", "Gas", "Internet casa", "Condominio", "Manutenzione casa"]],
  ["Alimentazione", ["Spesa alimentare"]],
  [
    "Trasporti e auto",
    [
      "Carburante",
      "Parcheggio",
      "Pedaggi",
      "Trasporto pubblico",
      "Assicurazione auto",
      "Bollo auto",
      "Lavaggio auto",
      "Manutenzione e riparazioni auto",
    ],
  ],
  [
    "Ristorazione e tempo libero",
    ["Bar e caffè", "Ristoranti", "Aperitivi", "Cinema", "Discoteca", "Intrattenimento"],
  ],
  ["Salute e cura personale", ["Farmacia", "Visite e cure", "Parrucchiere", "Cura personale"]],
  [
    "Abbonamenti e servizi digitali",
    ["Streaming", "Software e servizi digitali", "Intelligenza artificiale", "Produttività"],
  ],
  ["Formazione", ["Corsi", "Libri", "Lingue", "Piattaforme e-learning"]],
  ["Viaggi e vacanze", ["Alloggio", "Trasporti viaggio", "Attività e visite", "Vacanze"]],
  ["Acquisti personali", ["Shopping", "Regali", "Elettronica e accessori"]],
  ["Tasse e commissioni", ["TARI", "Commissioni bancarie", "Altre tasse"]],
  ["Imprevisti", ["Multe", "Emergenze", "Spese impreviste"]],
  [
    "Attività e progetti",
    ["Pubblicità", "Dominio e hosting", "Servizi web", "Software professionale", "Attrezzatura"],
  ],
];

const incomeGroups: readonly TaxonomyGroup[] = [
  ["Lavoro e redditi", ["Stipendio", "Straordinari", "Premi"]],
  [
    "Attività professionale",
    ["Servizi fotografici", "Servizi video", "Servizi digitali", "Consulenze", "Altri compensi"],
  ],
  ["Rimborsi", ["Rimborso spese", "Rimborso acquisti", "Rimborso fiscale"]],
  ["Rendite finanziarie", ["Interessi", "Dividendi", "Altri proventi finanziari"]],
  ["Vendite", ["Vendita beni", "Vendita servizi"]],
  ["Altre entrate", ["Regali ricevuti", "Entrate occasionali", "Altro"]],
];

/** Explicitly installed defaults; never auto-applied to an existing ledger. */
export function createDefaultFinancialTaxonomy(): readonly Category[] {
  return Object.freeze([
    ...createGroups("expense", expenseGroups),
    ...createGroups("income", incomeGroups),
  ]);
}

function createGroups(
  kindScope: "income" | "expense",
  groups: readonly TaxonomyGroup[],
): Category[] {
  return groups.flatMap(([macro, children], macroIndex) => {
    const macroId = `default-${kindScope}-macro-${macroIndex + 1}`;
    return [
      Category.create({ id: macroId, name: macro, kindScope }),
      ...children.map((name, childIndex) =>
        Category.create({
          id: `default-${kindScope}-macro-${macroIndex + 1}-child-${childIndex + 1}`,
          name,
          kindScope,
          parentId: macroId,
        }),
      ),
    ];
  });
}
