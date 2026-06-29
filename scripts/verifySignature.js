const { JWSPacker, byteEncoder } = require("@0xpolygonid/js-sdk");
const { getInitializedRuntime } = require("./shared/bootstrap");
const { parseArgs, formatError, outputSuccess } = require("./shared/utils");

async function main() {
  try {
    const args = parseArgs();

    if (!args.token) {
      console.error("Error: --token parameters is required");
      console.error(
        "Usage: node scripts/verifySignature.js --did <did> --token <token>",
      );
      process.exit(1);
    }

    const { kms, challengeStorage } = await getInitializedRuntime();

    // Get the stored challenge entry and validate
    const challengeEntry = await challengeStorage.find(args.did);
    if (!challengeEntry) {
      console.error(`Error: No challenge found for DID: ${args.did}`);
      console.error("Generate a challenge first with generateChallenge.js");
      process.exit(1);
    }

    // Reject expired challenges (10-minute TTL)
    const CHALLENGE_TTL_MS = 10 * 60 * 1000;
    const age = Date.now() - new Date(challengeEntry.created_at).getTime();
    if (age > CHALLENGE_TTL_MS) {
      await challengeStorage.delete(args.did);
      console.error("Error: Challenge has expired. Generate a new one.");
      process.exit(1);
    }

    const challenge = challengeEntry.challenge;

    // Create DID resolver that fetches from remote resolver
    const resolveDIDDocument = {
      resolve: async (did) => {
        const resp = await fetch(
          `https://resolver.privado.id/1.0/identifiers/${encodeURIComponent(did)}`,
        );
        if (!resp.ok) {
          throw new Error(`DID resolution failed: ${resp.status}`);
        }
        const didResolutionRes = await resp.json();
        return didResolutionRes;
      },
    };

    // Create JWS packer and unpack token
    const jws = new JWSPacker(kms, resolveDIDDocument);
    const basicMessage = await jws.unpack(byteEncoder.encode(args.token));

    // Verify the sender
    if (basicMessage.from !== args.did) {
      console.error(
        `Error: Invalid from: expected from ${args.did}, got ${basicMessage.from}`,
      );
      process.exit(1);
    }

    // Verify the challenge matches
    const payload = basicMessage.body;
    if (payload.message !== challenge) {
      console.error("Error: Challenge mismatch");
      process.exit(1);
    }

    // Consume the challenge to prevent replay
    await challengeStorage.delete(args.did);

    outputSuccess("Signature verified successfully");
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();
