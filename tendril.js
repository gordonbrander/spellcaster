/**
 * Create a batch scheduler that will run the last callback that is scheduled.
 */
export const batchScheduler = (queue=queueMicrotask) => {
  let isScheduled = false
  let job = null
  
  const performBatch = () => {
    if (job != null) {
      job()
    }
    isScheduled = false
  }

  const schedule = callback => {
    if (!isScheduled) {
      isScheduled = true
      queue(performBatch)
    }
    job = callback
  }

  return schedule
}

const stepForward = (prev, next) => next

const keyedQueue = () => {
  const queue = new Map()

  const drain = perform => {
    for (const key of queue.keys()) {
      const value = queue.get(key)
      perform(key, value)
    }
    queue.clear()
  }

  const enqueue = (key, value, choose=stepForward) => {
    const prev = queue.get(key)
    if (prev != null) {
      queue.set(key, choose(prev, value))
    } else {
      queue.set(key, value)
    }
  }

  return {enqueue, drain}
}

const apply = (fn, value) => fn(value)

const transactionManager = () => {
  const writes = keyedQueue()
  const reads = keyedQueue()

  const transact = () => {
    writes.drain(apply)
    reads.drain(apply)
  }

  const schedule = batchScheduler()

  const withQueue = enqueue => (callback, value, choose=stepForward) => {
    schedule(transact)
    enqueue(callback, value, choose)
  }

  return {
    withWrites: withQueue(writes.enqueue),
    withReads: withQueue(reads.enqueue)
  }
}

const {withWrites, withReads} = transactionManager()

const set = (object, key, value) => {
  object[key] = value
  return object
}

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
 * Default callback that does nothing.
 */
export const noOp = () => {}

/**
 * Symbol for tagging a cell
 */
export const __cell__ = Symbol('cell')

const __changes__ = Symbol('changes')

/**
 * Is value a signal?
 */
export const isCell = value => isTagged(value, __cell__)

/**
 * A cell is a reactive state container. It holds a single value which is
 * updated atomically.
 *
 * Consumers may subscribe to cell update events with the `listen()`
 * method, or read the current value by calling it as a function.
 */
export const useCell = (initial, choose=stepForward) => {
  const listeners = new Set()

  let state = initial

  /**
   * Read current signal state
   */
  const read = () => state
  tag(read, __cell__)

  /*
   * Get notified immediately of cell changes.
   * This method does not uphold atomicity. It is used as an operational
   * primitive to implement APIs that do uphold atomicity.
   */
  const listen = listener => {
    listener(state)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  /**
   * Listen for *immediate* cell changes.
   * This method is notified immediately and does not uphold state atomicity.
   * It's used as an operational primitive to implement other APIs that do
   * uphold atomicity.
   *
   * Prefer `listen()` unless you have a specific reason to bypass the
   * transaction system.
   */
  read[__changes__] = listen

  /**
   * Listen for cell changes.
   * Fires with reads, upholding atomicity.
   */
  read.listen = listener => listen(
    value => withReads(listener, value, choose)
  )

  const setState = value => {
    state = value
    // Notify listeners immediately
    for (const listener of listeners) {
      listener(state)
    }
  }

  /**
   * Send new value to signal
   */
  const send = value => {
    if (state !== value) {
      // Update state during the next transaction. This ensures state updates
      // are atomic and listeners can never observe inconsistent state.
      withWrites(setState, value)
    }
  }

  return [read, send]
}

export const reductions = (upstream, step, seed) =>
  listener => {
    let state = seed
    return upstream(value => {
      state = step(state, seed)
      listener(state)
    })
  }

export const map = (upstream, transform) =>
  listener => upstream(value => listener(transform(value)))

export const filter = (upstream, predicate) =>
  listener => upstream(value => {
    if (predicate(value)) {
      listener(value)
    }
  })

export const filterMap = (upstream, transform) =>
  listener => upstream(value => {
    const next = transform(value)
    if (next != null) {
      listener(next)
    }
  })

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
export const indexIter = (items, getKey=getId) => {
  const indexedItems = new Map()
  for (const item of items) {
    indexedItems.set(getKey(item), item)
  }
  return indexedItems
}

/**
 * Index a stream of iterables by key, returning a stream of `Map`.
 */
export const index = (upstream, getKey=getId) => map(
  upstream,
  iterable => indexIter(iterable, getKey)
)

/**
 * Create a cell from a stream and an initial value.
 */
export const hold = (stream, initial) => {
  const [$state, sendState] = useCell(initial)
  const cancel = stream(sendState)
  setCancel($state, cancel)
  return $state
}

/**
 * Create a constant cell - a cell for a value that never changes.
 * @template Value
 * @param {Value} value - the value for constant
 * @returns {Cell<Value>}
 */
export const constant = value => {
  const [$value, _] = useCell(value)
  return $value
}

/**
 * Box a value in a constant cell if it is not already a cell.
 */
export const wrapCell = value => isCell(value) ? value : constant(value)

/**
 * filterMap a cell, returning a cell of states that are not null.
 */
export const scope = (
  $cell,
  transform,
  initial=transform($cell())
) => hold(
  filterMap($cell[__changes__], transform),
  initial
)

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

export const getId = item => item.id

/**
 * Batch signal on some queue
 */
const batchWith = (upstream, queue=queueMicrotask) => listener => {
  const schedule = batchScheduler(queue)
  upstream(value => schedule(() => listener(value)))
}

/**
 * Batch signal on microtask
 */
export const batch = upstream => batchWith(upstream, queueMicrotask)

/**
 * Batch signal on animation frame
 */
export const animate = upstream => batchWith(upstream, requestAnimationFrame)

/**
 * Given two values, choose the next one.
 */
export const pair = (left, right) => [left, right]

/**
 * Merge two cells, using `combine` to merge values into a single value.
 */
export const merge = ($left, $right, combine=pair) => {
  const [$downstream, sendDownstream] = useCell(combine($left(), $right()))

  const listen = () => sendDownstream(combine($left(), $right()))

  const cancelLeft = $left[__changes__](listen)
  const cancelRight = $right[__changes__](listen)
  const cancel = batchCancels(cancelLeft, cancelRight)

  return [$downstream, cancel]
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

  const [$state, sendState] = useCell(initial.state)

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