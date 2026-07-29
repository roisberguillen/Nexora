import type { Category, CategoryKindScope } from "@nexora/domain";
import { useState, type FormEvent } from "react";

import type { CategoryInput } from "./categoryCommands";

export function CategoriesPage({
  categories,
  onCreate,
  onDeleteUnused,
  onUpdate,
}: {
  readonly categories: readonly Category[];
  readonly onCreate: (input: CategoryInput) => Promise<void>;
  readonly onDeleteUnused: (id: string) => Promise<void>;
  readonly onUpdate: (
    id: string,
    input: CategoryInput & { readonly isArchived: boolean },
  ) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name") ?? ""),
      kindScope: String(form.get("kindScope") ?? "expense") as CategoryKindScope,
    };
    try {
      setError(null);
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, { ...input, isArchived: editing.isArchived });
      setEditing(null);
      event.currentTarget.reset();
    } catch {
      setError("Impossibile salvare la categoria.");
    }
  };
  const remove = async (id: string) => {
    try {
      setError(null);
      await onDeleteUnused(id);
      if (editing?.id === id) setEditing(null);
    } catch {
      setError("La categoria è usata: archiviala o riassegna prima i riferimenti.");
    }
  };
  return (
    <div id="categories">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Classificazione</p>
          <h1>Gestisci le categorie</h1>
          <p>
            Le categorie archiviate restano nello storico e non sono più proposte nei nuovi
            movimenti.
          </p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section className="data-panel account-management-panel" aria-labelledby="categories-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Archivio</p>
              <h2 id="categories-title">Categorie</h2>
            </div>
            <span className="panel-meta">{categories.length}</span>
          </div>
          <div className="account-table-wrap">
            <table className="account-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Ambito</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td data-label="Categoria">
                      <strong>{category.name}</strong>
                    </td>
                    <td data-label="Ambito">{scopeLabel(category.kindScope)}</td>
                    <td data-label="Stato">{category.isArchived ? "Archiviata" : "Attiva"}</td>
                    <td data-label="Azioni">
                      <button
                        className="text-action"
                        onClick={() => setEditing(category)}
                        type="button"
                      >
                        Modifica
                      </button>
                      <button
                        className="text-action"
                        onClick={() => void remove(category.id)}
                        type="button"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="account-editor-panel">
          <h2>{editing === null ? "Nuova categoria" : "Modifica categoria"}</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form className="account-form" onSubmit={save}>
            <label>
              Nome
              <input
                defaultValue={editing?.name ?? ""}
                key={editing?.id ?? "new"}
                name="name"
                required
              />
            </label>
            <label>
              Ambito
              <select
                defaultValue={editing?.kindScope ?? "expense"}
                disabled={editing !== null}
                name="kindScope"
              >
                <option value="expense">Spese</option>
                <option value="income">Entrate</option>
                <option value="both">Entrate e spese</option>
              </select>
            </label>
            {editing === null ? null : (
              <button
                className="text-action"
                onClick={() =>
                  void onUpdate(editing.id, {
                    name: editing.name,
                    kindScope: editing.kindScope,
                    isArchived: !editing.isArchived,
                  })
                }
                type="button"
              >
                {editing.isArchived ? "Riattiva" : "Archivia"}
              </button>
            )}
            <div className="form-actions">
              <button className="secondary-action" onClick={() => setEditing(null)} type="button">
                Annulla
              </button>
              <button className="primary-action" type="submit">
                Salva categoria
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function scopeLabel(scope: CategoryKindScope): string {
  return scope === "income" ? "Entrate" : scope === "expense" ? "Spese" : "Entrate e spese";
}
