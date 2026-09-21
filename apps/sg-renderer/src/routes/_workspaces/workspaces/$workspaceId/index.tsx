import { WorkspaceId } from "@stargeist/domain/workspaces";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { WorkspacePage } from "#src/workspaces/index.ts";

export const Route = createFileRoute("/_workspaces/workspaces/$workspaceId/")({
  params: {
    parse: ({ workspaceId }) => ({
      workspaceId: Schema.decodeUnknownSync(WorkspaceId)(workspaceId),
    }),
  },
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { workspaceId } = Route.useParams();

  return <WorkspacePage workspaceId={workspaceId} />;
}
