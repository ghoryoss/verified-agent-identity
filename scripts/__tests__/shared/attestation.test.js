"use strict";

// Mock the iden3 core library (uses ESM internally, incompatible with Jest CJS)
const MOCK_IDEN3_ID = 99887766554433n;

jest.mock("@iden3/js-iden3-core", () => ({
  DID: {
    parse: jest.fn((did) => did),
    idFromDID: jest.fn(() => ({
      bigInt: () => MOCK_IDEN3_ID,
    })),
  },
}));

const { ethers } = require("ethers");

const {
  buildJsonAttestation,
  buildEncodedAttestation,
  computeAttestationHash,
} = require("../../shared/attestation");

const TEST_DID = "did:iden3:privado:main:2SZu1G6YDUtk9AAY6TZic24CcCYcZvtdyp1cQv9cig";
const TEST_ETH_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("attestation module", () => {
  describe("buildJsonAttestation", () => {
    it("returns a well-structured attestation object", () => {
      const att = buildJsonAttestation({
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      });

      expect(att.schemaId).toBe(
        "0xca354bee6dc5eded165461d15ccb13aceb6f77ebbb1fd3fe45aca686097f2911",
      );
      expect(att.attester).toBeDefined();
      expect(att.attester.did).toBe("");
      expect(att.attester.iden3Id).toBe("0");
      expect(att.attester.ethereumAddress).toBe(
        "0x0000000000000000000000000000000000000000",
      );
      expect(att.recipient.did).toBe(TEST_DID);
      expect(att.recipient.ethereumAddress).toBe(TEST_ETH_ADDRESS);
      expect(att.recipient.iden3Id).toBe(MOCK_IDEN3_ID.toString());
      expect(att.expirationTime).toBe("0");
      expect(att.revocable).toBe(false);
      expect(att.refId).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      );
      expect(att.data).toBe("0x");
    });
  });

  describe("buildEncodedAttestation", () => {
    it("returns an ABI-encoded hex string", () => {
      const encoded = buildEncodedAttestation({
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      });

      expect(encoded).toMatch(/^0x[0-9a-f]+$/i);
      expect(encoded.length).toBeGreaterThan(2);
    });

    it("is deterministic for the same inputs", () => {
      const req = {
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      };
      const enc1 = buildEncodedAttestation(req);
      const enc2 = buildEncodedAttestation(req);
      expect(enc1).toBe(enc2);
    });
  });

  describe("computeAttestationHash", () => {
    it("returns a numeric string", () => {
      const hash = computeAttestationHash({
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      });

      expect(hash).toMatch(/^\d+$/);
    });

    it("is deterministic", () => {
      const req = {
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      };
      const h1 = computeAttestationHash(req);
      const h2 = computeAttestationHash(req);
      expect(h1).toBe(h2);
    });

    it("masks the top nibble (top 4 bits zeroed)", () => {
      const hash = computeAttestationHash({
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      });
      const hashBigInt = BigInt(hash);
      const mask = BigInt(
        "0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      );
      expect(hashBigInt & mask).toBe(hashBigInt);
    });

    it("matches manual keccak256 computation", () => {
      const req = {
        recipientDid: TEST_DID,
        recipientEthAddress: TEST_ETH_ADDRESS,
      };
      const encoded = buildEncodedAttestation(req);
      const expectedHash =
        BigInt(ethers.keccak256(encoded)) &
        BigInt(
          "0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        );

      const hash = computeAttestationHash(req);
      expect(hash).toBe(expectedHash.toString());
    });
  });
});
