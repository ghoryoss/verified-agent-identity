"use strict";

const crypto = require("crypto");

describe("crypto module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear the require cache so getMasterKey re-reads process.env
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadCrypto() {
    return require("../../../shared/storage/crypto");
  }

  describe("getMasterKey", () => {
    it("returns null when BILLIONS_NETWORK_MASTER_KMS_KEY is not set", () => {
      delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
      const { getMasterKey } = loadCrypto();
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when the env var is an empty string", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "";
      const { getMasterKey } = loadCrypto();
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when the key is shorter than 16 characters", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "short";
      const { getMasterKey } = loadCrypto();
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when the key is whitespace-only (trimmed < 16 chars)", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "               ";
      const { getMasterKey } = loadCrypto();
      expect(getMasterKey()).toBeNull();
    });

    it("returns the trimmed key when it is >= 16 characters", () => {
      const key = "thisIsAValidMasterKey123";
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = `  ${key}  `;
      const { getMasterKey } = loadCrypto();
      expect(getMasterKey()).toBe(key);
    });

    it("returns the key exactly when it is exactly 16 characters", () => {
      const key = "exactly16chars!!";
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = key;
      const { getMasterKey } = loadCrypto();
      expect(getMasterKey()).toBe(key);
    });
  });

  describe("encryptKey / decryptKey round-trip", () => {
    it("encrypts and decrypts a private key hex string correctly", () => {
      const { encryptKey, decryptKey } = loadCrypto();
      const masterKey = "mySuperSecretMasterKey2024";
      const plaintext = "deadbeef1234567890abcdef";

      const encrypted = encryptKey(plaintext, masterKey);

      // Encrypted format is iv:authTag:ciphertext
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);

      // Each part should be a hex string
      parts.forEach((part) => {
        expect(part).toMatch(/^[0-9a-f]+$/);
      });

      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
      const { encryptKey } = loadCrypto();
      const masterKey = "mySuperSecretMasterKey2024";
      const plaintext = "deadbeef1234567890abcdef";

      const enc1 = encryptKey(plaintext, masterKey);
      const enc2 = encryptKey(plaintext, masterKey);

      expect(enc1).not.toBe(enc2);
    });

    it("handles empty plaintext", () => {
      const { encryptKey, decryptKey } = loadCrypto();
      const masterKey = "aValidMasterKeyForTesting";

      const encrypted = encryptKey("", masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe("");
    });

    it("handles long plaintext", () => {
      const { encryptKey, decryptKey } = loadCrypto();
      const masterKey = "aValidMasterKeyForTesting";
      const plaintext = crypto.randomBytes(256).toString("hex");

      const encrypted = encryptKey(plaintext, masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decryptKey error handling", () => {
    it("throws on invalid format (not 3 colon-separated parts)", () => {
      const { decryptKey } = loadCrypto();
      expect(() => decryptKey("invalid", "anyKey1234567890")).toThrow(
        "Invalid encrypted key format in kms.json",
      );
    });

    it("throws on wrong master key", () => {
      const { encryptKey, decryptKey } = loadCrypto();
      const encrypted = encryptKey("deadbeef", "correctMasterKey1234");

      expect(() => decryptKey(encrypted, "wrongMasterKey123456")).toThrow(
        "kms.json decryption failed",
      );
    });

    it("throws on tampered ciphertext", () => {
      const { encryptKey, decryptKey } = loadCrypto();
      const masterKey = "correctMasterKey1234";
      const encrypted = encryptKey("deadbeef", masterKey);

      const parts = encrypted.split(":");
      // Tamper with the ciphertext
      parts[2] = "00" + parts[2].slice(2);
      const tampered = parts.join(":");

      expect(() => decryptKey(tampered, masterKey)).toThrow(
        "kms.json decryption failed",
      );
    });
  });
});
