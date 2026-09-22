import type { FileType } from "@stargeist/domain";

export interface NativeFile {
  readonly objectKey: string;
  readonly type: FileType;
  readonly evidence: string | null;
}

export interface IdentityComparison {
  readonly previous: {
    readonly source: string;
    readonly objectKey: string;
    readonly evidence: string | null;
  };
  readonly current: {
    readonly source: string;
    readonly objectKey: string;
    readonly evidence: string | null;
  };
}

export interface IdentityAdapter {
  readonly read: (path: string) => Promise<NativeFile | null>;
  readonly verify?: (
    comparisons: ReadonlyArray<IdentityComparison>,
  ) => Promise<ReadonlyArray<"same" | "different">>;
}
