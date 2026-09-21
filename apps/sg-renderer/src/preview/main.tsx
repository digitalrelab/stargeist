import { Button } from "@stargeist/ui/button";
import { colors } from "@stargeist/ui/colors.stylex";
import { BackIcon, SettingsIcon } from "@stargeist/ui/icons";
import * as Sidebar from "@stargeist/ui/sidebar";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../reset.css";

function Preview() {
  const [activations, setActivations] = useState(0);
  const activate = () => setActivations((count) => count + 1);

  return (
    <main id="reference" {...stylex.props(styles.page, typography.body)}>
      <h1 {...stylex.props(typography.heading)}>UI reference</h1>
      <p>Use Tab, Enter, Space, and the pointer to inspect focus and interaction states.</p>
      <output aria-live="polite">Button activations: {activations}</output>
      <div {...stylex.props(styles.row)}>
        <Button size="sm" onClick={activate}>
          Small button
        </Button>
        <Button onClick={activate}>Medium button</Button>
        <Button size="icon" appearance="ghost" aria-label="Back" onClick={activate}>
          <BackIcon aria-hidden="true" />
        </Button>
      </div>
      <div {...stylex.props(styles.panels)}>
        {(["canvas", "surface", "surfaceRaised"] as const).map((surface) => (
          <section key={surface} id={surface} {...stylex.props(styles.panel, surfaces[surface])}>
            <h2 {...stylex.props(typography.heading)}>{surface}</h2>
            <div {...stylex.props(styles.tableViewport)}>
              <table {...stylex.props(styles.table, typography.label)}>
                <thead>
                  <tr>
                    <th>Appearance</th>
                    <th>Enabled</th>
                    <th>Disabled</th>
                    <th>Icon</th>
                    <th>ARIA disabled</th>
                  </tr>
                </thead>
                <tbody>
                  {(["solid", "soft", "ghost"] as const).map((appearance) => (
                    <tr key={appearance}>
                      <th scope="row">{appearance}</th>
                      <td>
                        <Button appearance={appearance} onClick={activate}>
                          Action
                        </Button>
                      </td>
                      <td>
                        <Button appearance={appearance} disabled onClick={activate}>
                          Action
                        </Button>
                      </td>
                      <td>
                        <Button
                          appearance={appearance}
                          size="icon"
                          aria-label={`${surface} ${appearance} settings`}
                          onClick={activate}
                        >
                          <SettingsIcon aria-hidden="true" />
                        </Button>
                      </td>
                      <td>
                        <Button
                          appearance={appearance}
                          size="icon"
                          aria-disabled="true"
                          onClick={activate}
                          aria-label={`${surface} ${appearance} disabled settings`}
                        >
                          <SettingsIcon aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Sidebar.Nav aria-label={`${surface} navigation`}>
              <Sidebar.Link href="#reference">Resting navigation</Sidebar.Link>
              <Sidebar.Link href={`#${surface}`} aria-current="page">
                Selected navigation
              </Sidebar.Link>
            </Sidebar.Nav>
          </section>
        ))}
      </div>
    </main>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: space[4],
    minHeight: "100dvh",
    padding: space[6],
    color: colors.text,
    backgroundColor: colors.canvas,
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: space[4] },
  panels: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))",
    gap: space[4],
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: space[4],
    padding: space[4],
    minWidth: 0,
  },
  tableViewport: { overflowX: "auto", padding: space[1] },
  table: { width: "100%", borderSpacing: space[2], textAlign: "start" },
});

const surfaces = stylex.create({
  canvas: { backgroundColor: colors.canvas },
  surface: { backgroundColor: colors.surface },
  surfaceRaised: { backgroundColor: colors.surfaceRaised },
});

const root = document.getElementById("root");
if (!root) throw new Error("The preview root is missing");
createRoot(root).render(<Preview />);
