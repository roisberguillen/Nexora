import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecurringPage } from "./RecurringPage";

describe("RecurringPage", () => {
  it("aligns the enabled toggle with its label", () => {
    render(
      <RecurringPage
        accounts={[]}
        allocationPlans={[]}
        categories={[]}
        onCreate={async () => undefined}
        onCreateAllocation={async () => undefined}
        onExecuteAllocations={async () => undefined}
        onUpdate={async () => undefined}
        rules={[]}
      />,
    );

    expect(screen.getByLabelText("Attiva").parentElement).toHaveClass("form-toggle");
  });
});
