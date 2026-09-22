import { File, FileError, FileReference, Files, makeFileId } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { and, eq, or } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { AppDatabase } from "../app/database";
import { files } from "./schema";
import { makeFileMetadata } from "./metadata";

const decodeReferences = Schema.decodeUnknownEffect(Schema.Array(FileReference));
const decodeFiles = Schema.decodeUnknownEffect(Schema.Array(File));
const batchSize = 128;

const referenceKey = ({ source, key }: FileReference) => JSON.stringify([source, key]);

export const filesLayer = Layer.effect(
  Files,
  Effect.gen(function* () {
    const database = yield* AppDatabase;

    return Files.of({
      metadata: yield* makeFileMetadata,
      ensure: Effect.fnUntraced(
        function* (input) {
          const references = yield* decodeReferences(input);
          if (references.length === 0) return [];

          return yield* database.transaction((transaction) =>
            Effect.gen(function* () {
              const result: File[] = [];

              for (let start = 0; start < references.length; start += batchSize) {
                const batch = references.slice(start, start + batchSize);
                const existing = yield* transaction
                  .select()
                  .from(files)
                  .where(
                    or(
                      ...batch.map(({ source, key }) =>
                        and(eq(files.source, source), eq(files.key, key)),
                      ),
                    ),
                  )
                  .all();
                const known = new Map(existing.map((row) => [referenceKey(row), row.id]));
                const created: (typeof files.$inferInsert)[] = [];

                for (const reference of batch) {
                  const referenceId = referenceKey(reference);
                  if (known.has(referenceId)) continue;
                  const id = yield* makeFileId;
                  known.set(referenceId, id);
                  created.push({ id, ...reference });
                }

                let ids = known;
                if (created.length > 0) {
                  yield* transaction.insert(files).values(created).onConflictDoNothing().run();
                  const rows = yield* transaction
                    .select()
                    .from(files)
                    .where(
                      or(
                        ...batch.map(({ source, key }) =>
                          and(eq(files.source, source), eq(files.key, key)),
                        ),
                      ),
                    )
                    .all();
                  ids = new Map(rows.map((row) => [referenceKey(row), row.id]));
                }
                result.push(
                  ...(yield* decodeFiles(
                    batch.map((reference) => ({ id: ids.get(referenceKey(reference)) })),
                  )),
                );
              }

              return result;
            }),
          );
        },
        (effect) =>
          effect.pipe(
            Effect.onError((cause) => reportFailure("files.ensure", cause)),
            Effect.mapError(
              () =>
                new FileError({
                  code: "StorageUnavailable",
                  message: "File data could not be saved. Check available disk space, then retry.",
                }),
            ),
          ),
      ),
    });
  }),
);
