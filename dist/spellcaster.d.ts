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
export type Signallike<T> = T | Signal<T>;
/** Sample a value that may be a signal, or just an ordinary value */
export declare const sample: <T>(value: Signallike<T>) => T;
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
/**
 * A saga is an async generator that yields messages and receives states.
 * We use it to model asynchronous side effects.
 */
export type Saga<Msg> = AsyncGenerator<Msg, any, unknown>;
/**
 * A saga that generates no side effects.
 * This is the default root saga for stores, unless you explicitly provide one.
 */
export declare function noFx<State, Msg>(state: State, msg: Msg): AsyncGenerator<never, void, unknown>;
/**
 * Create a reducer-based store for state.
 * Stores are given an initial state and an update function that takes the
 * current state and a message, and returns a new state.
 *
 * You may also provide an async generator function `fx` to a store to generate
 * side effects. Like update, `fx` is invoked once per message, with both the
 * current state (before change) and the message. The generator function may
 * yield any number of messages, which are sent to the store.
 *
 * Returns a two-array containing a signal for state, and a send function
 * for messages.
 */
export declare const store: <State, Msg>({ state: initial, update, fx }: {
    state: State;
    update: (state: State, msg: Msg) => State;
    fx: (state: State, msg: Msg) => Saga<Msg>;
    debug?: boolean;
}) => [Signal<State>, (msg: Msg) => void];
