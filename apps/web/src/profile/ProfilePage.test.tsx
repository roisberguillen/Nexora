import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ProfilePage } from "./ProfilePage";
import { PROFILE_STORAGE_KEY } from "./profileStorage";

describe("ProfilePage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows only the supported local profile contract", () => {
    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Dati del profilo" })).toBeInTheDocument();
    expect(screen.getByText("Nessun dato personale è ancora salvato.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("saves a trimmed display name and cancels without partial persistence", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(screen.getByRole("button", { name: "Modifica profilo" }));
    await user.type(screen.getByLabelText("Nome visualizzato"), "  Ada   Lovelace  ");
    await user.click(screen.getByRole("button", { name: "Salva profilo" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ada Lovelace");
    expect(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? "{}")).toEqual({
      displayName: "Ada Lovelace",
    });

    await user.click(screen.getByRole("button", { name: "Modifica profilo" }));
    await user.clear(screen.getByLabelText("Nome visualizzato"));
    await user.type(screen.getByLabelText("Nome visualizzato"), "Nome annullato");
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ada Lovelace");
    expect(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? "{}")).toEqual({
      displayName: "Ada Lovelace",
    });
  });

  it("rejects empty names without changing the saved profile", async () => {
    const user = userEvent.setup();
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ displayName: "Ada" }));
    render(<ProfilePage />);

    await user.click(screen.getByRole("button", { name: "Modifica profilo" }));
    await user.clear(screen.getByLabelText("Nome visualizzato"));
    await user.click(screen.getByRole("button", { name: "Salva profilo" }));
    expect(screen.getByRole("status")).toHaveTextContent("Inserisci un nome");
    expect(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? "{}")).toEqual({
      displayName: "Ada",
    });
  });
});
