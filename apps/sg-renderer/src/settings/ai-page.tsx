import { ProvidersSection } from "#src/ai/index.ts";
import { WorkArea } from "#src/shell/index.ts";

export function AIPage() {
  return (
    <WorkArea.Page>
      <WorkArea.Header>
        <WorkArea.Title>AI</WorkArea.Title>
      </WorkArea.Header>
      <WorkArea.Body>
        <WorkArea.Container>
          <ProvidersSection />
        </WorkArea.Container>
      </WorkArea.Body>
    </WorkArea.Page>
  );
}
