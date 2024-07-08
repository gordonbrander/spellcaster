import {Signal} from './signal-polyfill.js'

/**
 * A signal is a zero-argument function that returns a value.
 * Reactive signals created with `signal()` will cause reactive contexts
 * to automatically re-execute when the signal changes.
 * Constant signals can be modeled as zero-argument functions that
 * return a constant value.
 */
export type Signal<T> = (() => T)

/**
 * Is value a signal-like function?
 * A signal is any zero-argument function.
 */
export const isSignal = (value: any): value is Signal<any> =>
  (typeof value === 'function' && value.length === 0)

/** Sample a value that may be a signal, or just an ordinary value */
export const sample = <T>(value: T|Signal<T>): T =>
  isSignal(value) ? value() : value

/**
 * A signal is a reactive state container. It holds a single value which is
 * updated atomically.
 * 
 * When signal values are read within reactive scopes, such as `computed` or
 * `effect`, the scope will automatically re-execute when the signal changes.
 */
export const signal = <T>(initial: T): [Signal<T>, (value: T) => void] => {
  const state = new Signal.State(initial)
  const get = () => state.get()
  const set = (value: T) => state.set(value)
  return [get, set]
}

/**
 * Create a computed signal
 * Computed sigal takes a zero-argument function, `compute` which may read
 * from any other signal to produce a value.
 * `compute` is executed within a reactive scope, so signals referenced within
 * `compute` will automatically cause `compute` to be re-run when signal
 * state changes.
 */
export const computed = <T>(compute: Signal<T>) => {
  const computed = new Signal.Computed(compute)
  const get = () => computed.get()
  return get
}

/**
 * Given a zero-argument function, create a throttled version of that function
 * that will run only once per microtask.
 */
export const throttled = (
  job: () => void,
  queue: ((callback: () => void) => void) = queueMicrotask
): (() => void) => {
  let isScheduled = false

  const perform = () => {
    job()
    isScheduled = false
  }

  const schedule = () => {
    if (!isScheduled) {
      isScheduled = true
      queue(perform)
    }
  }

  return schedule
}

const watcher = new Signal.subtle.Watcher(throttled(() => {
  for (const signal of watcher.getPending()) {
    signal.get()
  }
  watcher.watch()
}))

/**
 * Perform a side-effect whenever signals referenced within `perform` change.
 * `perform` is executed within a reactive scope, so signals referenced within
 * `perform` will automatically cause `perform` to be re-run when signal
 * state changes.
 * 
 * `perform` may optionally return a zero-argument cleanup function that will
 * be called just before the effect is re-run.
 * 
 * Returns a dispose function that will end the effect, run cleanup, and
 * prevent further reactive updates. Note it is not typically necessary to
 * dispose an effect, so in most cases you can ignore the returned dispose
 * function. Since effects only react to the signals they reference, and
 * clean up after themselves, you can simply stop referencing a signal to
 * stop reacting (e.g. using a boolean signal and if statement to turn
 * on/off an effect). However, the returned dispose function can be useful
 * when an effect's lifecycle is tied to the lifecycle of a component or class,
 * and that component or class has a destructor.
 */
export const effect = (perform: () => unknown) => {
  let cleanup: any

  const signal = new Signal.Computed(() => {
    if (typeof cleanup === 'function') {
      cleanup()
    }
    cleanup = perform()
  })

  watcher.watch(signal)
  signal.get()

  const dispose = () => {
    if (typeof cleanup === 'function') {
      cleanup()
    }
    watcher.unwatch(signal)
  }

  return dispose
}

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
export const takeValues = <T>(maybeSignal: Signal<T|null|undefined>) => {
  const initial = maybeSignal()

  if (initial == null) {
    throw new TypeError("Signal initial value cannot be null")
  }

  let state = initial
  let isComplete = false

  return computed(() => {
    if (isComplete) {
      return state
    }

    const next = maybeSignal()

    if (next != null) {
      state = next
      return state
    } else {
      isComplete = true
      return state
    }
  })
}

/** The ID function */
export const id = (x: any) => x

export type Middleware<Msg> = (send: (msg: Msg) => void) => (msg: Msg) => void

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
export const store = <State, Msg>(
  {
    state: initial,
    update,
    msg = undefined,
    middleware = id,
  }: {
    state: State,
    update: (state: State, msg: Msg) => State,
    msg?: Msg,
    middleware?: Middleware<Msg>
  }
): [Signal<State>, (msg: Msg) => void] => {
  const [state, setState] = signal(initial)

  /** Send a message to the store */
  const send = (msg: Msg) => setState(update(state(), msg))
  /** Decorated send function with middleware */
  const sendWithMiddleware = middleware(send)

  if (msg) {
    sendWithMiddleware(msg)
  }

  return [state, sendWithMiddleware]
}

export type Effect<Msg> = (() => Promise<Msg>)|(() => Msg)

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
export const fxware = <Msg>(
  generateFx: (msg: Msg) => Iterable<Effect<Msg>>
) => (send: (msg: Msg) => void) => {
  const forkFx = async (fx: Effect<Msg>) => sendWithFx(await fx())

  const forkAllFx = (effects: Iterable<Effect<Msg>>) => {
    for (const fx of effects) {
      forkFx(fx)
    }
  }

  const sendWithFx = (msg: Msg) => {
    send(msg)
    forkAllFx(generateFx(msg))
  }

  return sendWithFx
}

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
export const logware = ({
  name = "store",
  debug = true
}: {
  name?: string,
  debug?: (boolean|Signal<boolean>)
}) => <Msg>(send: (msg: Msg) => void) => (msg: Msg) => {
  if (sample(debug)) {
    console.log(name, msg)
  }
  send(msg)
}

/**
 * Compose multiple store middlewares together.
 * Order of execution will be from top to bottom.
 */
export const middleware = <Msg>(
  ...middlewares: Array<Middleware<Msg>>
): Middleware<Msg> => (
  send: (msg: Msg) => void
) => middlewares.reduce(
  (send, middleware) => middleware(send),
  send
)