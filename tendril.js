// @ts-check

/** 
 * @typedef {() => void} Cancel - a zero-argument function you can call to
 *   cancel subscription. Expected to be idempotent.
 */

/**
 * @template Value
 * @typedef {() => Value} Peekable - get signal's current value
 */

/**
 * @template Value
 * @typedef {(value: Value) => void} Subscriber - a callback function
 *   that takes a single argument
 */

/**
 * @template Value
 * @typedef {Object} Subscribable
 * @property {(subscriber: Subscriber<Value>) => Cancel} sub - subscribe
 *   to future values, returning a function to cancel the subscription.
 */

/**
 * @template Value
 * @typedef {Peekable<Value> & Subscribable<Value>} SignalValue - the read-only
 *   portion of a signal
 */

/**
 * @template Value
 * @satisfies {Subscribable<Value>}
 */
class Observable {
  /** @type {Set<Subscriber<Value>>} */
  #subscribers = new Set()

  /**
   * Subscribe to this observable
   * @param {Subscriber<Value>} subscriber callback
   * @returns {Cancel} - call to cancel subscription
   */
  sub(subscriber) {
    this.#subscribers.add(subscriber)
    return () => {
      this.#subscribers.delete(subscriber)
    }
  }

  /**
   * Publish a new value
   * @param {Value} value
   */
  pub(value) {
    for (const subscriber of this.#subscribers) {
      subscriber(value)
    }
  }
}

/**
 * Create a new signal, using a stepping function and an initial state.
 * @template Value
 * @param {Value} initial
 * @returns {[SignalValue<Value>, (value: Value) => void]}
 */
export const signal = initial => {
  const subscribers = new Observable()

  let value = initial

  const setValue = next => {
    if (value !== next) {
      value = next
      subscribers.pub(value)
    }
  }

  const getValue = () => value

  getValue.sub = subscriber => {
    subscriber(value)
    return subscribers.sub(subscriber)
  }

  return [getValue, setValue]
}

export const useSignal = signal

/**
 * Create a reducer-style signal.
 * Signal may be updated by sending values to the returned setter. When you
 * set a new value, step is called with the current signal state and
 * the new value, and returns the next state.
 * @template State, Value
 * @param {(state: State, value: Value) => State} step
 * @param {State} initial
 * @returns {[SignalValue<State>, (value: Value) => void]}
 */
export const useReducer = (step, initial) => {
  const [state, setState] = signal(initial)
  const advanceState = value => setState(
    step(state(), value)
  )
  return [state, advanceState]
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
 * Batch cancels together, returning a cancel function that runs them all.
 * Cancels are run once and then removed.
 * @param {Array<Cancel>} cancels
 * @returns {Cancel}
 */
export const batchCancels = cancels => {
  let batch = new Set(cancels)
  return () => {
    for (const cancel of batch) {
      cancel()
    }
    batch.clear()
  }
}

/**
 * Reduced is a sentinal for a completed reduction.
 * Returning reduced from a stepping function will cause `reductions` to
 * automatically cancel its upstream subscription, treating the value of
 * reduced as the final value of the reduction.
 * @template Value
 */
class Reduced {
  /**
   * Create a reduced value
   * @param {Value} value
   */
  constructor(value) {
    this.value = value
  }
}

/**
 * @template State, Value
 * @typedef {(state: State, value: Value) => (State|Reduced<State>)} Step
 *   a stepping function that can be used for `reduce()`
 */

/**
 * Create a new signal by reducing over any subscribable value
 * @template State, Value
 * @param {Step<State, Value>} step
 * @param {Subscribable<Value>} subscribable
 * @param {State} initial
 * @returns {SignalValue<State>}
 */
export const reductions = (step, subscribable, initial) => {
  const [state, setState] = signal(initial)
  const cancel = subscribable.sub(value => {
    let next = step(state(), value)
    // If reduction sent a complete sentinal value, then cancel our subscription
    // and set the completed value as the last published state.
    if (next instanceof Reduced) {
      cancel()
      setState(next.value)
      return
    }
    setState(next)
  })
  setCancel(state, cancel)
  return state
}

/**
 * Transduers over any subscribable value.
 * Inspired by Clojure's tranducers, which implement every collection
 * manipulation function as transformations of the stepping function passed
 * to reduce.
 * Benefits:
 * - You can compose transducer functions
 * - You don't need to create intermediate collections
 * - Every collection operation becomes available if you just implement reduce.
 * @see http://blog.cognitect.com/blog/2014/8/6/transducers-are-coming
 * @see http://bendyworks.com/transducers-clojures-next-big-idea/
 * @see https://www.cs.nott.ac.uk/~pszgmh/fold.pdf
 * @template A, B, C, D
 * @param {(step: Step<C, D>) => Step<A, B>} xf
 * @param {Step<C, D>} step
 * @param {Subscribable<B>} subscribable
 * @param {A} initial
 * @returns {SignalValue<A>}
 */
export const transductions = (xf, step, subscribable, initial) =>
  reductions(xf(step), subscribable, initial)

/**
 * Create a mapping transducer function
 * @template State, Input, Output
 * @param {(input: Input) => Output} transform
 * @returns {(step: Step<State, Output>) => Step<State, Input>}
 */
export const mapping = transform => step => (state, value) =>
  step(state, transform(value))

/**
 * Create a filtering transducer function
 * @template State, Value
 * @param {(input: Value) => Boolean} predicate
 * @returns {(step: Step<State, Value>) => Step<State, Value>}
 */
export const filtering = predicate => step => (state, value) =>
  predicate(value) ? step(state, value) : state

/**
 * Create a take-while transducer function that will take values until the
 * predicate returns false.
 * @template State, Value
 * @param {(input: Value) => Boolean} predicate
 * @returns {(step: Step<State|Reduced<State>, Value>) => Step<(State|Reduced<State>), Value>}
 */
export const takingWhile = predicate => step => (state, value) =>
  predicate(value) ? step(state, value) : new Reduced(state)

/**
 * Step value forward, ignoring state
 * @template Value
 * @param {*} _
 * @param {Value} value
 * @returns {Value}
 */
const stepForward = (_, value) => value

/**
 * Map a signal, observable, or any subscribable value
 * Returns a new signal for the mapped value
 * @template State
 * @template Value
 * @param {Subscribable<Value>} upstream
 * @param {(value: Value) => State} transform
 * @returns {SignalValue<State>}
 */
export const map = (upstream, transform) => {
  let xf = mapping(transform)
  return transductions(xf, stepForward, upstream, null)
}

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
  let [downstream, setDownstream] = signal(resample())

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
  const scheduleResample = async () => {
    if (!isScheduled) {
      isScheduled = true
      await schedule()
      setDownstream(resample())
      isScheduled = false
    }
  }

  const cancel = batchCancels(
    triggers.map(upstream => upstream.sub(scheduleResample))
  )

  setCancel(downstream, cancel)

  return downstream
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
 * @template Value
 * @param {SignalValue<Value>} upstream
 * @returns {SignalValue<Value>}
 */
export const animate = upstream => sampleOn(
  [upstream],
  animationFrame,
  upstream,
)

/**
 * Get object id property
 */
export const getId = x => x.id

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
  for (const value of values) {
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
 * @param {(value: Value) => Key} getKey
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
export const useStore = ({
  init,
  update,
  debug=false
}) => {
  let {state: initial, effects} = init()
  const [state, setState] = useSignal(initial)

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
    for (const effect of effects) {
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
 * @returns {Element} - function to cancel future child renders.
 */
export const list = (parent, states, create) => {
  const cancel = states.sub(() => renderList(parent, states, create))
  setCancel(parent, cancel)
  return parent
}

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
  for (const child of parent.children) {
    const key = child.dataset.key
    childMap.set(key, child)
    if (!states().has(key)) {
      removes.push(child)
    }
  }

  for (const child of removes) {
    // Cancel child subscription and remove
    cancel(child)
    parent.removeChild(child)
  }

  // Add or re-order children as needed.
  let i = 0
  for (const key of states().keys()) {
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

/** @type {Map<string, HTMLTemplateElement>} */
const TEMPLATE_CACHE = new Map()

/**
 * Create or clone a template from a string
 * @param {string} template the HTML template string
 * @returns {DocumentFragment}
 */
const template = template => {
  const templateElement = TEMPLATE_CACHE.get(template)
  if (templateElement != null) {
    // @ts-ignore
    return templateElement.content.cloneNode(true)
  } else {
    const templateElement = document.createElement('template')
    templateElement.innerHTML = template
    TEMPLATE_CACHE.set(template, templateElement)
    // @ts-ignore
    return templateElement.content.cloneNode(true)
  }
}

const TEMPLATE_SIGIL = '🌱TEMPLATE_REPLACEMENT🌱'
const TEMPLATE_SIGIL_COMMENT = `<!--${TEMPLATE_SIGIL}-->`

const isTemplateSigilString = string => string === TEMPLATE_SIGIL_COMMENT

const isTemplateSigilNode = node => (
  node.nodeType === Node.COMMENT_NODE &&
  node.nodeValue === TEMPLATE_SIGIL
)

export class TemplateResult {
  constructor(strings, replacements) {
    this.template = strings.join(TEMPLATE_SIGIL_COMMENT)
    this.replacements = replacements
  }
}

class Tape {
  #index

  constructor(array) {
    this.array = array
    this.#index = 0
  }

  peek() {
    return this.#index
  }

  next() {
    const value = this.array[this.#index]
    this.#index++
    return value
  }
}

export const isTemplateResult = value => value instanceof TemplateResult

export const render = result => {
  const fragment = template(result.template)
  return renderTemplateReplacements(
    fragment,
    new Tape(result.replacements)
  )
}

const renderTemplateReplacements = (subject, tape) => {
  for (const node of subject.childNodes) {
    if (isTemplateSigilNode(node)) {
      replaceElementSigil(node, tape)
      continue
    }
    if (node instanceof Element) {
      replaceAttributeSigils(node, tape)
    }
    if (node.hasChildNodes()) {
      renderTemplateReplacements(node, tape)
    }
    // Select lists "default" selections get out of wack when being moved around
    // inside fragments, this resets them.
    if (node instanceof HTMLOptionElement) {
      node.selected = node.defaultSelected
    }
  }
  return subject
}

const isSpecialAttr = (key, sigil) => key.charAt(0) === sigil
const readSpecialAttr = (key, sigil) =>
  isSpecialAttr(key, sigil) ? key.substring(1) : key

const isEventAttr = key => isSpecialAttr(key, '@')
const readEventAttr = key => readSpecialAttr(key, '@')
const isPropAttr = key => isSpecialAttr(key, '.')
const readPropAttr = key => readSpecialAttr(key, '.')

const replaceAttributeSigils = (subject, tape) => {
  let keys = subject.getAttributeNames()
  for (const key of keys) {
    let value = subject.getAttribute(key)
    if (!isTemplateSigilString(value)) {
      continue
    }
    const replacement = tape.next()
    if (isEventAttr(key)) {
      subject.removeAttribute(key)
      const event = readEventAttr(key)
      subject.addEventListener(event, replacement)
    } else if (isPropAttr(key)) {
      subject.removeAttribute(key)
      let prop = readPropAttr(key)
      subject[prop] = replacement
    } else {
      subject.removeAttribute(key)
      subject.setAttribute(key, replacement)
    }
  }
}

const replaceElementSigil = (subject, tape) => {
  const replacement = tape.next()
  if (isTemplateResult(replacement)) {
    const child = render(replacement)
    subject.parentNode?.replaceChild(child, subject)
  } else {
    const child = document.createTextNode(replacement.toString())
    subject.parentNode?.replaceChild(child, subject)
  }
}

export const html = (strings, ...replacements) =>
  new TemplateResult(strings, replacements)
