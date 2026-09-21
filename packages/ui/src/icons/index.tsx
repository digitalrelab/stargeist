import { ArrowLeft, Settings, type LucideProps } from "lucide-react";
import { control } from "../tokens.stylex";

export function BackIcon(props: LucideProps) {
  return <ArrowLeft size={control.iconSize} {...props} />;
}

export function SettingsIcon(props: LucideProps) {
  return <Settings size={control.iconSize} {...props} />;
}
