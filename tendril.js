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

const dependencyTracker = () => {
  const scopes = []

  const getTracked = () => scopes.at(-1)

  const withTracking = (onChange, callback) => {
    scopes.push(onChange)
    const value = callback()
    scopes.pop()
    return value
  }

  return {withTracking, getTracked}
}

const {withTracking, getTracked} = dependencyTracker()

let _cid = 0

export const cid = () => `cid${_cid++}`

const notification = () => {
  const listeners = new Set()
  const id = cid()

  const listenOnce = listener => {
    if (typeof listener === 'function') {
      listeners.add(listener)
      console.log("listenOnce", id, Array.from(listeners))
    }
  }

  const dispatch = () => {
    for (const listener of listeners) {
      // We dispatch listener with next microtask. Otherwise gathered
      // dependencies would be added in the loop, causing them to be
      // cleared after loop exits.
      queueMicrotask(listener)
    }
    console.log("dispatch", id, Array.from(listeners))
    listeners.clear()
  }

  return {listenOnce, dispatch}
}

/**
 * Is value a cell-like function?
 */
export const isCell = value =>
  (typeof value === 'function' && value.length === 0)

export const sample = value => isCell(value) ? value() : value

/**
 * A cell is a reactive state container. It holds a single value which is
 * updated atomically.
 *
 * Consumers may subscribe to cell update events with the `listen()`
 * method, or read the current value by calling it as a function.
 */
export const useCell = initial => {
  const didChange = notification()

  let state = initial

  /**
   * Read current signal state
   */
  const read = () => {
    didChange.listenOnce(getTracked())
    return state
  }

  /**
   * Send new value to signal
   */
  const send = value => {
    if (state !== value) {
      state = value
      didChange.dispatch()
    }
  }

  return [read, send]
}

export const useComputed = compute => {
  const didChange = notification()
  const schedule = batchScheduler()

  const recompute = () => {
    const value = withTracking(scheduleRecompute, compute)
    if (state !== value) {
      state = value
      didChange.dispatch()
    }
  }

  const scheduleRecompute = () => schedule(recompute)

  const read = () => {
    didChange.listenOnce(getTracked())
    return state
  }

  let state = withTracking(scheduleRecompute, compute)

  return read
}

export const useEffect = run => {
  const performTrackedEffect = () => {
    withTracking(performTrackedEffect, run)
  }
  withTracking(performTrackedEffect, run)
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

  const [state, sendState] = useCell(initial.state)

  const send = msg => {
    const {state: next, effects} = update(state(), msg)
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

  return [state, send]
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


export const takeWhileValue = cell => {
  let state = cell()
  let isComplete = false

  return useComputed(() => {
    if (isComplete) {
      return state
    }

    const next = cell()

    if (next != null) {
      state = next
      return state
    } else {
      isComplete = true
      return state
    }
  })
}