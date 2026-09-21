import { Effect, Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";

export type Cursor = string | number;

export interface Page<A, C extends Cursor> {
  readonly items: ReadonlyArray<A>;
  readonly next: C | null;
}

export interface Source<A, C extends Cursor, E> {
  readonly initial: Page<A, C>;
  readonly read: (cursor: C) => Effect.Effect<Page<A, C>, E>;
}

export interface Pagination<A, C extends Cursor, E> {
  readonly initial: Atom.Atom<Page<A, C>>;
  readonly pages: (cursor: C) => Atom.Atom<AsyncResult.AsyncResult<Page<A, C>, E>>;
  readonly reset: Atom.Writable<void, Source<A, C, E>>;
}

export function make<A, C extends Cursor, E>(initialSource: Source<A, C, E>): Pagination<A, C, E> {
  const source = Atom.make({ value: initialSource });
  const initial = Atom.make((get) => get(source).value.initial);
  const pages = pageFamily((get, cursor: C) => {
    const current = get(source).value;
    return Effect.suspend(() => current.read(cursor));
  });
  const reset = Atom.writable(
    () => undefined,
    (ctx, replacement: Source<A, C, E>) => ctx.set(source, { value: replacement }),
  );

  return { initial, pages, reset };
}

export interface Extent {
  readonly count: number;
  readonly hasMore: boolean;
}

export interface IndexedSource<A, C extends Cursor, E> extends Source<A, C, E> {
  readonly cursorAt: (offset: number) => C;
}

export class PaginationError extends Schema.TaggedError<PaginationError>()("PaginationError", {
  code: Schema.Literals(["InvalidOffset", "InvalidPage"]),
  message: Schema.String,
}) {}

export interface IndexedPagination<A, C extends Cursor, E> {
  readonly extent: Atom.Atom<Extent>;
  readonly pages: (
    offset: number,
  ) => Atom.Atom<AsyncResult.AsyncResult<Page<A, C>, E | PaginationError>>;
  readonly reset: Atom.Writable<void, IndexedSource<A, C, E>>;
  readonly pageOffset: (index: number) => number;
}

const positiveInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);

export function makeIndexed<A, C extends Cursor, E>(options: {
  readonly pageSize: number;
  readonly source: IndexedSource<A, C, E>;
}): IndexedPagination<A, C, E> {
  const pageSize = Schema.decodeUnknownSync(positiveInteger)(options.pageSize);
  const offsetSchema = Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER - pageSize),
    Schema.isMultipleOf(pageSize),
  );
  const pageSchema = Schema.Union([
    Schema.Struct({ length: Schema.Literal(pageSize), hasMore: Schema.Literal(true) }),
    Schema.Struct({
      length: Schema.Number.check(
        Schema.isInt(),
        Schema.isBetween({ minimum: 0, maximum: pageSize }),
      ),
      hasMore: Schema.Literal(false),
    }),
  ]);
  const decodePage = Schema.decodeUnknownEffect(pageSchema);

  const sessionFor = (source: IndexedSource<A, C, E>) => {
    const hasMore = source.initial.next !== null;
    Schema.decodeUnknownSync(pageSchema)({ length: source.initial.items.length, hasMore });

    return {
      source,
      progress: Atom.make({ count: source.initial.items.length, next: source.initial.next }),
    };
  };

  const session = Atom.make(sessionFor(options.source));
  const extent = Atom.make((get): Extent => {
    const progress = get(get(session).progress);
    return { count: progress.count, hasMore: progress.next !== null };
  });
  const reset = Atom.writable(
    () => undefined,
    (ctx, source: IndexedSource<A, C, E>) => ctx.set(session, sessionFor(source)),
  );

  const pages = pageFamily((get, offset: number) => {
    const current = get(session);

    return Effect.gen(function* () {
      yield* Schema.decodeUnknownEffect(offsetSchema)(offset).pipe(
        Effect.mapError(
          () => new PaginationError({ code: "InvalidOffset", message: "Invalid page offset." }),
        ),
      );

      if (offset === 0) return current.source.initial;

      const previous = get.once(current.progress);
      if (offset > previous.count || (offset === previous.count && previous.next === null)) {
        return yield* new PaginationError({
          code: "InvalidOffset",
          message: "Read pages in order before requesting this page.",
        });
      }

      let cursor: C;
      if (offset === previous.count && previous.next !== null) {
        cursor = previous.next;
      } else {
        cursor = current.source.cursorAt(offset);
      }
      const page = yield* current.source.read(cursor);
      yield* decodePage({ length: page.items.length, hasMore: page.next !== null }).pipe(
        Effect.mapError(
          () =>
            new PaginationError({
              code: "InvalidPage",
              message: "A page must fit the page size and be full when more items follow.",
            }),
        ),
      );

      const latest = get.once(current.progress);
      const count = offset + page.items.length;
      if (count > latest.count) {
        get.set(current.progress, { count, next: page.next });
      } else if (count === latest.count && page.next === null && latest.next !== null) {
        get.set(current.progress, { count, next: null });
      }

      return page;
    });
  });

  return { extent, pages, reset, pageOffset: (index) => Math.floor(index / pageSize) * pageSize };
}

function pageFamily<K, A, E>(read: (get: Atom.AtomContext, key: K) => Effect.Effect<A, E>) {
  return Atom.family((key: K) =>
    Atom.make((get) => read(get, key)).pipe(
      Atom.setIdleTTL(0),
      Atom.map((result): AsyncResult.AsyncResult<A, E> => {
        if (result.waiting) return AsyncResult.initial(true);
        if (result._tag === "Failure") return AsyncResult.failure(result.cause);
        return result;
      }),
      Atom.setIdleTTL(0),
    ),
  );
}
