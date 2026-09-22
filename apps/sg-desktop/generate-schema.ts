import { writeFile } from "node:fs/promises";
import { exportSql } from "drizzle-kit/cli";

const result = await exportSql({ dialect: "sqlite", schema: "src/filesystem/cache-schema.ts" });
if (result.status !== "ok") throw new Error(JSON.stringify(result));
await writeFile(
  "src/filesystem/cache-schema.json",
  `${JSON.stringify(result.statements, null, 2)}\n`,
);
