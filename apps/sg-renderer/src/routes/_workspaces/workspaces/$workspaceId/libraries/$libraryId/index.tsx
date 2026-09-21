import { WorkspaceId, LibraryId } from "@stargeist/domain";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { LibraryPage } from "#src/libraries/pages.ts";

export const Route = createFileRoute("/_workspaces/workspaces/$workspaceId/libraries/$libraryId/")({
  params: {
    parse: ({ workspaceId, libraryId }) => ({
      workspaceId: Schema.decodeUnknownSync(WorkspaceId)(workspaceId),
      libraryId: Schema.decodeUnknownSync(LibraryId)(libraryId),
    }),
  },
  component: LibraryRoute,
});

function LibraryRoute() {
  const { workspaceId, libraryId } = Route.useParams();

  return <LibraryPage workspaceId={workspaceId} libraryId={libraryId} />;
}
