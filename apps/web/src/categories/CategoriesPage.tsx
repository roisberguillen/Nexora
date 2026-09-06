import { categoryLabel, type Category, type CategoryKindScope } from "@nexora/domain";
import { useMemo, useState, type FormEvent } from "react";

import type { CategoryInput } from "./categoryCommands";

export function CategoriesPage({
  categories,
  onCreate,
  onDeleteUnused,
  onInstallDefaults,
  onMerge,
  onUpdate,
}: {
  readonly categories: readonly Category[];
  readonly onCreate: (input: CategoryInput) => Promise<void>;
  readonly onDeleteUnused: (id: string) => Promise<void>;
  readonly onInstallDefaults: () => Promise<void>;
  readonly onMerge: (sourceId: string, targetId: string) => Promise<void>;
  readonly onUpdate: (
    id: string,
    input: CategoryInput & { readonly isArchived: boolean },
  ) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [parentId, setParentId] = useState("");
  const [kindScope, setKindScope] = useState<CategoryKindScope>("expense");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        categories
          .filter((category) => category.parentId === undefined)
          .map((category) => category.id),
      ),
  );
  const roots = useMemo(
    () => categories.filter((category) => category.parentId === undefined),
    [categories],
  );
  const isFreshLedger = categories.every(isSystemCategory);
  const editingHasChildren =
    editing !== null && categories.some((category) => category.parentId === editing.id);
  const openEditor = (category: Category | null, childOf?: string) => {
    setEditing(category);
    setParentId(category?.parentId ?? childOf ?? "");
    setKindScope(category?.kindScope ?? "expense");
    setMergeTargetId("");
    setError(null);
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name") ?? ""),
      kindScope,
      ...(parentId === "" ? {} : { parentId }),
    };
    setIsSaving(true);
    try {
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, { ...input, isArchived: editing.isArchived });
      openEditor(null);
    } catch {
      setError("Impossibile salvare: verifica macro categoria, ambito e stato.");
    } finally {
      setIsSaving(false);
    }
  };
  const archive = async (category: Category) => {
    try {
      await onUpdate(category.id, {
        name: category.name,
        kindScope: category.kindScope,
        ...(category.parentId === undefined ? {} : { parentId: category.parentId }),
        isArchived: !category.isArchived,
      });
      openEditor(null);
    } catch {
      setError(
        "La macro con sottocategorie non può essere archiviata. Sposta o archivia prima le sottocategorie.",
      );
    }
  };
  const remove = async (id: string) => {
    try {
      await onDeleteUnused(id);
      if (editing?.id === id) openEditor(null);
    } catch {
      setError(
        "La categoria è usata o contiene sottocategorie: archiviala o riassegna prima i riferimenti.",
      );
    }
  };
  const merge = async () => {
    if (editing === null || mergeTargetId === "") return;
    try {
      await onMerge(editing.id, mergeTargetId);
      openEditor(null);
    } catch {
      setError("L’unione richiede una categoria attiva, compatibile e allo stesso livello.");
    }
  };
  const installDefaults = async () => {
    try {
      await onInstallDefaults();
    } catch {
      setError(
        "La tassonomia predefinita può essere aggiunta solo a un archivio senza categorie personali.",
      );
    }
  };
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div id="categories">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Classificazione</p>
          <h1>Gestisci le categorie</h1>
          <p>
            Organizza Macro categoria → Sottocategoria. Le categorie archiviate restano nello
            storico.
          </p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section className="data-panel account-management-panel" aria-labelledby="categories-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Archivio</p>
              <h2 id="categories-title">Albero categorie</h2>
            </div>
            <span className="panel-meta">{categories.length}</span>
          </div>
          {isFreshLedger ? (
            <div className="empty-state">
              <p>
                Puoi aggiungere la tassonomia iniziale di entrate e uscite senza modificare i dati
                esistenti.
              </p>
              <button
                className="secondary-action"
                onClick={() => void installDefaults()}
                type="button"
              >
                Aggiungi tassonomia predefinita
              </button>
            </div>
          ) : null}
          <div className="category-tree" role="tree" aria-label="Categorie finanziarie">
            {roots.map((root, rootIndex) => {
              const children = categories.filter((category) => category.parentId === root.id);
              const isOpen = expanded.has(root.id);
              return (
                <div
                  className="category-tree-group"
                  key={root.id}
                  role="treeitem"
                  aria-level={1}
                  aria-posinset={rootIndex + 1}
                  aria-setsize={roots.length}
                  aria-expanded={children.length === 0 ? undefined : isOpen}
                >
                  <div className="category-tree-root">
                    <button
                      aria-label={`${isOpen ? "Chiudi" : "Apri"} ${root.name}`}
                      className="text-action"
                      disabled={children.length === 0}
                      onClick={() => toggle(root.id)}
                      type="button"
                    >
                      {children.length === 0 ? "•" : isOpen ? "−" : "+"}
                    </button>
                    <div>
                      <strong>{root.name}</strong>
                      <small>
                        {scopeLabel(root.kindScope)} · {children.length} sottocategorie ·{" "}
                        {root.isArchived ? "Archiviata" : "Attiva"}
                      </small>
                    </div>
                    <CategoryActions
                      category={root}
                      hasChildren={children.length > 0}
                      onArchive={archive}
                      onEdit={openEditor}
                      onRemove={remove}
                    />
                    {!root.isArchived && !isSystemCategory(root.id) ? (
                      <button
                        className="text-action"
                        onClick={() => openEditor(null, root.id)}
                        type="button"
                      >
                        Aggiungi sottocategoria
                      </button>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <ul className="category-tree-children" role="group">
                      {children.map((child, childIndex) => (
                        <li
                          aria-level={2}
                          aria-posinset={childIndex + 1}
                          aria-setsize={children.length}
                          key={child.id}
                          role="treeitem"
                        >
                          <div>
                            <strong>{child.name}</strong>
                            <small>
                              {scopeLabel(child.kindScope)} ·{" "}
                              {child.isArchived ? "Archiviata" : "Attiva"}
                            </small>
                          </div>
                          <CategoryActions
                            category={child}
                            onArchive={archive}
                            onEdit={openEditor}
                            onRemove={remove}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="account-editor-panel">
          <h2>{editing === null ? "Nuova categoria" : "Modifica categoria"}</h2>
          <p className="import-help">
            Scegli nessuna macro per creare una Macro categoria; scegli una macro attiva per creare
            o spostare una Sottocategoria.
          </p>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form aria-busy={isSaving} className="account-form" onSubmit={save}>
            <label>
              Nome
              <input
                defaultValue={editing?.name ?? ""}
                key={editing?.id ?? `new-${parentId}`}
                name="name"
                required
              />
            </label>
            <label>
              Ambito
              <select
                onChange={(event) => setKindScope(event.currentTarget.value as CategoryKindScope)}
                name="kindScope"
                value={kindScope}
              >
                <option value="expense">Spese</option>
                <option value="income">Entrate</option>
                <option value="both">Entrate e spese</option>
              </select>
            </label>
            <label>
              Macro categoria
              <select onChange={(event) => setParentId(event.currentTarget.value)} value={parentId}>
                <option value="">Nessuna (Macro categoria)</option>
                {roots
                  .filter(
                    (root) =>
                      !root.isArchived && !isSystemCategory(root.id) && root.id !== editing?.id,
                  )
                  .filter((root) => root.kindScope === "both" || root.kindScope === kindScope)
                  .map((root) => (
                    <option key={root.id} value={root.id}>
                      {root.name} · {scopeLabel(root.kindScope)}
                    </option>
                  ))}
              </select>
            </label>
            {editing === null || isSystemCategory(editing.id) ? null : (
              <>
                <button
                  className="text-action"
                  disabled={editingHasChildren}
                  onClick={() => void archive(editing)}
                  type="button"
                >
                  {editing.isArchived ? "Riattiva" : "Archivia"}
                </button>
                {editingHasChildren ? null : (
                  <>
                    <label>
                      Unisci in
                      <select
                        onChange={(event) => setMergeTargetId(event.currentTarget.value)}
                        value={mergeTargetId}
                      >
                        <option value="">Scegli categoria</option>
                        {categories
                          .filter(
                            (category) =>
                              category.id !== editing.id &&
                              !category.isArchived &&
                              category.parentId === editing.parentId &&
                              (category.kindScope === "both" ||
                                category.kindScope === editing.kindScope),
                          )
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryLabel(category, categories)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="text-action"
                      disabled={mergeTargetId === ""}
                      onClick={() => void merge()}
                      type="button"
                    >
                      Unisci e riassegna
                    </button>
                  </>
                )}
              </>
            )}
            <div className="form-actions">
              <button className="secondary-action" onClick={() => openEditor(null)} type="button">
                Annulla
              </button>
              <button className="primary-action" disabled={isSaving} type="submit">
                Salva categoria
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function CategoryActions({
  category,
  hasChildren = false,
  onArchive,
  onEdit,
  onRemove,
}: {
  readonly category: Category;
  readonly hasChildren?: boolean;
  readonly onArchive: (category: Category) => Promise<void>;
  readonly onEdit: (category: Category) => void;
  readonly onRemove: (id: string) => Promise<void>;
}) {
  const protectedCategory = isSystemCategory(category.id);
  return (
    <div className="category-tree-actions">
      <button
        className="text-action"
        disabled={protectedCategory || hasChildren}
        onClick={() => onEdit(category)}
        type="button"
      >
        Modifica
      </button>
      <button
        className="text-action"
        disabled={protectedCategory || hasChildren}
        onClick={() => void onArchive(category)}
        type="button"
      >
        {category.isArchived ? "Riattiva" : "Archivia"}
      </button>
      <button
        className="text-action"
        disabled={protectedCategory}
        onClick={() => void onRemove(category.id)}
        type="button"
      >
        Elimina
      </button>
    </div>
  );
}

function scopeLabel(scope: CategoryKindScope): string {
  return scope === "income" ? "Entrate" : scope === "expense" ? "Spese" : "Entrate e spese";
}
function isSystemCategory(category: Pick<Category, "id"> | string): boolean {
  const id = typeof category === "string" ? category : category.id;
  return id === "system-income" || id === "system-expense";
}
