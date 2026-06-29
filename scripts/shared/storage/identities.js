const { FileStorage } = require("./base");

/**
 * IdentitiesFileStorage implements IDataSource<Type> interface from js-sdk
 */
class IdentitiesFileStorage extends FileStorage {
  async load() {
    return await this.readFile();
  }

  async save(key, value, keyName = "id") {
    const data = await this.readFile();
    this.upsert(data, keyName, key, value);
    await this.writeFile(data);
  }

  async get(key, keyName = "id") {
    const data = await this.readFile();
    return data.find((item) => item[keyName] === key);
  }

  async delete(key, keyName = "id") {
    const data = await this.readFile();
    const filtered = data.filter((item) => item[keyName] !== key);

    if (filtered.length === data.length) {
      // Item not found, throw error to match expected behavior
      throw new Error(`Item with ${keyName}=${key} not found`);
    }

    await this.writeFile(filtered);
  }
}

module.exports = { IdentitiesFileStorage };
