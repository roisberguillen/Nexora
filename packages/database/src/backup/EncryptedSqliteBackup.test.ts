// @vitest-environment node

import { beforeAll, describe, expect, it } from "vitest";

import {
  createEncryptedSqliteBackup,
  decryptSqliteBackup,
  PBKDF2_ITERATIONS,
  sha256Hex,
} from "./EncryptedSqliteBackup";

const passphrase = "passphrase-sintetica-sicura";
const databaseBytes = new Uint8Array(512).map((_, index) => index % 251);
const createdAt = "2026-07-27T10:00:00.000Z";

describe("EncryptedSqliteBackup", () => {
  let archive: Uint8Array;

  beforeAll(async () => {
    archive = await createEncryptedSqliteBackup({
      databaseBytes,
      schemaVersion: 1,
      createdAt,
      appVersion: "0.4.0",
      passphrase,
    });
  });

  it("cifra database e manifest e li verifica dopo la decifratura", async () => {
    const decrypted = await decryptSqliteBackup(archive, passphrase);

    expect(PBKDF2_ITERATIONS).toBe(600_000);
    expect(decrypted.databaseBytes).toEqual(databaseBytes);
    expect(decrypted.manifest).toEqual({
      formatVersion: 1,
      schemaVersion: 1,
      createdAt,
      appVersion: "0.4.0",
      files: [
        {
          path: "database.sqlite3",
          sha256: await sha256Hex(databaseBytes),
          size: databaseBytes.byteLength,
        },
      ],
    });
    expect(new TextDecoder().decode(archive)).not.toContain("database.sqlite3");
  });

  it("rifiuta una passphrase diversa senza distinguere il motivo dal tampering", async () => {
    await expect(
      decryptSqliteBackup(archive, "passphrase-sintetica-diversa"),
    ).rejects.toMatchObject({
      code: "invalid_archive",
    });
  });

  it("rifiuta un archivio cifrato manomesso", async () => {
    const tampered = archive.slice();
    tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;

    await expect(decryptSqliteBackup(tampered, passphrase)).rejects.toMatchObject({
      code: "invalid_archive",
    });
  });

  it("rifiuta formati sconosciuti prima della derivazione della chiave", async () => {
    const unsupported = archive.slice();
    unsupported[0] = 0;

    await expect(decryptSqliteBackup(unsupported, passphrase)).rejects.toMatchObject({
      code: "unsupported_backup",
    });
  });

  it("impone una passphrase non banale", async () => {
    await expect(
      createEncryptedSqliteBackup({
        databaseBytes,
        schemaVersion: 1,
        createdAt,
        passphrase: "corta-123",
      }),
    ).rejects.toMatchObject({ code: "backup_failed" });
  });
});
