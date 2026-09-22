import { BackIcon, Button } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Outlet, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { RouteBreadcrumbs, WorkArea } from "#src/shell/index.ts";

export function SettingsLayout() {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  let backLabel = "Back to workspaces";

  if (canGoBack) {
    backLabel = "Go back";
  }

  const goBack = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }

    void navigate({ to: "/" });
  };

  return (
    <WorkArea.Page>
      <WorkArea.Header>
        <div {...stylex.props(styles.navigation)}>
          <Button
            appearance="ghost"
            shape="circle"
            size="xs"
            onClick={goBack}
            aria-label={backLabel}
          >
            <BackIcon aria-hidden="true" />
          </Button>
          <RouteBreadcrumbs />
        </div>
      </WorkArea.Header>
      <WorkArea.Body>
        <WorkArea.Container>
          <Outlet />
        </WorkArea.Container>
      </WorkArea.Body>
    </WorkArea.Page>
  );
}

const styles = stylex.create({
  navigation: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    minWidth: 0,
    gap: space[2],
  },
});
