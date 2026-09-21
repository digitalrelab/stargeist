import { Effect, Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import * as Id from "./id";

const workspaces = Id.define("wsp");
const documents = Id.define("doc");

describe("prefixed IDs", () => {
  it("accepts existing canonical IDs and keeps different prefixes distinct", () => {
    const value = "wsp_00000000000000000000000001";
    const decoded = Schema.decodeUnknownSync(workspaces.schema)(value);

    expect(Schema.encodeSync(workspaces.schema)(decoded)).toBe(value);
    expectTypeOf<typeof workspaces.schema.Type>().not.toExtend<typeof documents.schema.Type>();
  });

  it("rejects the wrong prefix, malformed encoding, and overflowing values", () => {
    const decode = Schema.decodeUnknownSync(workspaces.schema);

    for (const value of [
      "doc_00000000000000000000000001",
      "wsp_0000000000000000000000000i",
      "wsp_80000000000000000000000000",
      "wsp_0000000000000000000000000",
      "wsp_000000000000000000000000001",
    ]) {
      expect(() => decode(value)).toThrow();
    }
  });

  it("generates a fresh canonical ID on each execution of the same effect", () => {
    const first = Effect.runSync(workspaces.generate);
    const second = Effect.runSync(workspaces.generate);

    expect(first).toMatch(/^wsp_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    expect(second).toMatch(/^wsp_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    expect(first).not.toBe(second);
  });

  it("rejects an invalid prefix when defining an ID type", () => {
    expect(() => Id.define("Invalid-Prefix")).toThrow();
  });
});
