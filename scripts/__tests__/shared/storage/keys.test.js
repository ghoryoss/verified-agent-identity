"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");

describe("KeysFileStorage", () => {
  let tempDir;
  let KeysFileStorage;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
    jest.resetModules();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "keys-test-"));

    // Patch the default baseDir by mocking the constructor's default
    KeysFileStorage =
      require("../../../shared/storage/keys").KeysFileStorage;
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createStorage() {
    const storage = new KeysFileStorage("kms.json");
    // Override the filePath to use our temp dir
    storage.filePath = path.join(tempDir, "kms.json");
    return storage;
  }

  async function writeRawKms(data) {
    await fs.writeFile(
      path.join(tempDir, "kms.json"),
      JSON.stringify(data, null, 2),
    );
  }

  describe("_decodeEntry", () => {
    it("decodes legacy format entries", () => {
      const storage = createStorage();
      const result = storage._decodeEntry({
        alias: "secp256k1:abc",
        privateKeyHex: "deadbeef",
      });
      expect(result).toEqual({ alias: "secp256k1:abc", privateKeyHex: "deadbeef" });
    });

    it("decodes v1 plain entries", () => {
      const storage = createStorage();
      const result = storage._decodeEntry({
        version: 1,
        provider: "plain",
        data: {
          alias: "secp256k1:abc",
          key: "deadbeef",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      });
      expect(result).toEqual({
        alias: "secp256k1:abc",
        privateKeyHex: "deadbeef",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });

    it("marks encrypted entries as opaque when master key is absent", () => {
      const storage = createStorage();
      const raw = {
        version: 1,
        provider: "encrypted",
        data: {
          alias: "secp256k1:enc",
          key: "aa:bb:cc",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      };
      const result = storage._decodeEntry(raw);
      expect(result._opaque).toBe(true);
      expect(result._raw).toBe(raw);
    });

    it("decodes encrypted entries when master key is available", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "testMasterKey1234567890";
      jest.resetModules();
      const { KeysFileStorage: KFS } = require("../../../shared/storage/keys");
      const { encryptKey } = require("../../../shared/storage/crypto");

      const storage = new KFS("kms.json");
      storage.filePath = path.join(tempDir, "kms.json");

      const masterKey = "testMasterKey1234567890";
      const encrypted = encryptKey("deadbeef", masterKey);

      const result = storage._decodeEntry({
        version: 1,
        provider: "encrypted",
        data: { alias: "secp256k1:enc", key: encrypted, createdAt: "2026-01-01T00:00:00.000Z" },
      });
      expect(result.alias).toBe("secp256k1:enc");
      expect(result.privateKeyHex).toBe("deadbeef");
    });

    it("throws on unrecognised format", () => {
      const storage = createStorage();
      expect(() =>
        storage._decodeEntry({ version: 99, provider: "unknown", data: { alias: "test" } }),
      ).toThrow("Unrecognised kms.json entry format");
    });
  });

  describe("_encodeEntry", () => {
    it("encodes as plain when no master key is set", () => {
      const storage = createStorage();
      const result = storage._encodeEntry({
        alias: "secp256k1:test",
        privateKeyHex: "abcdef",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result).toEqual({
        version: 1,
        provider: "plain",
        data: {
          alias: "secp256k1:test",
          key: "abcdef",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      });
    });

    it("encodes as encrypted when master key is set", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "testMasterKey1234567890";
      jest.resetModules();
      const { KeysFileStorage: KFS } = require("../../../shared/storage/keys");

      const storage = new KFS("kms.json");
      storage.filePath = path.join(tempDir, "kms.json");

      const result = storage._encodeEntry({
        alias: "secp256k1:test",
        privateKeyHex: "abcdef",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.version).toBe(1);
      expect(result.provider).toBe("encrypted");
      expect(result.data.alias).toBe("secp256k1:test");
      expect(result.data.key).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });
  });

  describe("readFile", () => {
    it("returns empty array for non-existent file", async () => {
      const storage = createStorage();
      const keys = await storage.readFile();
      expect(keys).toEqual([]);
    });

    it("throws if root is not an array", async () => {
      await writeRawKms({ not: "array" });
      const storage = createStorage();
      await expect(storage.readFile()).rejects.toThrow(
        "kms.json root must be an array",
      );
    });

    it("reads and decodes plain v1 entries", async () => {
      await writeRawKms([
        {
          version: 1,
          provider: "plain",
          data: { alias: "secp256k1:k1", key: "aabb", createdAt: "2026-01-01T00:00:00.000Z" },
        },
      ]);
      const storage = createStorage();
      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].alias).toBe("secp256k1:k1");
      expect(keys[0].privateKeyHex).toBe("aabb");
    });

    it("filters out opaque entries and stashes them", async () => {
      await writeRawKms([
        {
          version: 1,
          provider: "plain",
          data: { alias: "secp256k1:plain1", key: "aa", createdAt: "2026-01-01T00:00:00.000Z" },
        },
        {
          version: 1,
          provider: "encrypted",
          data: { alias: "secp256k1:enc1", key: "iv:tag:ct", createdAt: "2026-01-01T00:00:00.000Z" },
        },
      ]);
      const storage = createStorage();
      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].alias).toBe("secp256k1:plain1");
      expect(storage._opaqueEntries).toHaveLength(1);
    });
  });

  describe("writeFile", () => {
    it("encodes entries and includes opaque entries", async () => {
      const storage = createStorage();
      const opaqueRaw = {
        version: 1,
        provider: "encrypted",
        data: { alias: "secp256k1:opaque", key: "iv:tag:ct" },
      };
      storage._opaqueEntries = [opaqueRaw];

      await storage.writeFile([
        { alias: "secp256k1:k1", privateKeyHex: "aabb", createdAt: "2026-01-01T00:00:00.000Z" },
      ]);

      const raw = JSON.parse(
        await fs.readFile(path.join(tempDir, "kms.json"), "utf-8"),
      );
      expect(raw).toHaveLength(2);
      expect(raw[0].data.alias).toBe("secp256k1:k1");
      expect(raw[1]).toEqual(opaqueRaw);
    });
  });

  describe("importKey", () => {
    it("adds a new key", async () => {
      const storage = createStorage();
      await writeRawKms([]);
      await storage.importKey({ alias: "secp256k1:new", key: "ff00" });

      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].alias).toBe("secp256k1:new");
      expect(keys[0].privateKeyHex).toBe("ff00");
      expect(keys[0].createdAt).toBeDefined();
    });

    it("updates an existing key by alias", async () => {
      await writeRawKms([
        {
          version: 1,
          provider: "plain",
          data: { alias: "secp256k1:k1", key: "old", createdAt: "2026-01-01T00:00:00.000Z" },
        },
      ]);
      const storage = createStorage();
      await storage.importKey({ alias: "secp256k1:k1", key: "new" });

      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].privateKeyHex).toBe("new");
    });

    it("removes opaque entry when importing same alias", async () => {
      const storage = createStorage();
      await writeRawKms([]);
      storage._opaqueEntries = [
        {
          version: 1,
          provider: "encrypted",
          data: { alias: "secp256k1:k1", key: "iv:tag:ct" },
        },
      ];

      await storage.importKey({ alias: "secp256k1:k1", key: "newplain" });
      expect(storage._opaqueEntries).toHaveLength(0);
    });
  });

  describe("get", () => {
    it("returns the key for a known alias", async () => {
      await writeRawKms([
        {
          version: 1,
          provider: "plain",
          data: { alias: "secp256k1:k1", key: "aabb", createdAt: "2026-01-01T00:00:00.000Z" },
        },
      ]);
      const storage = createStorage();
      const key = await storage.get({ alias: "secp256k1:k1" });
      expect(key).toBe("aabb");
    });

    it("returns empty string for unknown alias", async () => {
      await writeRawKms([]);
      const storage = createStorage();
      const key = await storage.get({ alias: "secp256k1:missing" });
      expect(key).toBe("");
    });
  });

  describe("list", () => {
    it("returns alias/key pairs", async () => {
      await writeRawKms([
        {
          version: 1,
          provider: "plain",
          data: { alias: "secp256k1:k1", key: "aa", createdAt: "2026-01-01T00:00:00.000Z" },
        },
        {
          version: 1,
          provider: "plain",
          data: { alias: "secp256k1:k2", key: "bb", createdAt: "2026-01-01T00:00:00.000Z" },
        },
      ]);
      const storage = createStorage();
      const list = await storage.list();
      expect(list).toEqual([
        { alias: "secp256k1:k1", key: "aa" },
        { alias: "secp256k1:k2", key: "bb" },
      ]);
    });
  });
});
