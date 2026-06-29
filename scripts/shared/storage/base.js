const fs = require("fs/promises");
const path = require("path");

class FileStorage {
  constructor(filename, baseDir = `${process.env.HOME}/.openclaw/billions`) {
    this.filePath = path.join(baseDir, filename);
  }

  async ensureDirectory() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async readFile() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async writeFile(data) {
    await this.ensureDirectory();
    const json = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, json, "utf-8");
    await fs.rename(tempPath, this.filePath);
  }

  /**
   * Inserts or updates an entry in an array by a key field.
   * Returns the updated array.
   */
  upsert(entries, keyField, keyValue, newEntry) {
    const index = entries.findIndex((entry) => entry[keyField] === keyValue);
    if (index >= 0) {
      entries[index] = newEntry;
    } else {
      entries.push(newEntry);
    }
    return entries;
  }
}

module.exports = { FileStorage };
