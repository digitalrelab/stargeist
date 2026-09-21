import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { runCli } from "./cli";

runCli(process.argv.slice(2)).pipe(NodeRuntime.runMain);
