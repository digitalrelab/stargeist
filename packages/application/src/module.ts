import { Context, Layer } from "effect";

export interface Module<I, A, E = never, R = never> {
  readonly exports: Context.Key<I, A>;
  readonly layer: Layer.Layer<I, E, R>;
}

export function define<I, A, E, R>(options: {
  readonly exports: Context.Service<I, A>;
  readonly layer: Layer.Layer<NoInfer<I>, E, R>;
}): Module<I, A, E, R> {
  return Object.freeze({
    exports: options.exports,
    layer: Layer.effect(options.exports, options.exports).pipe(Layer.provide(options.layer)),
  });
}
