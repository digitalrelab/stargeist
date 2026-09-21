# Application composition

`@stargeist/application` composes Effect services. It has no knowledge of Electron, RPC, persistence, React, or Stargeist features.

A module selects one public service from an implementation layer. An application composes those modules and supplies their private dependencies. Defining either is lazy; resources are acquired when the application is built and released with its scope.

```ts
const application = Application.define({
  modules: {
    catalog: Module.define({ exports: Catalog, layer: catalogLayer }),
  },
  provide: databaseLayer,
});

const program = Effect.gen(function* () {
  const catalog = yield* Catalog;
  return yield* catalog.list;
});

Effect.runPromise(program.pipe(Effect.provide(application.layer)));
```

Use `application.layer` to provide public services to an Effect program. Use `application.make` when an integration needs a named object of those same services. These are alternative ways to start an instance; building each separately starts separate instances. Do not project an application with `make` and then reconstruct its services with `Layer.succeed`.

When a consumer owns scoped work, close that work before its providers: `program.pipe(Effect.scoped, Effect.provide(application.layer))`. This ensures requests and sessions finish releasing their resources before the database closes.

Dependencies are shared within an instance through Effect's layer memoization. Reuse the same layer value when sharing is intended. Separate builds own separate state and resources. Only the services selected by modules are exported; private dependencies stay private. Competing implementations of the same public service are rejected.

## Capability conventions

- Import public product capabilities from the domain root, for example `import { Workspaces, UserPreferences } from "@stargeist/domain"`. Within domain, use direct relative imports to keep the public barrel out of the internal dependency graph.
- Keep domain modules free of import-time I/O, registration, or other external side effects. The package declares `sideEffects: false` so bundlers can discard unused capabilities from root imports.
- Put product models, errors, and service contracts in `@stargeist/domain`. Define the public interface explicitly, without deriving it from a database, transport, or implementation.
- Implement contracts in adapters. SQLite implements `Workspaces` and `Libraries`; electron-store implements `UserPreferences`. Callers request those capabilities and use their operations without selecting storage engines or paths.
- Select adapters at application composition. Use scoped layers for owned resources. Initialize dependencies before exposing their consumers, and let scopes handle failure, cancellation, and shutdown.
- Keep `StoragePaths` responsible for product locations and `TemporaryStorage` responsible for temporary session lifetime. A generic storage facade would obscure the different semantics of relational records and preferences.
- Keep shared wire declarations in `@stargeist/protocol`. Export only explicitly authorized operations at each process boundary. Adding a method to a product service must not automatically expose it over RPC.
- Renderer clients describe the operations available to their consumers. Adapters translate wire payloads and connection failures into those portable interfaces. Folder-picker workflows use `createFromFolder` and `addFromFolder`; record creation uses `create` and `add` with explicit input.
- Renderer modules expose `WorkspaceState` and `LibraryState`. Their atoms and refresh behavior are presentation state, distinct from product services.
- Add a separate repository or orchestration layer only when it owns meaningful policy. Do not maintain a forwarding layer solely to rename the same operations.

Package exports and import restrictions in the root Vite configuration enforce the package boundaries. When extending a capability, test its observable behavior through its public contract; test an adapter separately where serialization, persistence, or resource lifetime matters.
