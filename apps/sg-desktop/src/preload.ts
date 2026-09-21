import { ipcRenderer } from "electron";

ipcRenderer.on("stargeist:ports", (event, nonce: unknown) => {
  window.postMessage({ type: "stargeist:ports", nonce }, "*", event.ports);
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || !event.data || typeof event.data !== "object") return;

  if (
    !("type" in event.data) ||
    event.data.type !== "stargeist:connect" ||
    !("nonce" in event.data) ||
    typeof event.data.nonce !== "string"
  ) {
    return;
  }

  ipcRenderer.send("stargeist:connect", event.data.nonce);
});
