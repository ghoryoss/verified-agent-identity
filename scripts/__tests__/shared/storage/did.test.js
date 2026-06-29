"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { DidsFileStorage } = require("../../../shared/storage/did");

describe("DidsFileStorage", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dids-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createStorage() {
    const storage = new DidsFileStorage("defaultDid.json");
    storage.filePath = path.join(tempDir, "defaultDid.json");
    return storage;
  }

  describe("save", () => {
    it("saves a new DID entry", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaabb",
        isDefault: false,
      });

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].did).toBe("did:iden3:test:1");
      expect(entries[0].publicKeyHex).toBe("0xaabb");
      expect(entries[0].isDefault).toBe(false);
    });

    it("updates an existing DID entry", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xold",
        isDefault: false,
      });
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xnew",
        isDefault: true,
      });

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].publicKeyHex).toBe("0xnew");
      expect(entries[0].isDefault).toBe(true);
    });

    it("unsets other defaults when saving a new default", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaa",
        isDefault: true,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0xbb",
        isDefault: true,
      });

      const entries = await storage.list();
      expect(entries).toHaveLength(2);

      const firstEntry = entries.find((e) => e.did === "did:iden3:test:1");
      const secondEntry = entries.find((e) => e.did === "did:iden3:test:2");

      expect(firstEntry.isDefault).toBe(false);
      expect(secondEntry.isDefault).toBe(true);
    });

    it("does not unset defaults when saving a non-default", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaa",
        isDefault: true,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0xbb",
        isDefault: false,
      });

      const entries = await storage.list();
      const firstEntry = entries.find((e) => e.did === "did:iden3:test:1");
      expect(firstEntry.isDefault).toBe(true);
    });
  });

  describe("find", () => {
    it("returns the matching DID entry", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaa",
        isDefault: false,
      });

      const entry = await storage.find("did:iden3:test:1");
      expect(entry.did).toBe("did:iden3:test:1");
    });

    it("returns undefined for non-existent DID", async () => {
      const storage = createStorage();
      const entry = await storage.find("did:iden3:test:missing");
      expect(entry).toBeUndefined();
    });
  });

  describe("getDefault", () => {
    it("returns the default entry", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaa",
        isDefault: false,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0xbb",
        isDefault: true,
      });

      const defaultEntry = await storage.getDefault();
      expect(defaultEntry.did).toBe("did:iden3:test:2");
    });

    it("returns undefined when no default is set", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaa",
        isDefault: false,
      });

      const defaultEntry = await storage.getDefault();
      expect(defaultEntry).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all DID entries", async () => {
      const storage = createStorage();
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0xaa",
        isDefault: true,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0xbb",
        isDefault: false,
      });

      const entries = await storage.list();
      expect(entries).toHaveLength(2);
    });

    it("returns empty array when no entries", async () => {
      const storage = createStorage();
      const entries = await storage.list();
      expect(entries).toEqual([]);
    });
  });
});
