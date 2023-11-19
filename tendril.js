// @ts-check

/**
 * Create a one-to-many publisher
 * @template Value - the type of value to publish
 */
export class Publisher {
  /** @type {Set<(Value) => void>} */
  #subscribers = new Set()

  /**
   * Remove all subscribers
   */
  clear() {
    this.#subscribers.clear()
  }

  /**
   * Publish a value to subscribers
   * @param {Value} value - the value to publish
   */
  pub(value) {
    for (let subscriber of this.#subscribers) {
      subscriber(value)
    }
  }

  /**
   * Subscribe to future updates
   * Returns a "cancellable", a function that can be called to cancel
   * the subscription.
   * @param {(value: Value) => void} subscriber
   * @returns {() => void}
   */
  sub(subscriber) {
    this.#subscribers.add(subscriber)
    return () => {
      this.#subscribers.delete(subscriber)
    }
  }
}

/** 
 * @typedef {() => void} Cancel - call to cancel subscription
 */

/**
 * @template Value
 * @typedef {() => Value} Peekable
 */

/**
 * @template Value
 * @typedef {Object} Subscribable
 * @property {(subscriber: (value: Value) => void) => Cancel} sub -
 *   subscribe to this value.
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
 * @returns {[SignalValue<Value>, (value: Value) => void]}
 */
const signal = initial => {
  const subscribers = new Publisher()

  let value = initial

  /**
   * @type {SignalValue<Value>}
   */
  const get = () => value

  /**
   * @type {(subscriber: (value: Value) => void) => Cancel}
   */
  get.sub = subscriber => {
    subscriber(value)
    return subscribers.sub(subscriber)
  }

  /** @type {(value: Value) => void} */
  const set = next => {
    if (value !== next) {
      value = next
      subscribers.pub(value)
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
  const [$value, _] = signal(value)
  return $value
}

/**
 * Batch cancels together, returning a cancel function that runs them all.
 * Cancels are run once and then removed.
 * @param {Array<() => void>} cancels
 * @returns {() => void}
 */
export const batchCancel = cancels => {
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
 * @param {*} cancellable 
 */
export const cancel = cancellable => {
  let cancel = cancellable[__cancel__]
  if (typeof cancel == 'function') {
    cancel()
  }
}

/**
 * Create a computed signal by watching a group of signals
 * @example
 * let sum = computed([x, y], () => x.value + y.value)
 * @template Value
 * @param {Array<SignalValue<Value>>} dependencies
 * @param {() => Value} compute
 * @returns {SignalValue<Value>}
 */
export const computed = (dependencies, compute) => {
  const [downstream, setDownstream] = signal(compute())

  const recomputeDownstream = () => setDownstream(compute())

  let cancels = dependencies.map(
    upstream => upstream.sub(recomputeDownstream)
  )

  downstream[__cancel__] = batchCancel(cancels)

  return downstream
}

/**
 * Fold (reduce) over a signal
 * @template Value
 * @template Result
 * @param {SignalValue<Value>} upstream
 * @param {(result: Result, value: Value) => Result} step
 * @param {Result} initial
 * @returns {SignalValue<Result>}
 */
export const fold = (upstream, step, initial) => {
  const [downstream, setDownstream] = signal(step(initial, upstream()))

  const cancel = upstream.sub(
    value => setDownstream(step(downstream(), value))
  )

  setCancel(downstream, cancel)

  return downstream
}

export const mapping = transform => (_, next) => transform(next)

/**
 * @template Value
 * @template MappedValue
 * @param {SignalValue<Value>} upstream
 * @param {(value: Value) => MappedValue} transform 
 * @returns {SignalValue<MappedValue>}
 */
export const map = (upstream, transform) =>
  fold(upstream, mapping(transform), null)

/**
 * Debounce a signal, returning a new signal that updates only once per
 * animation frame.
 */
export const debounce = (upstream, subscribe) => {
  const [downstream, setDownstream] = signal(upstream.value)

  let state = downstream()

  const cancel = upstream.sub(value => {
    // Set the state for every value
    state = value
    // Request an animation frame for every value.
    // Every request will fire, but because signal does not publish duplicate
    // values, we'll get only one update per frame.
    requestAnimationFrame(() => setDownstream(state))
  })

  setCancel(downstream, cancel)

  return downstream
}

const getId = x => x.id

/**
 * Index an array to a `Map` by key, using `getKey`.
 * Maps retain order of insertion, making them an efficient data structure
 * for ordered items with IDs, when you're doing frequent lookups.
 */
export const index = (items, getKey=getId) => {
  let indexed = new Map()
  for (let item of items) {
    let id = getId(item)
    indexed.set(id, item)
  }
  return Object.freeze(indexed)
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
 * @param {Array<(Promise<Msg>|Msg)>} effects 
 * @returns {Transaction<State, Msg>}
 */
export const next = (state, effects=[]) => ({state, effects})

/**
 * Create a store
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

  const runEffects = effects => {
    for (let effect of effects) {
      effect.then(send)
    }
  }

  const send = msg => {
    if (debug) {
      console.debug("store.msg", msg)
    }
    let {state: next, effects} = update(state(), msg)
    setState(next)
    runEffects(effects)
  }

  return [state, send]
}

export const unknown = (state, msg) => {
  console.warn('Unknown message type. Ignoring.', msg)
  return next(state)
}

/**
 * Render `state` signal to parent.
 * @template Key
 * @template State
 * @param {SignalValue<Map<Key, State>>} states
 * @param {Element} parent
 * @param {(state: State) => (Element|string)} create
 * @returns {Cancel}
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
    // Cancel subscription and remove
    child.cancel()
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
 * Create an auto-incrementing client ID
 */
export const cid = () => `cid${_cid++}`