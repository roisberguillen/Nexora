import { describe, expect, it, vi } from "vitest";

import { retryTransient, selectStorage } from "./StorageSelection";

const archive = (kind: "opfs" | "indexeddb", state: "absent" | "present" | "blocked") => ({
  kind,
  available: state !== "blocked",
  state,
  lastCheckedAt: "2026-07-29T12:00:00.000Z",
});

describe("selectStorage", () => {
  it("preferisce l'unico archivio esistente invece della preferenza", () => {
    expect(
      selectStorage([archive("opfs", "present"), archive("indexeddb", "absent")], "indexeddb"),
    ).toEqual({
      kind: "open",
      storageKind: "opfs",
    });
  });

  it("attiva il recupero guidato con due archivi presenti", () => {
    expect(selectStorage([archive("opfs", "present"), archive("indexeddb", "present")])).toEqual({
      kind: "guided-recovery",
      reason: "multiple-data-archives",
    });
  });

  it("non apre un archivio vuoto quando un altro è bloccato", () => {
    expect(selectStorage([archive("opfs", "blocked"), archive("indexeddb", "absent")])).toEqual({
      kind: "guided-recovery",
      reason: "unsafe-state",
    });
  });

  it("usa la preferenza valida solo quando non sono stati rilevati archivi", () => {
    expect(
      selectStorage([archive("opfs", "absent"), archive("indexeddb", "absent")], "indexeddb"),
    ).toEqual({
      kind: "open",
      storageKind: "indexeddb",
    });
  });

  it("sceglie OPFS solo quando entrambi gli archivi sono assenti", () => {
    expect(selectStorage([archive("opfs", "absent"), archive("indexeddb", "absent")])).toEqual({
      kind: "open",
      storageKind: "opfs",
    });
  });

  it("non apre IndexedDB quando la sua ispezione è bloccata", () => {
    expect(selectStorage([archive("opfs", "absent"), archive("indexeddb", "blocked")])).toEqual({
      kind: "guided-recovery",
      reason: "unsafe-state",
    });
  });

  it("ignora una preferenza non valida e sceglie OPFS disponibile", () => {
    expect(
      selectStorage(
        [archive("opfs", "absent"), archive("indexeddb", "absent")],
        "unsupported" as never,
      ),
    ).toEqual({ kind: "open", storageKind: "opfs" });
  });

  it("richiede recupero quando l'ispezione segnala corruzione", () => {
    expect(
      selectStorage([
        { ...archive("opfs", "absent"), state: "corrupt" as const },
        archive("indexeddb", "absent"),
      ]),
    ).toEqual({ kind: "guided-recovery", reason: "unsafe-state" });
  });
});

describe("retryTransient", () => {
  it("ritenta errori temporanei con backoff", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ready");
    const sleep = vi.fn(async () => undefined);
    await expect(retryTransient(action, () => true, { sleep })).resolves.toBe("ready");
    expect(action).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(150, undefined);
  });

  it("propaga l'ultimo errore se tutti i retry falliscono", async () => {
    const failure = new Error("temporary");
    const action = vi.fn(async () => Promise.reject(failure));
    await expect(
      retryTransient(action, () => true, { maxAttempts: 2, sleep: async () => undefined }),
    ).rejects.toBe(failure);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("non ritenta quando la procedura viene annullata", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      retryTransient(
        async () => "ready",
        () => true,
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
