import { Category } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
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
    expect(
      screen.getByRole("tree").querySelector('[role="treeitem"][aria-level="2"]'),
    ).toHaveAttribute("aria-level", "2");
    await user.click(screen.getByRole("button", { name: "Aggiungi sottocategoria" }));
    expect(screen.getByLabelText("Macro categoria")).toHaveValue(macro.id);
  });
});
