import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BudgetsPage } from "./BudgetsPage";

describe("BudgetsPage", () => {
  it("groups budget alert checkboxes with their labels", () => {
    render(
      <BudgetsPage
        budgets={[]}
        categories={[]}
        onCreate={async () => undefined}
        transactions={[]}
      />,
    );

    expect(screen.getByLabelText("Avvisa all’80%").parentElement).toHaveClass(
      "budget-alert-toggle",
    );
    expect(screen.getByLabelText("Avvisa al 100%").parentElement).toHaveClass(
      "budget-alert-toggle",
    );
  });
});
