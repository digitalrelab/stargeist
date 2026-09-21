import { HashSet } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Selection } from "./index";

describe("Selection membership", () => {
  it("replaces and toggles stable keys without mutating previous values", () => {
    const initial = Selection.replace("listing-a", ["a", "b", "a"]);
    const changed = Selection.toggle(initial, "a");
    expect(Selection.count(initial)).toBe(2);
    expect(Selection.contains(initial, "a")).toBe(true);
    expect(Selection.contains(changed, "a")).toBe(false);
    expect(Selection.contains(changed, "b")).toBe(true);
    expect(changed.scope).toBe("listing-a");
    expect(Selection.count(Selection.empty("listing-a"))).toBe(0);
  });

  it("represents all 5,000 entries with exceptions, without materializing their keys", () => {
    const all = Selection.all<string, string>("listing-a");
    const except = Selection.toggle(Selection.toggle(all, "a"), "b");
    expect(all.mode).toBe("all");
    if (all.mode !== "all" || except.mode !== "all") throw new Error("Expected all selection");
    expect(HashSet.size(all.excludedKeys)).toBe(0);
    expect(HashSet.size(except.excludedKeys)).toBe(2);
    expect(Selection.count(except, 5_000)).toBe(4_998);
    expect(Selection.count(except)).toBeUndefined();
    expect(Selection.contains(except, "unloaded-file")).toBe(true);
    expect(Selection.contains(except, "a")).toBe(false);
    expect(Selection.contains(Selection.toggle(except, "a"), "a")).toBe(true);
  });
});
