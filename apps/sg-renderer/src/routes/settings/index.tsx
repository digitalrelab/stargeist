import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  staticData: { breadcrumb: { label: "General" } },
});
