import { Category } from "@nexora/domain";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoriesPage } from "./CategoriesPage";

describe("CategoriesPage", () => {
  it("renders an accessible macro/subcategory tree and opens the child creation path", async () => {
    const user = userEvent.setup();
    const macro = Category.create({ id: "macro", name: "Trasporti", kindScope: "expense" });
    const child = Category.create({
      id: "child",
      name: "Carburante",
      kindScope: "expense",
      parentId: macro.id,
    });
    render(
      <CategoriesPage
        categories={[macro, child]}
        onCreate={vi.fn(async () => undefined)}
        onDeleteUnused={vi.fn(async () => undefined)}
        onInstallDefaults={vi.fn(async () => undefined)}
        onMerge={vi.fn(async () => undefined)}
        onUpdate={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("tree", { name: "Categorie finanziarie" })).toBeVisible();
    expect(screen.getByRole("treeitem", { name: /Trasporti/ })).toHaveAttribute("aria-level", "1");
    expect(screen.getByText("Carburante")).toBeVisible();
    const macroItem = screen.getByRole("treeitem", { name: /Trasporti/ });
    const macroActions = macroItem.querySelector(".category-tree-root > .category-tree-actions");
    expect(macroActions).not.toBeNull();
    expect(
      within(macroActions as HTMLElement).getByRole("button", { name: "Modifica" }),
    ).toBeDisabled();
    expect(
      within(macroActions as HTMLElement).getByRole("button", { name: "Archivia" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("tree").querySelector('[role="treeitem"][aria-level="2"]'),
    ).toHaveAttribute("aria-level", "2");
    await user.click(screen.getByRole("button", { name: "Aggiungi sottocategoria" }));
    expect(screen.getByLabelText("Macro categoria")).toHaveValue(macro.id);
  });

  it("blocks a second category submit while persistence is pending", async () => {
    const user = userEvent.setup();
    let resolveCreate!: () => void;
    const onCreate = vi.fn(() => new Promise<void>((resolve) => (resolveCreate = resolve)));
    render(
      <CategoriesPage
        categories={[]}
        onCreate={onCreate}
        onDeleteUnused={async () => undefined}
        onInstallDefaults={async () => undefined}
        onMerge={async () => undefined}
        onUpdate={async () => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Nome"), "Casa");
    const submit = screen.getByRole("button", { name: "Salva categoria" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    expect(submit.closest("form")).toHaveAttribute("aria-busy", "true");
    await user.click(submit);
    expect(onCreate).toHaveBeenCalledTimes(1);
    resolveCreate();
  });
});
