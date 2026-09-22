import { Form as BaseForm } from "@base-ui/react/form";
import * as stylex from "@stylexjs/stylex";
import { space } from "../tokens.stylex";

type RootProps = Omit<BaseForm.Props, "className" | "style">;

export function Root(props: RootProps) {
  return <BaseForm {...props} {...stylex.props(styles.root)} />;
}

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: space[2] },
});
