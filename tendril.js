// @ts-check

/**
 * Creates a dependency tracker
 * We use this to allow signals to automatically gather their downstream
 * dependencies.
 */
const dependencyTracker = () => {
  /** @type {Array<() => void>} */
  const scopes = []

  /**
   * Get the current tracked scope
   * @returns {(() => void)|null}
   */
  const getTracked = () => scopes[scopes.length - 1]

  /**
   * @template T
   * @param {() => void} onChange the scope to set. A callback to be notified
   *   during the next transaction.
   * @param {() => T} perform a function to perform immediately while scope
   *   is set.
   * @returns {T} the value returned by perform
   */
  const withTracking = (onChange, perform) => {
    scopes.push(onChange)
    const value = perform()
    scopes.pop()
    return value
  }

  return {withTracking, getTracked}
}

const {withTracking, getTracked} = dependencyTracker()

/**
 * Given a zero-argument function, create a throttled version of that function
 * that will run only once per microtask.
 * @param {() => void} job - the function to perform
 * @returns {() => void} - a throttled version of that function
 */
export const throttled = job => {
  let isScheduled = false

  const perform = () => {
    job()
    isScheduled = false
  }

  const schedule = () => {
    if (!isScheduled) {
      isScheduled = true
      queueMicrotask(perform)
    }
  }

  return schedule
}

/**
 * Create a transaction notification publisher.
 * Allows you to register listeners that are called once during the next
 * transaction.
 */
const transaction = () => {
  /** @type {Set<(() => void)>} */
  let transaction = new Set()

  /**
   * Add listener to current transaction.
   * Listener functions are deduped. E.g. if you add the same listener twice to
   * the same transaction, it's only added once.
   * @param {(() => void)|null} listener
   */
  const withTransaction = listener => {
    if (typeof listener === 'function') {
      transaction.add(listener)
    }
  }

  /**
   * Perform a transaction.
   * Listeners in transaction are notified once and then forgotten.
   */
  const transact = () => {
    // Capture transaction
    const listeners = transaction
    // Create a new transaction. This transaction will gather dependencies
    // queued while executing listeners.
    transaction = new Set()
    // Perform transaction.
    for (const listener of listeners) {
      listener()
    }
    // Listeners are released after scope exits so they can be garbaged.
  }

  return {withTransaction, transact}
}

/**
 * Is value a signal-like function?
 * A signal is any zero-argument function.
 * @template T
 * @param {T|(() => T)} value
 * @returns {boolean}
 */
export const isSignal = value =>
  (typeof value === 'function' && value.length === 0)

/**
 * Sample a value that may be a signal, or just an ordinary value
 * @template T
 * @param {T|(() => T)} value
 * @returns {T}
 */
export const sample = value => {
  // @ts-ignore
  return isSignal(value) ? value() : value
}

/**
 * A signal is a reactive state container. It holds a single value which is
 * updated atomically.
 * 
 * When signal values are read within reactive scopes, such as `computed` or
 * `effect`, the scope will automatically re-execute when the signal changes.
 * 
 * @template T
 * @param {T} initial the initial state for the signal
 * @returns {[() => T, (value: T) => void]}
 */
export const signal = initial => {
  const didChange = transaction()

  let state = initial

  /**
   * Read current signal state
   * When read within reactive scopes, such as `computed` or `effect`,
   * the scope will automatically re-execute when the signal changes.
   * @returns {T}
   */
  const read = () => {
    didChange.withTransaction(getTracked())
    return state
  }

  /**
   * Send new value to signal
   * @param {T} value
   */
  const send = value => {
    if (state !== value) {
      state = value
      didChange.transact()
    }
  }

  return [read, send]
}

/**
 * Create a computed signal
 * Computed sigal takes a zero-argument function, `compute` which may read
 * from any other signal to produce a value.
 * `compute` is executed within a reactive scope, so signals referenced within
 * `compute` will automatically cause `compute` to be re-run when signal
 * state changes.
 * @template T
 * @param {() => T} compute - a function to compute a value. May reference any
 *   other signals.
 * @returns {() => T}
 */
export const computed = compute => {
  const didChange = transaction()

  // We batch recomputes to solve the diamond problem.
  // Every upstream signal read within the computed's tracking scope can
  // independently generate a change notification. This means if two upstream
  // signals change at once, our transaction callback gets called twice.
  // By scheduling batch updates on the next microtask, we ensure that the
  // computed signal is recomputed only once per event loop turn.
  const recompute = throttled(() => {
    const value = withTracking(recompute, compute)
    if (state !== value) {
      state = value
      didChange.transact()
    }
  })

  const read = () => {
    didChange.withTransaction(getTracked())
    return state
  }

  let state = withTracking(recompute, compute)

  return read
}

/**
 * Perform a side-effect whenever signals referenced within `perform` change.
 * `perform` is executed within a reactive scope, so signals referenced within
 * `perform` will automatically cause `perform` to be re-run when signal
 * state changes.
 * @param {() => void} perform - the side-effect to perform
 */
export const effect = perform => {
  const performEffect = throttled(() => {
    withTracking(performEffect, perform)
  })

  withTracking(performEffect, perform)
}

/**
 * @template T
 * @typedef {Promise<T>|T|null} Effect
 */

/**
 * @template State
 * @template Msg
 * @typedef {object} Transaction
 * @property {State} state
 * @property {Array<Effect<Msg>>} effects
 */

/**
 * Create a transaction object for the store.
 * @template State
 * @template Msg
 * @param {State} state
 * @param {Array<Effect<Msg>>} effects
 * @returns {Transaction<State, Msg>}
 */
export const next = (state, effects=[]) => ({state, effects})

/**
 * Create store for state. A web app can centralize all state in a single store,
 * and use Signals to scope store state down to DOM updates.
 * Store is inspired by the Elm App Architecture Pattern.
 * @template State
 * @template Msg
 * @param {object} options
 * @param {() => Transaction<State, Msg>} options.init
 * @param {(state: State, msg: Msg) => Transaction<State, Msg>} options.update
 * @param {boolean} options.debug - turn on debug console logging?
 * @returns {[() => State, (msg: Msg) => void]}
 */
export const store = ({
  init,
  update,
  debug=false
}) => {
  const initial = init()
  if (debug) {
    console.debug('store.state', initial.state)
    console.debug('store.effects', initial.effects.length)
  }

  const [state, sendState] = signal(initial.state)

  const send = msg => {
    const {state: next, effects} = update(state(), msg)
    if (debug) {
      console.debug('store.msg', msg)
      console.debug('store.state', next)
      console.debug('store.effects', effects.length)
    }
    sendState(next)
    runEffects(effects)
  }

  const runEffect = async (effect) => {
    const msg = await effect
    if (msg != null) {
      send(msg)
    }
  }

  const runEffects = effects => effects.forEach(runEffect)

  runEffects(initial.effects)

  return [state, send]
}

/**
 * Log an unknown message and return a no-op transaction. Useful for handling
 * the `default` arm of a switch statement in an update function to catch
 * anything sent to the store that you don't recognize.
 * @template State
 * @template Msg
 * @param {State} state
 * @param {Msg} msg
 * @returns {Transaction<State, Msg>}
 */
export const unknown = (state, msg) => {
  console.warn('Unknown message type', msg)
  return next(state)
}

/**
 * Transform a signal, returning a computed signal that takes values until
 * the given signal returns null. Once the given signal returns null, the
 * signal is considered to be complete and no further updates will occur.
 *
 * This utility is useful for signals representing a child in a dynamic collection
 * of children, where the child may cease to exist.
 * A computed signal looks up the child, returns null if that child no longer
 * exists. This completes the signal and breaks the connection with upstream
 * signals, allowing the child signal to be garbaged.
 * 
 * @template T
 * @param {() => (T|undefined|null)} signalT - a signal
 * @returns {() => T} - a signal that stops listening and changing after
 *   `signalT` returns null.
 */
export const takeValues = signalT => {
  const initial = signalT()

  if (initial == null) {
    throw new TypeError("Signal initial value cannot be null")
  }

  let state = initial
  let isComplete = false

  return computed(() => {
    if (isComplete) {
      return state
    }

    const next = signalT()

    if (next != null) {
      state = next
      return state
    } else {
      isComplete = true
      return state
    }
  })
}