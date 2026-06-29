const { FileStorage } = require("./base");

class ChallengeFileStorage extends FileStorage {
  constructor(filename = "challenges.json") {
    super(filename);
  }

  async save(did, challenge) {
    const entries = await this.readFile();
    const created_at = new Date();
    this.upsert(entries, "did", did, { did, challenge, created_at });
    await this.writeFile(entries);
  }

  async find(did) {
    const entries = await this.readFile();
    return entries.find((entry) => entry.did === did);
  }

  async getChallenge(did) {
    const entry = await this.find(did);
    return entry?.challenge;
  }

  async list() {
    return this.readFile();
  }

  async delete(did) {
    const entries = await this.readFile();
    const initialLength = entries.length;
    const filtered = entries.filter((entry) => entry.did !== did);

    if (filtered.length < initialLength) {
      await this.writeFile(filtered);
      return true;
    }

    return false;
  }
}

module.exports = { ChallengeFileStorage };
