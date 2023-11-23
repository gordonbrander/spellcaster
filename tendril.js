// @ts-check

/** 
 * @typedef {() => void} Cancel - call to cancel subscription
 */

/**
 * @template Value
 * @typedef {() => Value} Peekable - get signal's current value
 */

/**
 * @template Value
 * @typedef {Object} Subscribable
 * @property {(subscriber: (value: Value) => void) => Cancel} sub -
 *   subscribe to this signal.
 */

/**
 * @template Value
 * @typedef {Peekable<Value> & Subscribable<Value>} SignalValue
 */

/**
 * @template Value
 * @typedef {[SignalValue<Value>, (value: Value) => void]} Signal
 */

/**
 * Signal - a reactive container for values
 * 
 * @example Create a signal
 * let [value, setValue] = signal(0)
 * 
 * @example Get the current signal value
 * value()
 * 
 * @example Subscribe to current and future values
 * let cancel = value.sub(value => {
 *   // Do something
 * })
 * 
 * @template Value
 * @param {Value} initial - the initial value for the signal
 * @returns {[SignalValue<Value>, (value: Value) => void]} a pair of signal
 *   value and setter function
 */
export const signal = initial => {
  /** @type {Set<((value: Value) => void)>} */
  const subscribers = new Set()

  /** @type {Value} */
  let value = initial

  /** @type {SignalValue<Value>} */
  const get = () => value

  get.sub = subscriber => {
    subscriber(value)
    subscribers.add(subscriber)
    return () => {
      subscribers.delete(subscriber)
    }
  }

  /** @type {(value: Value) => void} */
  const set = next => {
    if (value !== next) {
      value = next
      for (let subscriber of subscribers) {
        subscriber(value)
      }
    }
  }

  return [get, set]
}

/**
 * Create a signal for a value that never changes
 * @template Value
 * @param {Value} value 
 * @returns {SignalValue<Value>}
 */
export const just = value => {
  const [output, _] = signal(value)
  return output
}

/**
 * Batch cancels together, returning a cancel function that runs them all.
 * Cancels are run once and then removed.
 * @param {Array<Cancel>} cancels
 * @returns {Cancel}
 */
export const batchCancels = cancels => {
  let batch = new Set(cancels)
  return () => {
    for (let cancel of batch) {
      cancel()
    }
    batch.clear()
  }
}

/**
 * The cancel symbol
 */
const __cancel__ = Symbol('cancel')

/**
 * Store cancel function on this object
 * @template Subject
 * @param {Subject} object 
 * @param {Cancel} cancel 
 * @returns {Subject}
 */
export const setCancel = (object, cancel) => {
  if (typeof cancel !== 'function') {
    throw new TypeError('cancel must be a function')
  }
  object[__cancel__] = cancel
  return object
}

/**
 * Call cancel function on this object, if it has one
 * @param {Object} cancellable 
 */
export const cancel = cancellable => {
  let cancel = cancellable[__cancel__]
  if (typeof cancel === 'function') {
    cancel()
  }
}

/**
 * @returns {Promise<void>} A promise for the next microtask
 */
export const microtask = () => Promise.resolve()

/**
 * @returns {Promise<Number>} A promise for the next animation frame
 */
export const animationFrame = () => new Promise(requestAnimationFrame)

/**
 * Sample values via closure by watching a list of trigger signals.
 * Samples are throttled using `schedule`, which returns a promise for
 * an interval on which we should sample.
 * @example sample the sum of x and y whenever either changes
 * let sum = sample([x, y], () => x() + y())
 * @template Value
 * @param {Array<SignalValue<Value>>} triggers
 * @param {() => Promise<any>} schedule
 * @param {() => Value} resample
 * @returns {SignalValue<Value>}
 */
export const sampleOn = (
  triggers,
  schedule,
  resample
) => {
  const [downstream, setDownstream] = signal(resample())

  // Batch samples to prevent the "diamond problem".
  // Diamond problem: if multiple upstream triggers are derived from the
  // same source, you'll get two events for every event on source.
  // Example: Signal A has two signals derived from it: B and C.
  // D samples on B and C. When A publishes, B and C both publish. D receives
  // two events, one after the other, resulting in two different sample values,
  // one after the other.
  //
  // Batching solves the problem by only sampling once per microtask, using
  // on the last event for that microtask. You'll only sample once.
  let isScheduled = false
  const scheduleResampleAndSetDownstream = async () => {
    if (!isScheduled) {
      isScheduled = true
      await schedule()
      setDownstream(resample())
      isScheduled = false
    }
  }  

  const cancels = triggers.map(
    upstream => upstream.sub(scheduleResampleAndSetDownstream)
  )

  setCancel(downstream, batchCancels(cancels))

  return downstream
}

/**
 * Sample values via closure by watching a list of trigger signals.
 * Samples are throttled to one-per-event-loop-tick.
 * @template Value
 * @param {Array<SignalValue<Value>>} triggers
 * @param {() => Value} resample
 * @returns {SignalValue<Value>}
 */
export const sample = (triggers, resample) => sampleOn(
  triggers,
  microtask,
  resample
)

/**
 * Throttle a signal, returning a new signal that updates only once per
 * Samples are throttled to one-per-event-loop-tick.
 * @template Value
 * @param {SignalValue<Value>} upstream
 * @returns {SignalValue<Value>}
 */
export const throttle = upstream => sampleOn(
  [upstream],
  microtask,
  upstream
)

/**
 * Throttle a signal, returning a new signal that updates only once per
 * animation frame.
 */
export const animate = upstream => sampleOn(
  [upstream],
  animationFrame,
  upstream,
)

/**
 * Reduced represents a sentinal for a completed operation.
 * We use this as a sentinal for signal subscriptions to cancel themselves.
 * @template Value
 */
class Complete {
  /**
   * Create a reduced value
   * @param {Value} value
   */
  constructor(value) {
    this.value = value
  }
}

/**
 * Create a reduced value.
 * Reduced represents a sentinal for a completed reduction.
 */
export const complete = value => new Complete(value)

/**
 * Reduce (fold) over a signal, returning a new signal who's values are the
 * set at each step of the reduction.
 * @template Value
 * @template Result
 * @param {SignalValue<Value>} upstream
 * @param {(result: Result, value: Value) => (Result|Complete<Result>)} step
 * @param {Result} initial
 * @returns {SignalValue<Result>}
 */
export const reductions = (step, upstream, initial) => {
  const [downstream, setDownstream] = signal(initial)

  const cancel = upstream.sub(
    value => {
      let next = step(downstream(), value)
      if (next instanceof Complete) {
        cancel()
        setDownstream(next.value)
      } else {
        setDownstream(next)
      }
    }
  )

  setCancel(downstream, cancel)

  return downstream
}

/**
 * Transducers version of reductions.
 * 
 * It is possible implement every other collection operation in terms of
 * reduce. Transducers leverage this fact to provide every collection
 * operation as a higher-level transformation of the stepping function.
 * Benefits:
 * - You can compose transducer functions
 * - You don't need to create intermediate collections
 * - Every collection operation can be had if you just implement reduce.
 * 
 * @see http://blog.cognitect.com/blog/2014/8/6/transducers-are-coming
 * @see http://bendyworks.com/transducers-clojures-next-big-idea/
 * @see https://www.cs.nott.ac.uk/~pszgmh/fold.pdf
 */
export const transductions = (xf, step, upstream, initial) =>
  reductions(xf(step), upstream, initial)

/**
 * Create a mapping reducer function
 */
export const mapping = transform => step => (state, value) =>
  step(state, transform(value))

const stepForward = (_, next) => next

  /**
 * @template Value
 * @template MappedValue
 * @param {SignalValue<Value>} upstream
 * @param {(value: Value) => MappedValue} transform 
 * @returns {SignalValue<MappedValue>}
 */
export const map = (upstream, transform) =>
  transductions(mapping(transform), stepForward, upstream, null)

/**
 * Create a filtering reducer function
 */
export const filtering = predicate => step => (state, value) =>
  predicate(value) ? step(state, value) : state

const getId = x => x.id

/**
 * Index an array to a `Map` by key, using `getKey`.
 * Maps retain order of insertion, making them an efficient data structure
 * for ordered items with IDs, when you're doing frequent lookups.
 * @template Key
 * @template Value
 * @param {Array<Value>} values - an array of values with a unique key
 * @param {(value: Value) => Key} getKey - a function to get a unique key from
 *   the value
 * @returns {Map<Key, Value>}
 */
export const index = (values, getKey=getId) => {
  let indexed = new Map()
  for (let value of values) {
    let key = getKey(value)
    indexed.set(key, value)
  }
  return indexed
}

/**
 * Create an index signal from an array signal.
 * Items in the array are indexed by ID, as defined by `getId`.
 * 
 * When creating a cursor into an array, it can be more efficient to first
 * create an `indexed` signal, so that cursor lookups are done by key `O(1)`
 * rather than by iterating over whole list `O(n)`.
 * 
 * @template Key
 * @template Value
 * @param {SignalValue<Array<Value>>} items
 * @param {(Value) => Key} getKey
 * @returns {SignalValue<Map<Key, Value>>}
 */
export const indexed = (items, getKey=getId) =>
  map(items, items => index(items, getKey))

/**
 * @template State
 * @template Msg
 * @typedef Transaction
 * @property {State} state
 * @property {Array<(Promise<Msg>|Msg)>} effects
 */

/**
 * Create a state transaction for a store
 * @template State
 * @template Msg
 * @param {State} state 
 * @param {Array<(Msg|Promise<Msg>)>} effects 
 * @returns {Transaction<State, Msg>}
 */
export const next = (state, effects=[]) => ({state, effects})

/**
 * Create a store
 * A store is a repository of state that can be updated by sending messages.
 * Store also manages asynchronous side effects, modeled as promises for more
 * messages.
 * 
 * `init` and `update` both return transactions, an object containing a new
 * `state`, as well as an array of promises representing side-effects.
 * 
 * Store is inspired by the the Elm Architecture pattern. It offers a
 * predictable and centralized way to manage both application state and
 * side-effects such as HTTP requests and database calls.
 * 
 * @template State
 * @template Msg
 * @param {object} options
 * @param {() => Transaction<State, Msg>} options.init
 * @param {(state: State, msg: Msg) => Transaction<State, Msg>} options.update
 * @param {boolean} options.debug - toggle debug logging
 * @returns {[SignalValue<State>, (Msg) => void]} a signal value and
 *   send function.
 */
export const store = ({
  init,
  update,
  debug=false
}) => {
  let {state: initial, effects} = init()
  const [state, setState] = signal(initial)

  /**
   * @param {Promise<Msg>|Msg} effect
   */
  const run = async (effect) => send(await effect)

  /**
   * 
   * @param {Msg} msg 
   */
  const send = msg => {
    if (debug) {
      console.debug("store.msg", msg)
    }
    let {state: next, effects} = update(state(), msg)
    setState(next)
    for (let effect of effects) {
      run(effect)
    }
  }

  return [state, send]
}

/**
 * Handle an unknown message by logging a warning and returning a transaction
 * which does not change state.
 * @template State
 * @template Msg
 * @param {State} state 
 * @param {Msg} msg 
 * @returns 
 */
export const unknown = (state, msg) => {
  console.warn('Unknown message type. Ignoring.', msg)
  return next(state)
}

/**
 * Render a dynamic list of children on a parent.
 * @template Key
 * @template State
 * @param {SignalValue<Map<Key, State>>} states - a signal for a map of
 *   children to render
 * @param {Element} parent
 * @param {(state: State) => (Element|string)} create - a function to create
 *   new children. Children are created once for each key. All updates to
 *   children happen through signals passed to child.
 * @returns {Cancel} - function to cancel future child renders.
 */
export const list = (states, parent, create) => 
  states.sub(() => renderList(parent, states, create))

const renderList = (
  parent,
  states,
  create
) => {
  // Remove children that are no longer part of state
  // Note that we must construct a list of children to remove, since
  // removing in-place would change the live node list and bork iteration.
  let childMap = new Map()
  let removes = []
  for (let child of parent.children) {
    const key = child.dataset.key
    childMap.set(key, child)
    if (!states().has(key)) {
      removes.push(child)
    }
  }

  for (let child of removes) {
    // Cancel child subscription and remove
    cancel(child)
    parent.removeChild(child)
  }

  // Add or re-order children as needed.
  let i = 0
  for (let key of states().keys()) {
    let child = childMap.get(key)
    if (child == null) {
      const state = map(states, index => index.get(key))
      const child = create(state)
      setCancel(child, () => cancel(state))
      child.dataset.key = key
      insertElementAt(parent, child, i)
    } else {
      insertElementAt(parent, child, i)
    }
    i = i + 1
  }
}

/**
 * Insert element at index.
 * If element is already at index, this function is a no-op
 * (it doesn't remove-and-then-add element). By avoiding moving the element
 * unless needed, we preserve focus and selection state for elements that
 * don't move.
 * @param {HTMLElement} parent - the parent element to insert child into
 * @param {HTMLElement} element - the child element to insert
 * @param {number} index - the index at which to insert element
 */
export const insertElementAt = (parent, element, index) => {
  let elementAtIndex = parent.children[index]
  if (elementAtIndex === element) {
    return
  }
  parent.insertBefore(element, elementAtIndex)
}

let _cid = 0

/**
 * Create an auto-incrementing client ID.
 * ID is unique for a given page refresh, but should not be persisted.
 * @returns {string} a client ID
 */
export const cid = () => `cid${_cid++}`