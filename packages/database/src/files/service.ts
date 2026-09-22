import { File, FileError, FileObservation, Files, makeFileId } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { and, eq, or, sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { Database } from "../database";
import { files } from "./schema";

const decodeFile = Schema.decodeUnknownEffect(File);
const decodeObservations = Schema.decodeUnknownEffect(Schema.Array(FileObservation));
const batchSize = 128;
const sourceKey = ({ source, objectKey }: Pick<FileObservation, "source" | "objectKey">) =>
  JSON.stringify([source, objectKey]);

const storage = <A, E, R>(operation: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.onError((cause) => reportFailure(operation, cause)),
    Effect.mapError(
      () =>
        new FileError({
          code: "StorageUnavailable",
          message:
            "File data could not be read or saved. Check application storage permissions and available space, then retry.",
        }),
    ),
  );

export const filesLayer = Layer.effect(
  Files,
  Effect.gen(function* () {
    const database = yield* Database;

    return Files.of({
      get: (id) =>
        storage(
          "files.get",
          database
            .select()
            .from(files)
            .where(eq(files.id, id))
            .limit(1)
            .all()
            .pipe(
              Effect.flatMap((rows) => {
                const row = rows[0];
                if (!row) return Effect.succeed(null);
                return decodeFile(row);
              }),
            ),
        ),
      remember: Effect.fnUntraced(
        function* (input) {
          const observations = yield* decodeObservations(input);
          if (observations.length === 0) return [];

          return yield* database.transaction((transaction) =>
            Effect.gen(function* () {
              const result: File[] = [];

              for (let start = 0; start < observations.length; start += batchSize) {
                const batch = observations.slice(start, start + batchSize);
                const existing = yield* transaction
                  .select()
                  .from(files)
                  .where(
                    or(
                      ...batch.map(({ source, objectKey }) =>
                        and(eq(files.source, source), eq(files.objectKey, objectKey)),
                      ),
                    ),
                  )
                  .all();
                const records = new Map(existing.map((record) => [sourceKey(record), record]));
                const changed = new Map<string, typeof files.$inferInsert>();
                for (const observation of batch) {
                  const key = sourceKey(observation);
                  const previous = records.get(key);
                  let id = previous?.id;
                  if (!id) id = yield* makeFileId;
                  const record = { ...observation, id };
                  if (
                    !previous ||
                    previous.name !== record.name ||
                    previous.type !== record.type ||
                    previous.mediaType !== record.mediaType
                  ) {
                    changed.set(id, record);
                  }
                  records.set(key, record);
                  result.push(yield* decodeFile(record));
                }
                if (changed.size > 0) {
                  yield* transaction
                    .insert(files)
                    .values([...changed.values()])
                    .onConflictDoUpdate({
                      target: files.id,
                      set: {
                        name: sql`excluded.name`,
                        type: sql`excluded.type`,
                        mediaType: sql`excluded.media_type`,
                      },
                    })
                    .run();
                }
              }

              return result;
            }),
          );
        },
        (effect) => storage("files.remember", effect),
      ),
    });
  }),
);
