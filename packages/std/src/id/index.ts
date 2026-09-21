import { Effect, Schema } from "effect";
import { TypeID, typeid } from "typeid-js";

export function define<const Prefix extends string>(prefix: Prefix) {
  TypeID.fromString(`${prefix}_00000000000000000000000000`, prefix);

  const schema = Schema.String.check(
    Schema.makeFilter(
      (value) => {
        try {
          TypeID.fromString(value, prefix);

          return true;
        } catch {
          return false;
        }
      },
      { expected: `a ${prefix} TypeID` },
    ),
  ).pipe(Schema.brand(`Id:${prefix}`));

  const decode = Schema.decodeUnknownSync(schema);
  const generate = Effect.sync(() => decode(typeid(prefix).toString()));

  return { schema, generate };
}
