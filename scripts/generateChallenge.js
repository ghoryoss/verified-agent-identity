const { randomInt } = require("crypto");
const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  requireArgs,
  outputSuccess,
  runScript,
} = require("./shared/utils");

async function main() {
  const args = parseArgs();
  requireArgs(args, ["did"], "node scripts/generateChallenge.js --did <did>");

  const { challengeStorage } = await getInitializedRuntime();

  // Generate random challenge
  const challenge = randomInt(0, 10000000000).toString();

  // Save challenge to storage
  await challengeStorage.save(args.did, challenge);

  outputSuccess(challenge);
}

runScript(main);
