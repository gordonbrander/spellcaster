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
  sagaFx,
  spinUntil,
  isSignal,
  sample,
  takeValues
} from "../dist/spellcaster.js"

const delay = (ms, value) => new Promise(resolve => {
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
    const init = () => ({})
    const update = (state, msg) => state

    const [state, send] = store({
      init,
      update
    })

    assert(isSignal(state))
  })

  it('returns a send function as the second item of the array pair', () => {
    const init = () => ({})
    const update = (state, msg) => state

    const [state, send] = store({
      init,
      update
    })

    assertEqual(typeof send, 'function')
    assertEqual(send.length, 1)
  })

  it('updates the state immediately', () => {
    const Msg = {}
    Msg.inc = {type: 'inc'}

    const update = (state, msg) => {
      switch (msg.type) {
      case 'inc':
        return {...state, count: state.count + 1}
      default:
        return state
      }
    }

    const [state, send] = store({
      state: {count: 0},
      update
    })

    assert(state().count === 0)

    send(Msg.inc)

    assert(state().count === 1)
  })
})

describe('store sagaFx', () => {
  it('runs effects', done => {
    const TIMEOUT = 0

    const Msg = {}
    Msg.incLater = {type: 'incLater'}
    Msg.inc = {type: 'inc'}

    const update = (state, msg) => {
      switch (msg.type) {
      case 'inc':
        return {...state, count: state.count + 1}
      default:
        return state
      }
    }

    async function* fx(state, msg) {
      switch (msg.type) {
        case 'incLater':
          yield await delay(TIMEOUT, Msg.inc)
        default:
          return
      }
    }

    const [state, send] = store({
      state: {count: 0},
      update,
      fx: sagaFx(fx)
    })

    send(Msg.incLater)

    setTimeout(
      () => {
        assertEqual(state().count, 1)
        done()
      },
      TIMEOUT + 1
    )
  })

  it('runs effects in correct order', async () => {
    const TIMEOUT = 0

    const Msg = {}
    Msg.a = {type: 'a'}
    Msg.b = {type: 'b'}
    Msg.c = {type: 'c'}
    Msg.d = {type: 'd'}
    Msg.e = {type: 'e'}

    const update = (state, msg) => {
      switch (msg.type) {
      case 'a':
        return state + 'a'
      case 'b':
        return state + 'b'
      case 'c':
        return state + 'c'
      case 'd':
        return state + 'd'
      case 'e':
        return state + 'e'
      default:
        return state
      }
    }

    async function* fx(state, msg) {
      switch (msg.type) {
      case 'a':
        yield* aFx(state, msg)
        return
      case 'b':
        yield* bFx(state, msg)
      default:
        return
      }
    }

    async function* aFx(state, msg) {
      yield Msg.b
      yield Msg.c
    }

    async function* bFx(state, msg) {
      yield Msg.d
      yield Msg.e
    }

    const [state, send] = store({
      state: '',
      update,
      fx: sagaFx(fx)
    })

    send(Msg.a)

    await delay(TIMEOUT + 1)
    assertEqual(state(), 'abcde')
  })

  it('runs effects in correct order (2)', async () => {
    const TIMEOUT = 1

    const Msg = {}
    Msg.a = {type: 'a'}
    Msg.b = {type: 'b'}
    Msg.c = {type: 'c'}
    Msg.d = {type: 'd'}
    Msg.e = {type: 'e'}

    const update = (state, msg) => {
      switch (msg.type) {
      case 'a':
        return state + 'a'
      case 'b':
        return state + 'b'
      case 'c':
        return state + 'c'
      case 'd':
        return state + 'd'
      case 'e':
        return state + 'e'
      default:
        return state
      }
    }

    async function* fx(state, msg) {
      switch (msg.type) {
      case 'a':
        yield* aFx(state, msg)
        return
      case 'b':
        yield* bFx(state, msg)
      default:
        return
      }
    }

    async function* aFx(state, msg) {
      yield Msg.b
      await delay(TIMEOUT)
      yield Msg.c
    }

    async function* bFx(state, msg) {
      yield Msg.d
      yield Msg.e
    }

    const [state, send] = store({
      state: '',
      update,
      fx: sagaFx(fx)
    })
    send(Msg.a)

    await delay(TIMEOUT + 1)

    assertEqual(state(), 'abdec')
  })
})

describe('spinUntil', () => {
  it('spins until it sees a specific state', async () => {
    const TIMEOUT = 1

    const Msg = {}
    Msg.a = {type: 'a'}
    Msg.b = {type: 'b'}
    Msg.c = {type: 'c'}
    Msg.d = {type: 'd'}
    Msg.e = {type: 'e'}

    const update = (state, msg) => {
      switch (msg.type) {
      case 'a':
        return state + 'a'
      case 'b':
        return state + 'b'
      case 'c':
        return state + 'c'
      case 'd':
        return state + 'd'
      case 'e':
        return state + 'e'
      default:
        return state
      }
    }

    async function* fx(state, msg) {
      switch (msg.type) {
      case 'a':
        yield* aFx(state, msg)
        return
      default:
        return
      }
    }

    async function* aFx(state, msg) {
      yield* spinUntil(state => state === 'ab')
      yield Msg.c
      yield Msg.d
      yield Msg.e
    }

    const [state, send] = store({
      state: '',
      update,
      fx: sagaFx(fx)
    })

    send(Msg.a)
    await delay(1)
    assertEqual(state(), 'a')

    send(Msg.b)
    await delay(1)
    assertEqual(state(), 'abcde')
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
