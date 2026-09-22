import { File, FileError, FileObservation, Files, makeFileId } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { and, eq, or, sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { AppDatabase } from "../app/database";
import { files } from "./schema";

const decodeFile = Schema.decodeUnknownEffect(File);
const decodeObservations = Schema.decodeUnknownEffect(Schema.Array(FileObservation));
const batchSize = 128;
const sourceKey = ({ source, objectKey }: Pick<FileObservation, "source" | "objectKey">) =>
  JSON.stringify([source, objectKey]);

type Identity = Pick<FileObservation, "source" | "objectKey" | "evidence">;

export type FileIdentityVerifier = (
  comparisons: ReadonlyArray<{ readonly previous: Identity; readonly current: Identity }>,
) => Effect.Effect<ReadonlyArray<"same" | "different">, FileError>;

const identityUnavailable = () =>
  new FileError({
    code: "IdentityUnavailable",
    message: "The file's identity could not be verified.",
  });

const storage = <A, E, R>(operation: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.onError((cause) => reportFailure(operation, cause)),
    Effect.mapError((error) => {
      if (error instanceof FileError) return error;
      return new FileError({
        code: "StorageUnavailable",
        message:
          "File data could not be read or saved. Check application storage permissions and available space, then retry.",
      });
    }),
  );

export const filesLayer = (verifyIdentities?: FileIdentityVerifier) =>
  Layer.effect(
    Files,
    Effect.gen(function* () {
      const database = yield* AppDatabase;

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
                      and(
                        eq(files.retired, false),
                        or(
                          ...batch.map(({ source, objectKey }) =>
                            and(eq(files.source, source), eq(files.objectKey, objectKey)),
                          ),
                        ),
                      ),
                    )
                    .all();
                  const records = new Map(existing.map((record) => [sourceKey(record), record]));
                  const identities = new Map<string, Identity>(records);
                  const comparisons: Parameters<FileIdentityVerifier>[0][number][] = [];
                  for (const observation of batch) {
                    const key = sourceKey(observation);
                    const previous = identities.get(key);
                    if (previous && (previous.evidence !== null || observation.evidence !== null)) {
                      comparisons.push({ previous, current: observation });
                    }
                    identities.set(key, observation);
                  }
                  let verdicts: ReadonlyArray<"same" | "different"> = [];
                  if (comparisons.length > 0) {
                    if (!verifyIdentities) return yield* identityUnavailable();
                    verdicts = yield* verifyIdentities(comparisons);
                    if (verdicts.length !== comparisons.length) return yield* identityUnavailable();
                  }
                  let comparisonIndex = 0;
                  const changed = new Map<string, typeof files.$inferInsert>();
                  for (const observation of batch) {
                    const key = sourceKey(observation);
                    const previous = records.get(key);
                    let id = previous?.id;
                    if (previous && (previous.evidence !== null || observation.evidence !== null)) {
                      const verdict = verdicts[comparisonIndex++];
                      if (verdict === "different") {
                        changed.set(previous.id, { ...previous, retired: true });
                        id = undefined;
                      } else if (verdict !== "same") {
                        return yield* identityUnavailable();
                      }
                    }
                    if (!id) id = yield* makeFileId;
                    const record = { ...observation, id, retired: false };
                    if (
                      !previous ||
                      previous.id !== id ||
                      previous.evidence !== record.evidence ||
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
                          evidence: sql`excluded.evidence`,
                          retired: sql`excluded.retired`,
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
