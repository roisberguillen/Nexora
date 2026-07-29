import type { Tag } from "@nexora/domain";
import { useState, type FormEvent } from "react";

import type { TagInput } from "./tagCommands";

export function TagsPage({
  tags,
  onCreate,
  onDeleteUnused,
  onUpdate,
}: {
  readonly tags: readonly Tag[];
  readonly onCreate: (input: TagInput) => Promise<void>;
  readonly onDeleteUnused: (id: string) => Promise<void>;
  readonly onUpdate: (
    id: string,
    input: TagInput & { readonly isArchived: boolean },
  ) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tag | null>(null);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = { name: String(new FormData(event.currentTarget).get("name") ?? "") };
    try {
      setError(null);
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, { ...input, isArchived: editing.isArchived });
      setEditing(null);
      event.currentTarget.reset();
    } catch {
      setError("Impossibile salvare il tag.");
    }
  };
  const remove = async (id: string) => {
    try {
      setError(null);
      await onDeleteUnused(id);
      if (editing?.id === id) setEditing(null);
    } catch {
      setError("Il tag è usato: archivialo o rimuovilo prima dai movimenti.");
    }
  };

  return (
    <div id="tags">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Classificazione</p>
          <h1>Gestisci i tag</h1>
          <p>I tag permettono raggruppamenti trasversali senza sostituire le categorie.</p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section aria-labelledby="tags-title" className="data-panel account-management-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Archivio</p>
              <h2 id="tags-title">Tag</h2>
            </div>
            <span className="panel-meta">{tags.length}</span>
          </div>
          {tags.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessun tag creato</h3>
              <p>Crea un tag per iniziare a organizzare i movimenti.</p>
            </div>
          ) : (
            <div className="account-table-wrap">
              <table className="account-table">
                <caption className="sr-only">Tag registrati nel ledger</caption>
                <thead>
                  <tr>
                    <th scope="col">Tag</th>
                    <th scope="col">Stato</th>
                    <th scope="col">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr key={tag.id}>
                      <td data-label="Tag">
                        <strong>{tag.name}</strong>
                      </td>
                      <td data-label="Stato">{tag.isArchived ? "Archiviato" : "Attivo"}</td>
                      <td data-label="Azioni">
                        <button
                          className="text-action"
                          onClick={() => setEditing(tag)}
                          type="button"
                        >
                          Modifica
                        </button>
                        <button
                          className="text-action"
                          onClick={() => void remove(tag.id)}
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
          )}
        </section>
        <aside aria-labelledby="tag-form-title" className="account-editor-panel">
          <h2 id="tag-form-title">{editing === null ? "Nuovo tag" : "Modifica tag"}</h2>
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
            {editing === null ? null : (
              <button
                className="text-action"
                onClick={() =>
                  void onUpdate(editing.id, {
                    name: editing.name,
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
                Salva tag
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
