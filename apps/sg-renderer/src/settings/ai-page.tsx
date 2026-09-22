import { typography } from "@stargeist/ui";
import * as stylex from "@stylexjs/stylex";
import { Providers } from "#src/ai/index.ts";
import { WorkArea } from "#src/shell/index.ts";

export function AIPage() {
  return (
    <WorkArea.Page>
      <WorkArea.Header>
        <h1 {...stylex.props(typography.heading)}>AI</h1>
      </WorkArea.Header>
      <WorkArea.Body>
        <WorkArea.Container>
          <Providers />
        </WorkArea.Container>
      </WorkArea.Body>
    </WorkArea.Page>
  );
}
