import { Context, Data, type Effect } from "effect";

export class FolderPickerError extends Data.TaggedError("FolderPickerError")<{
  readonly cause: unknown;
}> {}

export class FolderPicker extends Context.Service<
  FolderPicker,
  {
    readonly choose: (title: string) => Effect.Effect<string | null, FolderPickerError>;
  }
>()("@stargeist/desktop/FolderPicker") {}
