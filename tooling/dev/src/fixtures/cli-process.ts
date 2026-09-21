import { NodeRuntime } from "@effect/platform-node";
import { developmentProfile } from "../desktop/index";
import { runCli } from "../cli";
import { toolingContext } from "../context";

const [application, appData, ...args] = process.argv.slice(2);

if (!application || !appData) {
  throw new Error("Missing isolated profile paths.");
}

runCli(args, () => ({
  ...toolingContext(),
  profile: developmentProfile(application, appData),
})).pipe(NodeRuntime.runMain);
