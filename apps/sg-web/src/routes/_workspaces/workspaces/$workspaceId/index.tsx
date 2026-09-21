import { WorkspaceId } from "@stargeist/domain/workspaces";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { WorkspaceScreen } from "./-components/screen";

export const Route = createFileRoute("/_workspaces/workspaces/$workspaceId/")({
  params: {
    parse: ({ workspaceId }) => ({
      workspaceId: Schema.decodeUnknownSync(WorkspaceId)(workspaceId),
    }),
  },
  component: WorkspacePage,
});

function WorkspacePage() {
  const { workspaceId } = Route.useParams();
  return <WorkspaceScreen key={workspaceId} id={workspaceId} />;
}
