import { createBrowserHistory, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "../.generated/route-tree";

export const router = createRouter({
  routeTree,
  history: window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
