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
  next,
  store,
  isSignal,
  sample
} from "../tendril.js"

describe('withTracking', () => {
  it('it executes the body function immediately and returns the value', () => {
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
  it('is undefined outside of tracking scopes', () => {
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
})

describe('computed', () => {
  it('computes immediately and returns value', () => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)
    const sum = computed(() => a() + b())

    assert(sum() === 2)
  })

  it('reacts to signal changes by recomputing on next microtask', async () => {
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

describe('next', () => {
  it('returns a transaction object', () => {
    const fx = () => {}
    const transaction = next(0, [fx])

    assert(typeof transaction === 'object')
    assert(transaction.state === 0)
    assert(transaction.effects.length === 1)
    assert(transaction.effects[0] === fx)
  })
})

describe('store', () => {
  it('returns a signal as the first item of the array pair', () => {
    const init = () => next({})
    const update = (state, msg) => next({})

    const [state, send] = store({init, update})

    assert(isSignal(state))
  })

  it('updates the state immediately', () => {
    const Msg = {}
    Msg.inc = {type: 'inc'}

    const init = () => next({count: 0})

    const update = (state, msg) => {
      switch (msg.type) {
      case 'inc':
        return next({...state, count: state.count + 1})
      default:
        return next(state)
      }
    }

    const [state, send] = store({init, update})

    assert(state().count === 0)

    send(Msg.inc)

    assert(state().count === 1)
  })

  it('runs effects', done => {
    const TIMEOUT = 0

    const Msg = {}
    Msg.incLater = {type: 'incLater'}
    Msg.inc = {type: 'inc'}

    const delay = (value, ms) => new Promise(resolve => {
      setTimeout(
        () => resolve(value),
        ms
      )
    })

    const init = () => next({count: 0})

    const update = (state, msg) => {
      switch (msg.type) {
      case 'incLater':
        const fx = () => delay(Msg.inc, TIMEOUT)
        return next(state, [fx])
      case 'inc':
        return next({...state, count: state.count + 1})
      default:
        return next(state)
      }
    }

    const [state, send] = store({init, update})
    send(Msg.incLater)

    setTimeout(
      () => {
        assertEqual(state().count, 1)
        done()
      },
      TIMEOUT + 1
    )
  })

  it('runs effects that immediately return a value', done => {
    const TIMEOUT = 0

    const Msg = {}
    Msg.incLater = {type: 'incLater'}
    Msg.inc = {type: 'inc'}

    const init = () => next({count: 0})

    const update = (state, msg) => {
      switch (msg.type) {
      case 'incLater':
        const fx = () => Msg.inc
        return next(state, [fx])
      case 'inc':
        return next({...state, count: state.count + 1})
      default:
        return next(state)
      }
    }

    const [state, send] = store({init, update})
    send(Msg.incLater)

    setTimeout(
      () => {
        assertEqual(state().count, 1)
        done()
      },
      TIMEOUT + 1
    )
  })
})
