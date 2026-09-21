import { Libraries } from "@stargeist/domain/libraries/service";
import { LibraryRpcs } from "@stargeist/domain/libraries/rpc";
import { Effect } from "effect";
import { LibraryControlRpcs } from "./control";
import { selectedFolder } from "./selected-folder";
import { makeLibraryListing } from "./listing";

export { LibraryRpcs } from "@stargeist/domain/libraries/rpc";
export { LibraryControlRpcs } from "./control";

export const libraryControlHandlers = LibraryControlRpcs.toLayer(
  Effect.gen(function* () {
    const libraries = yield* Libraries;

    return {
      "libraries.add": ({ workspaceId, path }) =>
        selectedFolder(path).pipe(
          Effect.flatMap((folder) => libraries.add(workspaceId, folder.source, folder.displayName)),
        ),
    };
  }),
);

export const libraryHandlers = LibraryRpcs.toLayer(
  Effect.gen(function* () {
    const libraries = yield* Libraries;
    const directories = yield* makeLibraryListing;

    return {
      "libraries.list": ({ workspaceId }) => libraries.list(workspaceId),
      "libraries.get": (selection) => libraries.get(selection),
      "libraries.openDirectory": (selection) =>
        libraries
          .get(selection)
          .pipe(Effect.flatMap((library) => directories.open(library.source.path))),
      "libraries.readDirectory": ({ listingId, offset }) => directories.read(listingId, offset),
      "libraries.closeDirectory": ({ listingId }) => directories.close(listingId),
    };
  }),
);
