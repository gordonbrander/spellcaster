import { describe, it } from "mocha"
import { strict as assert, fail } from "assert"

import {
  withTracking,
  getTracked,
  signal,
  effect,
  computed,
  throttled
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
