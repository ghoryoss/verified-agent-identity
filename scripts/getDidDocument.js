const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  outputSuccess,
  createDidDocument,
  resolveDid,
  runScript,
} = require("./shared/utils");

async function main() {
  const args = parseArgs();
  const { didsStorage } = await getInitializedRuntime();

  const entry = await resolveDid(didsStorage, args.did);
  const didDocument = createDidDocument(entry.did, entry.publicKeyHex);

  outputSuccess({
    didDocument,
    did: entry.did,
  });
}

runScript(main);
