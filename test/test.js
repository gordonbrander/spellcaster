import { describe, it } from "mocha"
import { strict as assert, strictEqual as assertEqual, fail } from "assert"

import {
  withTracking,
  getTracked,
  throttled,
  transaction,
  signal,
  effect,
  computed,
  store,
  fxware,
  middleware,
  isSignal,
  sample,
  takeValues
} from "../dist/spellcaster.js"

const delay = (value, ms) => new Promise(resolve => {
  setTimeout(
    () => resolve(value),
    ms
  )
})

describe('withTracking', () => {
  it('executes the body function immediately and returns the value', () => {
    const onChange = () => {}

    const didExecute = withTracking(
        onChange,
        () => true
    )
    assert(didExecute)
  })

  it('sets the dependency for the tracking scope', done => {
    const onChange = () => {}

    withTracking(
      onChange,
      () => {
        const dependency = getTracked()
        assert(dependency === onChange)
        done()
      }
    )
  })
})

describe('getTracked', () => {
  it('returns undefined outside of tracking scopes', () => {
    const dependency = getTracked()

    assert(dependency == null)
  })
})

describe('throttled', () => {
  it('batches calls, only executing once per microtask', async () => {
    let count = 0

    const inc = throttled(() => {
      count++
    })

    inc()
    inc()
    inc()

    await Promise.resolve()

    assert(count === 1)
  })
})

describe('transaction', () => {
  it('executes the transaction immediately', () => {
    const didChange = transaction()
    
    let didRun = false
    didChange.withTransaction(() => {
      didRun = true
    })

    didChange.transact()

    assert(didRun)
  })

  it('adds listeners only once', () => {
    const didChange = transaction()
    
    let count = 0
    const inc = () => {
      count++
    }

    didChange.withTransaction(inc)
    didChange.withTransaction(inc)
    didChange.withTransaction(inc)

    didChange.transact()

    assert(count === 1)
  })

  it('executes listeners only once, on next transaction, then drops them', () => {
    const didChange = transaction()
    
    let count = 0
    const inc = () => {
      count++
    }

    didChange.withTransaction(inc)

    didChange.transact()
    didChange.transact()
    didChange.transact()

    assert(count === 1)
  })
})

describe('signal getter', () => {
  it('returns value', () => {
    const [state, _] = signal(0)
    assert(state() === 0)
  })

  it('triggers withTracking transaction callback on change, when read within reactive scope', done => {
    const [state, setState] = signal(0)

    withTracking(
      () => {
        // Done should be called during next transaction
        done()
      },
      () => {
        // Access state so that it is tracked
        state()
      }
    )

    setState(10)
  })
})

describe('signal setter', () => {
  it('sets value immediately', () => {
    const [state, setState] = signal(0)
    setState(10)
    assert(state() === 10)
  })

  it('does not trigger reactions for values that are equal to the currently set value', async() => {
    const [state, setState] = signal(0)
    setState(10)
    setState(10)
    setState(10)

    let hitCount = 0
    effect(() => {
      // Access value so that effect triggers
      state()

      hitCount++
    })

    await Promise.resolve()

    assertEqual(hitCount, 1)
  })
})

describe('isSignal', () => {
  it('returns true for signal', () => {
    const [value, setValue] = signal(0)
    assert(isSignal(value))
  })

  it('returns true for computed', () => {
    const [a, setA] = signal(0)
    const [b, setB] = signal(0)
    const sum = computed(() => a() + b())
    assert(isSignal(sum))
  })

  it('returns true for any zero-argument function', () => {
    const constantZero = () => 0
    assert(isSignal(constantZero))
  })

  it('returns false for functions with arguments ', () => {
    const id = value => value
    assert(isSignal(id) === false)
  })
})

describe('sample', () => {
  it('samples a value', () => {
    assert(sample(0) === 0)
  })

  it('samples a signal', () => {
    const constantZero = () => 0
    assert(sample(constantZero) === 0)
  })

  it('treats functions with arguments as values, not signals', () => {
    const id = value => value
    assert(sample(id) === id)
  })
})

describe('effect', () => {
  it('executes once on initialization', done => {
    effect(done)
  })

  it('reacts to signals once per microtask, batching multiple updates', done => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)


    let count = 0
    effect(() => {
      count++
      if (count > 1) {
        fail('Effect fired too many times')
      } else if (count === 1) {
        done()
      }
    })

    setA(10)
    setB(10)
  })

  it('runs the cleanup function before next execution', async () => {
    const [counter, setCounter] = signal(0)

    let callCount = 0
    let cleanupCount = 0
    effect(() => {
      counter()
      callCount++
      cleanupCount++
      return () => cleanupCount--
    })
    await delay(null, 1)
    setCounter(1)
    await delay(null, 1)
    setCounter(2)
    await delay(null, 1)
    setCounter(3)
    await delay(null, 1)

    assertEqual(callCount, 4)
    assertEqual(cleanupCount, 1)
  })

  it('runs the cleanup when running the dispose function', async () => {
    let cleanupCount = 0
    const dispose = effect(() => {
      return () => cleanupCount++
    })
    dispose()
    assertEqual(cleanupCount, 1)
  })
})

describe('computed', () => {
  it('computes immediately and returns value', () => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)
    const sum = computed(() => a() + b())

    assert(sum() === 2)
  })

  it('recomputes when signal dependencies change, once per microtask, batching multiple updates', async () => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)
    const sum = computed(() => a() + b())

    assert(sum() === 2)

    setA(10)
    setB(10)

    // Recomputes are batched on next microtask, so await next microtask
    await Promise.resolve()

    assert(sum() === 20)
  })
})

describe('store', () => {
  it('returns a signal as the first item of the array pair', () => {
    const initial = {}
    const update = (state, msg) => ({})

    const [state, send] = store({
      state: initial,
      update
    })

    assert(isSignal(state))
  })

  it('returns a send function as the second item of the array pair', () => {
    const initial = {}
    const update = (state, msg) => ({})

    const [state, send] = store({
      state: initial,
      update
    })

    assertEqual(typeof send, 'function')
    assertEqual(send.length, 1)
  })

  it('updates the state immediately', () => {
    const Msg = {}
    Msg.inc = {type: 'inc'}

    const init = () => ({count: 0})

    const update = (state, msg) => {
      switch (msg.type) {
      case 'inc':
        return {...state, count: state.count + 1}
      default:
        return state
      }
    }

    const [state, send] = store({
      state: init(),
      update
    })

    assert(state().count === 0)

    send(Msg.inc)

    assert(state().count === 1)
  })
})

describe('fxware', () => {
  it('runs effects when plugged in as store fx driver', async () => {
    const TIMEOUT = 1

    const Msg = {}
    Msg.incLater = {type: 'incLater'}
    Msg.inc = {type: 'inc'}

    const init = () => ({count: 0})

    const update = (state, msg) => {
      switch (msg.type) {
      case 'inc':
        return {...state, count: state.count + 1}
      default:
        return state
      }
    }

    const fx = msg => {
      switch (msg.type) {
      case 'incLater':
        const incFx = () => delay(Msg.inc, TIMEOUT)
        return [incFx]
      default:
        return []
      }
    }

    const [state, send] = store({
      state: init(),
      update,
      middleware: fxware(fx)
    })

    send(Msg.incLater)

    await delay(null, TIMEOUT + 1)

    assertEqual(state().count, 1)
  })

  it('runs effects that immediately return a value', async () => {
    const TIMEOUT = 1

    const Msg = {}
    Msg.incLater = {type: 'incLater'}
    Msg.inc = {type: 'inc'}

    const init = () => ({count: 0})

    const update = (state, msg) => {
      switch (msg.type) {
      case 'inc':
        return {...state, count: state.count + 1}
      default:
        return state
      }
    }

    const fx = msg => {
      switch (msg.type) {
      case 'incLater':
        const incFx = () => Msg.inc
        return [incFx]
      default:
        return []
      }
    }

    const [state, send] = store({
      state: init(),
      update,
      middleware: fxware(fx)
    })

    send(Msg.incLater)

    await delay(null, TIMEOUT + 1)

    assertEqual(state().count, 1)
  })
})

describe('middleware', () => {
  it('it composes the fx drivers', done => {
    const driverA = send => msg => send(`a${msg}`)
    const driverB = send => msg => send(`b${msg}`)
    const driverC = send => msg => send(`c${msg}`)

    const driver = middleware(
      driverA,
      driverB,
      driverC
    )

    const send = msg => {
      assertEqual(msg, 'abc123')
      done()
    }

    const sendWithDrivers = driver(send)

    sendWithDrivers('123')
  })
})

describe('takeValues', () => {
  it('ends the signal on the first null or undefined value', async () => {
    const [maybeValue, setMaybeValue] = signal('a')

    const value = takeValues(maybeValue)
    setMaybeValue('b')

    await Promise.resolve()

    assert(value() === 'b')

    // Should end `value` signal
    setMaybeValue(null)

    await Promise.resolve()

    assert(value() === 'b')

    // `value` signal should be ended at this point, and should never see these.
    setMaybeValue('c')
    setMaybeValue('d')

    await Promise.resolve()

    assert(value() === 'b')
  })
})
