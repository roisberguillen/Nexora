import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SyncConflictBanner } from "./SyncConflictBanner";

describe("SyncConflictBanner", () => {
  it("keeps conflicts visible and requires explicit review", async () => {
    const onReview = vi.fn();
    render(
      <SyncConflictBanner
        conflicts={[{ id: "c-1", entityLabel: "Movimento", detail: "revisione locale 2" }]}
        onReview={onReview}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("non sono state sovrascritte");
    await screen.getByRole("button", { name: "Esamina" }).click();
    expect(onReview).toHaveBeenCalledWith("c-1");
  });

  it("renders nothing when there are no conflicts", () => {
    const { container } = render(<SyncConflictBanner conflicts={[]} onReview={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
