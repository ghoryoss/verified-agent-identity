"use strict";

// Mock ESM dependencies that Jest cannot parse
jest.mock("@0xpolygonid/js-sdk", () => ({
  bytesToHex: jest.fn((bytes) =>
    Buffer.from(bytes).toString("hex"),
  ),
  keyPath: jest.fn((keyType, keyId) => `${keyType}:${keyId}`),
  PROTOCOL_CONSTANTS: {
    PROTOCOL_MESSAGE_TYPE: {
      AUTHORIZATION_RESPONSE_MESSAGE_TYPE:
        "https://iden3-communication.io/authorization/1.0/response",
    },
  },
}));

jest.mock("@iden3/js-iden3-core", () => ({
  DID: {
    parse: jest.fn((did) => did),
    idFromDID: jest.fn(() => ({
      bigInt: () => 12345n,
    })),
  },
  Id: {
    ethAddressFromId: jest.fn(() => new Uint8Array(20)),
  },
}));

jest.mock("@noble/curves/secp256k1", () => ({
  secp256k1: {
    Point: {
      fromHex: jest.fn(() => ({
        toHex: jest.fn(() => "compressed_pubkey_hex"),
      })),
    },
  },
}));

jest.mock("uuid", () => ({
  v7: jest.fn(() => "mock-uuid-v7"),
}));

const {
  normalizeKey,
  addHexPrefix,
  parseArgs,
  formatError,
  outputSuccess,
  urlFormating,
  codeFormating,
  buildEthereumAddressFromDid,
  createDidDocument,
  normalizedKeyPath,
  getAuthResponseMessage,
} = require("../../shared/utils");

describe("utils module", () => {
  describe("normalizeKey", () => {
    it("strips 0x prefix", () => {
      expect(normalizeKey("0xdeadbeef")).toBe("deadbeef");
    });

    it("returns key unchanged when no 0x prefix", () => {
      expect(normalizeKey("deadbeef")).toBe("deadbeef");
    });

    it("handles empty string", () => {
      expect(normalizeKey("")).toBe("");
    });

    it("only strips leading 0x, not 0x in the middle", () => {
      expect(normalizeKey("0xabc0xdef")).toBe("abc0xdef");
    });
  });

  describe("addHexPrefix", () => {
    it("adds 0x prefix when missing", () => {
      expect(addHexPrefix("deadbeef")).toBe("0xdeadbeef");
    });

    it("does not double-add 0x prefix", () => {
      expect(addHexPrefix("0xdeadbeef")).toBe("0xdeadbeef");
    });

    it("handles empty string", () => {
      expect(addHexPrefix("")).toBe("0x");
    });
  });

  describe("parseArgs", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("parses --key value pairs", () => {
      process.argv = ["node", "script.js", "--did", "abc123", "--key", "ff00"];
      const args = parseArgs();
      expect(args).toEqual({ did: "abc123", key: "ff00" });
    });

    it("returns empty object when no args", () => {
      process.argv = ["node", "script.js"];
      const args = parseArgs();
      expect(args).toEqual({});
    });

    it("handles single argument pair", () => {
      process.argv = ["node", "script.js", "--challenge", "hello"];
      const args = parseArgs();
      expect(args).toEqual({ challenge: "hello" });
    });

    it("skips non-flag arguments", () => {
      process.argv = ["node", "script.js", "positional", "--key", "val"];
      const args = parseArgs();
      expect(args).toEqual({ key: "val" });
    });
  });

  describe("formatError", () => {
    it("formats error with message", () => {
      expect(formatError(new Error("something went wrong"))).toBe(
        "Error: something went wrong",
      );
    });

    it("handles empty error message", () => {
      expect(formatError(new Error(""))).toBe("Error: ");
    });
  });

  describe("outputSuccess", () => {
    it("outputs string directly", () => {
      const spy = jest.spyOn(console, "log").mockImplementation();
      outputSuccess("hello");
      expect(spy).toHaveBeenCalledWith("hello");
      spy.mockRestore();
    });

    it("outputs object as formatted JSON", () => {
      const spy = jest.spyOn(console, "log").mockImplementation();
      const data = { key: "value" };
      outputSuccess(data);
      expect(spy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
      spy.mockRestore();
    });

    it("outputs array as formatted JSON", () => {
      const spy = jest.spyOn(console, "log").mockImplementation();
      const data = [1, 2, 3];
      outputSuccess(data);
      expect(spy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
      spy.mockRestore();
    });
  });

  describe("urlFormating", () => {
    it("formats a markdown link", () => {
      expect(urlFormating("Click here", "https://example.com")).toBe(
        "[Click here](https://example.com)",
      );
    });
  });

  describe("codeFormating", () => {
    it("wraps data in escaped backticks", () => {
      expect(codeFormating("some code")).toBe(
        "\\`\\`\\`some code\\`\\`\\`",
      );
    });
  });

  describe("buildEthereumAddressFromDid", () => {
    it("returns a hex address prefixed with 0x", () => {
      const result = buildEthereumAddressFromDid("did:iden3:test:1");
      expect(result).toMatch(/^0x[0-9a-f]+$/);
    });
  });

  describe("createDidDocument", () => {
    it("returns a valid W3C DID document structure", () => {
      const doc = createDidDocument("did:iden3:test:1", "0xpublickeyhex");
      expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(doc.id).toBe("did:iden3:test:1");
      expect(doc.verificationMethod).toHaveLength(1);
      expect(doc.verificationMethod[0].id).toBe(
        "did:iden3:test:1#ethereum-based-id",
      );
      expect(doc.verificationMethod[0].type).toBe(
        "EcdsaSecp256k1RecoveryMethod2020",
      );
      expect(doc.authentication).toEqual([
        "did:iden3:test:1#ethereum-based-id",
      ]);
    });
  });

  describe("normalizedKeyPath", () => {
    it("normalizes the key ID and creates a key path", () => {
      const result = normalizedKeyPath("secp256k1", "0xabcdef");
      expect(result).toBe("secp256k1:abcdef");
    });

    it("passes through key IDs without 0x prefix", () => {
      const result = normalizedKeyPath("secp256k1", "abcdef");
      expect(result).toBe("secp256k1:abcdef");
    });
  });

  describe("getAuthResponseMessage", () => {
    it("returns a properly structured auth response message", () => {
      const msg = getAuthResponseMessage("did:iden3:test:1", "challenge123");
      expect(msg.id).toBe("mock-uuid-v7");
      expect(msg.thid).toBe("mock-uuid-v7");
      expect(msg.from).toBe("did:iden3:test:1");
      expect(msg.to).toBe("");
      expect(msg.type).toBe(
        "https://iden3-communication.io/authorization/1.0/response",
      );
      expect(msg.body.message).toBe("challenge123");
      expect(msg.body.scope).toEqual([]);
    });
  });
});
