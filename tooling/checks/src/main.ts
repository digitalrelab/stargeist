import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { runCli } from "./cli.ts";

runCli(process.argv.slice(2)).pipe(NodeRuntime.runMain);
