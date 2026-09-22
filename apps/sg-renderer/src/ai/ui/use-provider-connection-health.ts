import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";
import type { ProviderHealthCheck } from "../state";

const pollingInterval = 30_000;

export function useProviderConnectionHealth({
  check: atom,
  enabled,
  lastValidatedAt,
  paused,
}: {
  check: ProviderHealthCheck;
  enabled: boolean;
  lastValidatedAt: number;
  paused: boolean;
}) {
  const result = useAtomValue(atom);
  const check = useAtomSet(atom, { mode: "promiseExit" });
  const control = useAtomSet(atom);

  useEffect(() => {
    if (!enabled) {
      control(Atom.Reset);
      return;
    }

    if (paused) {
      control(Atom.Reset);
      return;
    }

    let active = true;
    let running = false;
    let timer: number | undefined;

    const clearTimer = () => {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (delay: number) => {
      clearTimer();
      timer = window.setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      timer = undefined;
      if (!active || running || document.visibilityState !== "visible") return;
      running = true;
      await check(undefined);
      running = false;
      if (active && document.visibilityState === "visible") schedule(pollingInterval);
    };

    const handleVisibilityChange = () => {
      clearTimer();
      if (document.visibilityState === "visible" && !running) void poll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    let initialDelay = pollingInterval;
    const elapsed = Math.max(0, Date.now() - lastValidatedAt);
    if (elapsed >= pollingInterval) initialDelay = 0;
    else initialDelay -= elapsed;
    if (document.visibilityState === "visible") schedule(initialDelay);

    return () => {
      active = false;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      control(Atom.Reset);
    };
  }, [check, control, enabled, lastValidatedAt, paused]);

  return result;
}
