import { writeFile } from "node:fs/promises";
import { exportSql } from "drizzle-kit/cli";

for (const directory of ["src/workspaces/sqlite", "src/filesystem", "src/files"]) {
  const result = await exportSql({ dialect: "sqlite", schema: `${directory}/schema.ts` });

  if (result.status !== "ok") {
    throw new Error(JSON.stringify(result));
  }

  await writeFile(
    `${directory}/initial-schema.json`,
    `${JSON.stringify(result.statements, null, 2)}\n`,
  );
}
