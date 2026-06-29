"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const {
  ChallengeFileStorage,
} = require("../../../shared/storage/challenge");

describe("ChallengeFileStorage", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "challenge-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createStorage() {
    const storage = new ChallengeFileStorage("challenges.json");
    storage.filePath = path.join(tempDir, "challenges.json");
    return storage;
  }

  describe("save", () => {
    it("saves a new challenge entry", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "challenge123");

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].did).toBe("did:test:1");
      expect(entries[0].challenge).toBe("challenge123");
      expect(entries[0].created_at).toBeDefined();
    });

    it("updates an existing challenge for the same DID", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "first");
      await storage.save("did:test:1", "second");

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].challenge).toBe("second");
    });

    it("handles multiple DIDs independently", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");

      const entries = await storage.list();
      expect(entries).toHaveLength(2);
    });
  });

  describe("find", () => {
    it("returns the entry for a known DID", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "challenge123");

      const entry = await storage.find("did:test:1");
      expect(entry.did).toBe("did:test:1");
      expect(entry.challenge).toBe("challenge123");
    });

    it("returns undefined for an unknown DID", async () => {
      const storage = createStorage();
      const entry = await storage.find("did:test:nonexistent");
      expect(entry).toBeUndefined();
    });
  });

  describe("getChallenge", () => {
    it("returns just the challenge string", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "mychallenge");

      const challenge = await storage.getChallenge("did:test:1");
      expect(challenge).toBe("mychallenge");
    });

    it("returns undefined when DID is not found", async () => {
      const storage = createStorage();
      const challenge = await storage.getChallenge("did:test:missing");
      expect(challenge).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all entries", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");
      await storage.save("did:test:3", "c3");

      const entries = await storage.list();
      expect(entries).toHaveLength(3);
    });

    it("returns empty array when no entries", async () => {
      const storage = createStorage();
      const entries = await storage.list();
      expect(entries).toEqual([]);
    });
  });

  describe("delete", () => {
    it("removes an existing entry and returns true", async () => {
      const storage = createStorage();
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");

      const result = await storage.delete("did:test:1");
      expect(result).toBe(true);

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].did).toBe("did:test:2");
    });

    it("returns false when the DID does not exist", async () => {
      const storage = createStorage();
      const result = await storage.delete("did:test:nonexistent");
      expect(result).toBe(false);
    });
  });
});
