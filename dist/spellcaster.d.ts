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
/** The ID function */
export declare const id: (x: any) => any;
export type Middleware<Msg> = (send: (msg: Msg) => void) => (msg: Msg) => void;
/**
 * Create reducer-style store for state.
 * @param state - Initial state
 * @param update - The update reducer function. Receives the current state
 * and msg and returns the new state.
 * @param msg - (Optional) initial message to send to the store
 * @param middleware - (Optional) middleware to apply to the store
 *
 * @returns an array-pair containing state signal and send function.
 *
 * Side-effects can be implemented by `middleware`. See `fx()` below for a
 * default effects middleware that models effects as async zero-arg functions.
 *
 * Store is inspired by Redux and the Elm App Architecture Pattern.
 * You can centralize all state in a single store, and use signals to scope
 * down store state, or you can use multiple stores.
 */
export declare const store: <State, Msg>({ state: initial, update, msg, middleware: middleware, }: {
    state: State;
    update: (state: State, msg: Msg) => State;
    msg?: Msg;
    middleware: Middleware<Msg>;
}) => [Signal<State>, (msg: Msg) => void];
export type Effect<Msg> = (() => Promise<Msg>) | (() => Msg);
/**
 * Standard fx middleware for a store.
 * Effects are modeled as zero-argument functions.
 *
 * @example
 * const fx = (msg: Msg) => {
 *   switch (msg.type) {
 *   case "fetch":
 *     const req = async () => Msg.fetched(await fetch(msg.url).json())
 *     return [req]
 *   default:
 *     return []
 *   }
 * }
 *
 * const [state, send] = store({
 *   state,
 *   update,
 *   middleware: fxware(fx)
 * })
 */
export declare const fxware: <Msg>(generateFx: (msg: Msg) => Iterable<Effect<Msg>>) => (send: (msg: Msg) => void) => (msg: Msg) => void;
/**
 * Logging middleware for store.
 * Logs actions sent to store. Since middleware is run from top-to-bottom,
 * you'll typically want to stack this first in a middleware chain so all
 * sends are logged.
 * @example
 * const [posts, sendPosts] = store({
 *   state,
 *   update,
 *   middleware: logware({name: 'PostsStore', debug: true})
 * })
 */
export declare const logware: ({ name, debug }: {
    name?: string;
    debug?: (boolean | Signal<boolean>);
}) => <Msg>(send: (msg: Msg) => void) => (msg: Msg) => void;
/**
 * Compose multiple store middlewares together.
 * Order of execution will be from top to bottom.
 */
export declare const middleware: <Msg>(...middlewares: Middleware<Msg>[]) => Middleware<Msg>;
