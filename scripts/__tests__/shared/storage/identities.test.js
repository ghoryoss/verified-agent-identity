"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const {
  IdentitiesFileStorage,
} = require("../../../shared/storage/identities");

describe("IdentitiesFileStorage", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "identities-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createStorage(filename = "identities.json") {
    const storage = new IdentitiesFileStorage(filename);
    storage.filePath = path.join(tempDir, filename);
    return storage;
  }

  describe("load", () => {
    it("returns an empty array when file does not exist", async () => {
      const storage = createStorage();
      const data = await storage.load();
      expect(data).toEqual([]);
    });

    it("returns stored data", async () => {
      const storage = createStorage();
      const items = [{ id: "a", data: "foo" }];
      await fs.writeFile(
        path.join(tempDir, "identities.json"),
        JSON.stringify(items),
      );

      const data = await storage.load();
      expect(data).toEqual(items);
    });
  });

  describe("save", () => {
    it("adds a new item", async () => {
      const storage = createStorage();
      await storage.save("item1", { id: "item1", name: "First" });

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({ id: "item1", name: "First" });
    });

    it("updates an existing item by default keyName 'id'", async () => {
      const storage = createStorage();
      await storage.save("item1", { id: "item1", name: "First" });
      await storage.save("item1", { id: "item1", name: "Updated" });

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Updated");
    });

    it("uses custom keyName for matching", async () => {
      const storage = createStorage();
      await storage.save("val1", { custom: "val1", x: 1 }, "custom");
      await storage.save("val1", { custom: "val1", x: 2 }, "custom");

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0].x).toBe(2);
    });

    it("adds items with different keys", async () => {
      const storage = createStorage();
      await storage.save("a", { id: "a" });
      await storage.save("b", { id: "b" });

      const data = await storage.load();
      expect(data).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("returns an item by default keyName", async () => {
      const storage = createStorage();
      await storage.save("item1", { id: "item1", name: "First" });

      const item = await storage.get("item1");
      expect(item).toEqual({ id: "item1", name: "First" });
    });

    it("returns undefined for non-existent key", async () => {
      const storage = createStorage();
      const item = await storage.get("nonexistent");
      expect(item).toBeUndefined();
    });

    it("works with custom keyName", async () => {
      const storage = createStorage();
      await storage.save("val1", { custom: "val1", x: 42 }, "custom");

      const item = await storage.get("val1", "custom");
      expect(item).toEqual({ custom: "val1", x: 42 });
    });
  });

  describe("delete", () => {
    it("removes an existing item", async () => {
      const storage = createStorage();
      await storage.save("item1", { id: "item1" });
      await storage.save("item2", { id: "item2" });

      await storage.delete("item1");

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("item2");
    });

    it("throws when item is not found", async () => {
      const storage = createStorage();
      await expect(storage.delete("nonexistent")).rejects.toThrow(
        "Item with id=nonexistent not found",
      );
    });

    it("works with custom keyName", async () => {
      const storage = createStorage();
      await storage.save("val1", { custom: "val1", x: 1 }, "custom");

      await storage.delete("val1", "custom");

      const data = await storage.load();
      expect(data).toHaveLength(0);
    });

    it("throws with custom keyName when not found", async () => {
      const storage = createStorage();
      await expect(storage.delete("missing", "custom")).rejects.toThrow(
        "Item with custom=missing not found",
      );
    });
  });
});
