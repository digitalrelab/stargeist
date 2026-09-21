import { ArrowLeft, Settings, type LucideProps } from "lucide-react";

const defaultSize = 16;

export function BackIcon(props: LucideProps) {
  return <ArrowLeft size={defaultSize} {...props} />;
}

export function SettingsIcon(props: LucideProps) {
  return <Settings size={defaultSize} {...props} />;
}
