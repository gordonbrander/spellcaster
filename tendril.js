const set = (object, key, value) => {
  object[key] = value
  return object
}

/**
 * Transform a thunk so that it runs only once per microtask, no matter how
 * often it is called.
 */
export const batchScheduler = (callback, queue=queueMicrotask) => {
  let isScheduled = false
  let value = null
  
  const performBatch = () => {
    callback(value)
    isScheduled = false
  }

  const schedule = next => {
    if (!isScheduled) {
      isScheduled = true
      queue(performBatch)
    }
    value = next
  }

  return schedule
}

const transactionManager = () => {
  const queue = []

  const transact = () => {
    let i = 0
    while (i < queue.length) {
      const job = queue[i]
      job()
      i++
    }
    queue.length = 0
  }

  const scheduleTransaction = batchScheduler(transact)

  const withTransaction = job => {
    scheduleTransaction()
    queue.push(job)
  }

  return withTransaction
}

/**
 * Perform callback with the next transaction
 */
export const withTransaction = transactionManager()

/**
 * Symbol key for tags. We use tags as a userspace version of types.
 */
export const __tag__ = Symbol('tag')

/**
 * Tag a value, marking it as belonging to some kind.
 */
export const tag = (object, tag) => set(object, __tag__, tag)

/**
 * Check if value has been tagged with `tag`.
 */
export const isTagged = (object, tag) => object[__tag__] === tag

/**
 * Sentinal value for ending a stream/publisher
 */
export const __complete__ = Symbol('complete')

/**
 * Box a value in the sentinal type `complete`.
 */
export const complete = value => tag({value}, __complete__)

/**
 * Is value a complete sentinal value?
 */
export const isComplete = value => isTagged(value, __complete__)

/**
 * Unwrap a value if it is a complete sentinal value,
 * or else just return the value.
 */
export const unwrapComplete = value => isComplete(value) ? value.value : value

export const wrapComplete = value => isComplete(value) ? value : complete(value)

/**
 * Symbol for tagging a signal
 */
export const __signal__ = Symbol('signal')

/**
 * Is value a signal?
 */
export const isSignal = value => isTagged(value, __signal__)

/**
 * Default callback that does nothing.
 */
export const noOp = () => {}

const freeze = Object.freeze

/**
 * A signal is a reactive state container. It holds a single value which is
 * updated atomically.
 *
 * Consumers may subscribe to signal update events with the `listen()`
 * method, or read the current value of the signal by calling it as a function.
 *
 * All signal states update together during an atomic transaction. Listeners
 * receive the next state for the signal before it is set. Sampling signals
 * in a listener will always give the current value of the signal before the
 * transaction takes place. This ensures all listeners have a consistent view
 * of signal state.
 */
export const useSignal = (initial) => {
  const listeners = new Set()

  let state = unwrapComplete(initial)
  let hasCompleted = isComplete(initial)

  /**
   * Read current signal state
   */
  const readSignal = () => state

  /**
   * Subscribe to a signal with a listener callback.
   * Fires once immediately with current value, and then for subsequent values.
   * Returns a function which may be called to cancel the subscription.
   */
  readSignal.listen = listener => {
    listener(state)
    if (hasCompleted) {
      return noOp
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  tag(readSignal, __signal__)

  /**
   * Send new value to signal
   */
  const sendSignal = value => {
    if (hasCompleted) {
      return
    }
    if (state !== value) {
      // Notify listeners immediately
      for (const listener of listeners) {
        listener(value)
      }
      if (isComplete(value)) {
        hasCompleted = true
        listeners.clear()
      }
      // Update state during the next transaction. This ensures state updates
      // are atomic and listeners can never observe inconsistent state.
      // To a listener, all state stays the same. You're always observing
      // the state *before* it changes.
      withTransaction(() => state = unwrapComplete(state))
    }
  }

  return [freeze(readSignal), sendSignal]
}

/**
 * Create a constant signal - a signal for a value that never changes.
 * Signal completes immediately.
 * @template Value
 * @param {Value} value - the value for constant
 * @returns {Signal<Value>}
 */
export const constant = value => {
  const [$value, _] = useSignal(complete(value))
  return $value
}

/**
 * Box a value in a constant signal if it is not already a signal.
 */
export const wrapSignal = value => isSignal(value) ? value : constant(value)

/**
 * Create a callback that handles values and end using separate
 * callback functions.
 * @returns {(value) => void} a listener callback
 */
export const subscriber = ({onValue=noOp, onComplete=noOp}) => value => {
  if (isComplete(value)) {
    onComplete(value.value)
    return
  }
  onValue(value)
}

/**
 * Batch multiple cancel functions into a single function
 */
export const batchCancels = (...cancels) => {
  return () => {
    for (const cancel of cancels) {
      cancel()
    }
    cancels.length = 0
  }
}

export const __cancel__ = Symbol('cancel')

export const setCancel = (object, cancel) => set(object, __cancel__, cancel)

export const cancel = object => {
  const cancel = object[__cancel__]
  if (typeof cancel === 'function') {
    cancel()
  }
}

/**
 * Reduce over a signal, creating a new signal.
 * Each update to the upstream signal will call `step` with the previous state
 * and the new usptream signal value, producing a new state on the returned
 * signal.
 */
export const reductions = ($upstream, step, seed) => {
  const [$downstream, sendDownstream] = useSignal(seed)
  const cancel = $upstream.listen(value => {
    if (isComplete(value)) {
      const state = step($downstream(), value.value)
      sendDownstream(wrapComplete(state))
    } else {
      const state = step($downstream(), value)
      // If the stepping function returns a complete, cancel our upstream
      // subscription. We're done.
      if (isComplete(state)) {
        cancel()
      }
      sendDownstream(state)
    }
  })
  return $downstream
}

/** Synonym for reductions */
export const scan = reductions

/**
 * Map signal, returning a new signal of the transformed values.
 */
export const map = ($upstream, transform) => reductions(
  $upstream,
  (state, value) => transform(value),
  transform($upstream())
)

/**
 * Filter signal updates.
 * First value will always be included. Future updates will be ignored if they
 * do not pass predicate.
 */
export const filter = ($upstream, predicate) => reductions(
  $upstream,
  (state, value) => {
    if (predicate(value)) {
      return value
    }
    return state
  },
  $upstream()
)

/**
 * Take updates until predicate returns false.
 */
export const takeWhile = ($upstream, predicate) => reductions(
  $upstream,
  (state, value) => {
    if (predicate(value)) {
      return value
    }
    return complete(state)
  },
  $upstream()
)

/**
 * Scope a signal, returning a new signal that will end either when upstream
 * ends, or when `transform()` returns `null`.
 */
export const compactMap = ($upstream, transform, initial) => reductions(
  $upstream,
  (state, value) => {
    const transformed = transform(value)
    return transformed ?? state
  },
  initial
)

export const getId = item => item.id

/**
 * Index an array of identified items by key.
 * Since maps are iterated in insertion order, we index once and then
 * have an ordered keyed collection we can do efficient lookups over.
 * Useful for modeling child views.
 * @template Key
 * @template Item
 * @param {Iterable<Item>} items 
 * @param {(item: Item) => Key} getKey 
 * @returns {Map<Key, Item>} the indexed items
 */
export const index = (items, getKey=getId) => {
  const indexedItems = new Map()
  for (const item of items) {
    indexedItems.set(getKey(item), item)
  }
  return indexedItems
}

/**
 * Index a signal of iterables by key, returning a signal of `Map`.
 */
export const indexed = ($upstream, getKey=getId) => map(
  $upstream,
  iterable => index(iterable, getKey)
)

/**
 * Batch signal on some queue
 */
const batchStreamOn = ($upstream, queue) => {
  const [$downstream, sendDownstream] = useSignal($upstream())
  const transact = batchScheduler(sendDownstream, queue)
  $upstream.listen(transact)
  return $downstream
}

/**
 * Batch signal on microtask
 */
export const batch = $upstream => batchStreamOn($upstream, queueMicrotask)

/**
 * Batch signal on animation frame
 */
export const animate = $upstream =>
  batchStreamOn($upstream, requestAnimationFrame)

/**
 * Given two values, choose the next one.
 */
export const pair = (left, right) => [left, right]

/**
 * Merge two streams, using `combine` to merge signal values into a
 * single value.
 */
export const merge = ($left, $right, combine=pair) => {
  let leftState = $left()
  let rightState = $right()
  let endCount = 0

  const [$downstream, sendDownstream] = useSignal(
    combine(leftState, rightState)
  )

  $left.listen(
    subscriber({
      onValue: left => {
        leftState = left
        sendDownstream(combine(leftState, rightState))
      },
      onComplete: left => {
        endCount++
        leftState = left
        const next = combine(leftState, rightState)
        sendDownstream(endCount > 1 ? wrapComplete(next) : next)
      }
    })
  )

  $right.listen(
    subscriber({
      onValue: right => {
        rightState = right
        sendDownstream(combine(leftState, rightState))
      },
      onComplete: right => {
        endCount++
        rightState = right
        const next = combine(leftState, rightState)
        sendDownstream(endCount > 1 ? wrapComplete(next) : next)
      }
    })
  )

  return batch($downstream)
}

/**
 * Create store for state. A web app can centralize all state in a single store,
 * and use Signals to scope store state down to DOM updates.
 * Store is inspired by the Elm App Architecture Pattern.
 * @returns {[Signal<State>, (msg: Msg) => void]}
 */
export const useStore = ({
  init,
  update,
  debug=false
}) => {
  const initial = init()
  if (debug) {
    console.debug('useStore.state', initial.state)
    console.debug('useStore.effects', initial.effects.length)
  }

  const [$state, sendState] = useSignal(initial.state)

  const send = msg => {
    const {state: next, effects} = update($state(), msg)
    if (debug) {
      console.debug('useStore.msg', msg)
      console.debug('useStore.state', next)
      console.debug('useStore.effects', effects.length)
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

  return [$state, send]
}

/**
 * Create a transaction object for the store.
 */
export const next = (state, effects=[]) => ({state, effects})

/**
 * Log an unknown message and return a no-op transaction. Useful for handling
 * the `default` arm of a switch statement in an update function to catch
 * anything sent to the store that you don't recognize.
 */
export const unknown = (state, msg) => {
  console.warn('Unknown message type', msg)
  return next(state)
}

const applyTo = (value, fn) => fn(value)

/**
 * Pipe a value through multiple functions, from left to right.
 */
export const pipe = (value, ...fns) => fns.reduce(applyTo, value)

/**
 * Compose multiple one-argument functions into a single function.
 * Functions are executed in order of right to left.
 */
export const compose = (...fns) => value => fns.reduceRight(applyTo, value)