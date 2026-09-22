import type { FileIdentityComparison, FileObservation } from "@stargeist/domain";

export type NativeFile = Pick<FileObservation, "objectKey" | "type" | "evidence">;

export interface IdentityAdapter {
  readonly read: (path: string) => Promise<NativeFile | null>;
  readonly verify?: (
    comparisons: ReadonlyArray<FileIdentityComparison>,
  ) => Promise<ReadonlyArray<"same" | "different">>;
}
