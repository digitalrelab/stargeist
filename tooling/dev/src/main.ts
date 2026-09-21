import { NodeRuntime } from "@effect/platform-node";
import { runCli } from "./cli";

runCli(process.argv.slice(2)).pipe(NodeRuntime.runMain);
