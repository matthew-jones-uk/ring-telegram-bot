import type { Observable } from 'rxjs';
import { Chunk, Effect, Option, Stream } from 'effect';

/**
 * Converts an RxJS Observable into an Effect Stream.
 * Unsubscribes from the Observable when the Stream is interrupted.
 */
export const streamFromObservable = <A>(obs: Observable<A>): Stream.Stream<A, Error> =>
    Stream.async<A, Error>((emit) => {
        const sub = obs.subscribe({
            next: (a) => emit(Effect.succeed(Chunk.of(a))),
            error: (err) => emit(Effect.fail(Option.some(err instanceof Error ? err : new Error(String(err))))),
            complete: () => emit(Effect.fail(Option.none())),
        });
        return Effect.sync(() => sub.unsubscribe());
    });

/**
 * Wraps a stream so that clean completion is treated as a failure.
 * If the stream ends normally, fails with the provided message.
 * If the stream errors, the original error propagates unchanged.
 */
export const neverEndingStream = <A, E>(stream: Stream.Stream<A, E>, message: string): Stream.Stream<A, E | Error> =>
    Stream.concat(stream, Stream.fail(new Error(message)));
