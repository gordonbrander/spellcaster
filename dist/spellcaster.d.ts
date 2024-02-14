/**
 * Creates a dependency tracker
 * We use this to allow signals to automatically gather their downstream
 * dependencies.
 */
export declare const dependencyTracker: () => {
    withTracking: <T>(onChange: () => void, perform: () => T) => T;
    getTracked: () => ((() => void) | undefined);
};
export declare const withTracking: <T>(onChange: () => void, perform: () => T) => T, getTracked: () => ((() => void) | undefined);
/**
 * Given a zero-argument function, create a throttled version of that function
 * that will run only once per microtask.
 */
export declare const throttled: (job: () => void) => (() => void);
/**
 * Create a transaction notification publisher.
 * Allows you to register listeners that are called once during the next
 * transaction.
 */
export declare const transaction: () => {
    withTransaction: (listener: (() => void) | undefined) => void;
    transact: () => void;
};
/**
 * A signal is a zero-argument function that returns a value.
 * Reactive signals created with `signal()` will cause reactive contexts
 * to automatically re-execute when the signal changes.
 * Constant signals can be modeled as zero-argument functions that
 * return a constant value.
 */
export type Signal<T> = (() => T);
/**
 * Is value a signal-like function?
 * A signal is any zero-argument function.
 */
export declare const isSignal: (value: any) => value is Signal<any>;
/** Sample a value that may be a signal, or just an ordinary value */
export declare const sample: <T>(value: T | Signal<T>) => T;
/**
 * A signal is a reactive state container. It holds a single value which is
 * updated atomically.
 *
 * When signal values are read within reactive scopes, such as `computed` or
 * `effect`, the scope will automatically re-execute when the signal changes.
 */
export declare const signal: <T>(initial: T) => [Signal<T>, (value: T) => void];
/**
 * Create a computed signal
 * Computed sigal takes a zero-argument function, `compute` which may read
 * from any other signal to produce a value.
 * `compute` is executed within a reactive scope, so signals referenced within
 * `compute` will automatically cause `compute` to be re-run when signal
 * state changes.
 */
export declare const computed: <T>(compute: Signal<T>) => () => T;
/**
 * Perform a side-effect whenever signals referenced within `perform` change.
 * `perform` is executed within a reactive scope, so signals referenced within
 * `perform` will automatically cause `perform` to be re-run when signal
 * state changes.
 */
export declare const effect: (perform: () => void) => void;
export type Effect<Msg> = (() => Promise<Msg>) | (() => Msg);
export type Transaction<State, Msg> = {
    state: State;
    effects: Array<Effect<Msg>>;
};
/** Create a transaction object for the store. */
export declare const next: <State, Msg>(state: State, effects?: Effect<Msg>[]) => Transaction<State, Msg>;
/**
 * Create store for state. A web app can centralize all state in a single store,
 * and use Signals to scope store state down to DOM updates.
 * Store is inspired by the Elm App Architecture Pattern.
 */
export declare const store: <State, Msg>({ init, update, debug }: {
    init: () => Transaction<State, Msg>;
    update: (state: State, msg: Msg) => Transaction<State, Msg>;
    debug?: boolean;
}) => [Signal<State>, (msg: Msg) => void];
/**
 * Log an unknown message and return a no-op transaction. Useful for handling
 * the `default` arm of a switch statement in an update function to catch
 * anything sent to the store that you don't recognize.
 */
export declare const unknown: <State, Msg>(state: State, msg: Msg) => Transaction<State, Msg>;
/**
 * Transform a signal, returning a computed signal that takes values until
 * the given signal returns null. Once the given signal returns null, the
 * signal is considered to be complete and no further updates will occur.
 *
 * This utility is useful for signals representing a child in a dynamic
 * collection of children, where the child may cease to exist.
 * A computed signal looks up the child, returns null if that child no longer
 * exists. This completes the signal and breaks the connection with upstream
 * signals, allowing the child signal to be garbaged.
 */
export declare const takeValues: <T>(maybeSignal: Signal<T>) => () => T;
