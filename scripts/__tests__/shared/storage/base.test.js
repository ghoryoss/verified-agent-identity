"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { FileStorage } = require("../../../shared/storage/base");

describe("FileStorage", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "filestorage-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("builds the correct file path from filename and baseDir", () => {
      const storage = new FileStorage("test.json", "/some/dir");
      expect(storage.filePath).toBe(path.join("/some/dir", "test.json"));
    });

    it("uses default baseDir when not specified", () => {
      const storage = new FileStorage("test.json");
      expect(storage.filePath).toBe(
        path.join(process.env.HOME, ".openclaw", "billions", "test.json"),
      );
    });
  });

  describe("ensureDirectory", () => {
    it("creates the directory if it does not exist", async () => {
      const nested = path.join(tempDir, "a", "b", "c");
      const storage = new FileStorage("data.json", nested);
      await storage.ensureDirectory();

      const stat = await fs.stat(nested);
      expect(stat.isDirectory()).toBe(true);
    });

    it("does not throw if the directory already exists", async () => {
      const storage = new FileStorage("data.json", tempDir);
      await expect(storage.ensureDirectory()).resolves.not.toThrow();
    });
  });

  describe("readFile", () => {
    it("returns an empty array when the file does not exist", async () => {
      const storage = new FileStorage("nonexistent.json", tempDir);
      const result = await storage.readFile();
      expect(result).toEqual([]);
    });

    it("reads and parses JSON from an existing file", async () => {
      const data = [{ id: 1, name: "test" }];
      const filePath = path.join(tempDir, "data.json");
      await fs.writeFile(filePath, JSON.stringify(data));

      const storage = new FileStorage("data.json", tempDir);
      const result = await storage.readFile();
      expect(result).toEqual(data);
    });

    it("throws on invalid JSON", async () => {
      const filePath = path.join(tempDir, "bad.json");
      await fs.writeFile(filePath, "not json {{{");

      const storage = new FileStorage("bad.json", tempDir);
      await expect(storage.readFile()).rejects.toThrow();
    });

    it("re-throws non-ENOENT errors", async () => {
      // Create a directory with the same name as the file to trigger EISDIR
      const dirAsFile = path.join(tempDir, "isdir.json");
      await fs.mkdir(dirAsFile);

      const storage = new FileStorage("isdir.json", tempDir);
      await expect(storage.readFile()).rejects.toThrow();
    });
  });

  describe("writeFile", () => {
    it("writes data as formatted JSON", async () => {
      const storage = new FileStorage("out.json", tempDir);
      const data = [{ hello: "world" }];
      await storage.writeFile(data);

      const raw = await fs.readFile(path.join(tempDir, "out.json"), "utf-8");
      expect(JSON.parse(raw)).toEqual(data);
      // Verify pretty-print (2-space indent)
      expect(raw).toBe(JSON.stringify(data, null, 2));
    });

    it("creates directories if they do not exist", async () => {
      const nested = path.join(tempDir, "deep", "nested");
      const storage = new FileStorage("out.json", nested);
      await storage.writeFile({ key: "value" });

      const raw = await fs.readFile(path.join(nested, "out.json"), "utf-8");
      expect(JSON.parse(raw)).toEqual({ key: "value" });
    });

    it("overwrites existing file", async () => {
      const storage = new FileStorage("out.json", tempDir);
      await storage.writeFile([1]);
      await storage.writeFile([2]);

      const raw = await fs.readFile(path.join(tempDir, "out.json"), "utf-8");
      expect(JSON.parse(raw)).toEqual([2]);
    });

    it("uses atomic write (temp file + rename)", async () => {
      const storage = new FileStorage("atomic.json", tempDir);
      await storage.writeFile({ atomic: true });

      // The temp file should not remain
      const files = await fs.readdir(tempDir);
      expect(files).not.toContain("atomic.json.tmp");
      expect(files).toContain("atomic.json");
    });
  });
});
