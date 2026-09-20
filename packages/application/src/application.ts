import { Context, Effect, Layer, Scope } from "effect";

type Modules = Readonly<
  Record<
    string,
    {
      readonly exports: Context.Key<unknown, unknown>;
      readonly layer: Layer.Layer<never, unknown, unknown>;
    }
  >
>;

type Api<M extends Modules> = {
  readonly [K in keyof M]: M[K]["exports"]["Service"];
};

export interface Application<A, E = never, R = never> {
  readonly make: Effect.Effect<A, E, R | Scope.Scope>;
}

export function define<M extends Modules, P = never, PE = never, PR = never>(options: {
  readonly modules: M;
  readonly provide?: Layer.Layer<P, PE, PR>;
}): Application<
  Api<M>,
  Layer.Error<M[keyof M]["layer"]> | PE,
  Exclude<Layer.Services<M[keyof M]["layer"]>, P> | PR
> {
  const entries = Object.entries(options.modules);
  const exports = new Map<
    string,
    { readonly name: string; readonly layer: Layer.Layer<never, unknown, unknown> }
  >();
  for (const [name, module] of entries) {
    const existing = exports.get(module.exports.key);
    if (existing && existing.layer !== module.layer) {
      throw new Error(
        `Modules "${existing.name}" and "${name}" export the same service "${module.exports.key}"`,
      );
    }
    exports.set(module.exports.key, { name, layer: module.layer });
  }
  const modules = Layer.mergeAll(
    Layer.empty,
    ...entries.map(([, module]) => module.layer),
  ) as Layer.Layer<
    M[keyof M]["exports"]["Identifier"],
    Layer.Error<M[keyof M]["layer"]>,
    Layer.Services<M[keyof M]["layer"]>
  >;
  const layer = Layer.provide(modules, options.provide ?? Layer.empty).pipe(Layer.fresh);

  return Object.freeze({
    make: Layer.build(layer).pipe(
      Effect.map(
        (context) =>
          Object.freeze(
            Object.fromEntries(
              entries.map(([name, module]) => [name, Context.get(context, module.exports)]),
            ),
          ) as Api<M>,
      ),
    ),
  });
}
