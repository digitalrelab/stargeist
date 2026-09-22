import { CommandPalette, EditIcon, FileIcon, FolderIcon, LinkIcon, TagsIcon } from "@stargeist/ui";
import { useState, type ReactNode } from "react";

export function FileActionsPalette({
  selectionLabel,
  children,
}: {
  selectionLabel: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState("");
  const actions: readonly CommandPalette.Action[] = [
    {
      id: "move",
      label: "Move to folder…",
      icon: <FolderIcon />,
      keywords: ["relocate"],
      onSelect: () => setStatus("Moving files isn’t available yet."),
    },
    {
      id: "tags",
      label: "Add tags…",
      icon: <TagsIcon />,
      keywords: ["labels", "metadata"],
      onSelect: () => setStatus("Adding tags isn’t available yet."),
    },
    {
      id: "rename",
      label: "Rename…",
      icon: <EditIcon />,
      keywords: ["name"],
      onSelect: () => setStatus("Renaming files isn’t available yet."),
    },
    {
      id: "link",
      label: "Copy link",
      icon: <LinkIcon />,
      keywords: ["url", "share"],
      onSelect: () => setStatus("Copying links isn’t available yet."),
    },
    {
      id: "export",
      label: "Export…",
      icon: <FileIcon />,
      keywords: ["download", "save"],
      onSelect: () => setStatus("Exporting files isn’t available yet."),
    },
  ];

  return (
    <CommandPalette.Root onOpenChange={() => setStatus("")}>
      {children}
      <CommandPalette.Popup
        label="File actions"
        contextLabel={selectionLabel}
        actions={actions}
        status={status}
      />
    </CommandPalette.Root>
  );
}
