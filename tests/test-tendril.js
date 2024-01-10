import { TestRunner, expectation, test, assert, AssertionError } from './testrunner.js'

import {
  withTracking,
  getTracked,
  signal,
  computed,
  effect
} from '../tendril.js'

const runner = new TestRunner()

runner.suite('dependency tracking', async () => {
  await test('withTracking executes the callback', async () => {
    const onChange = () => {}

    const didExecute = withTracking(
      onChange,
      () => true
    )
    assert(didExecute, 'it executes the callback function')
  })

  await test('withTracking sets the dependency for the tracking scope', async () => {
    const onChange = () => {}

    const fulfillDependencyWasSet = expectation(
      'Dependency is set by tracking scope'
    )

    withTracking(
      onChange,
      () => {
        const dependency = getTracked()
        assert(
            dependency === onChange,
            'Dependency is set by tracking scope'
        )
        fulfillDependencyWasSet()
      }
    )
  })

  await test('Dependency is undefined outside of tracking scopes', async () => {
    const dependency = getTracked()

    assert(
      dependency == null,
      'it is undefined outside of tracking scopes'
    )
  })
})

runner.suite('signal', async () => {
  await test('getter returns value', async () => {
    const [state, setState] = signal(0)
    assert(state() === 0, 'it returns the value')
  })

  await test('setter sets value immediately', async () => {
    const [state, setState] = signal(0)
    setState(10)
    assert(state() === 10, 'it sets value immediately')
  })

  await test('Reading signal value within reactive scope registers signal as dependency for tracking scope', async () => {
    const [state, setState] = signal(0)

    const fulfill = expectation(
      'Reading signal signal sets it as dependency for tracking scope'
    )

    withTracking(
      fulfill,
      () => {
        // Access state so that it is tracked
        state()
      }
    )

    setState(10)
  })
})

runner.suite('effect', async () => {
  await test('it executes once on initialization', async () => {
    const fulfill = expectation(
      'It executes once on initialization'
    )

    const sum = effect(() => {
      fulfill()
    })
  })

  await test('it reacts to new values once per microtask', async () => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)

    const fulfill = expectation(
      'It executes once per microtask when signal changes'
    )

    let count = 0
    const sum = effect(() => {
      count++
      if (count > 1) {
        throw new AssertionError('It executes once per microtask when signal changes')
      } else if (count === 1) {
        fulfill()
      }
    })

    setA(10)
    setB(10)
  })
})

runner.suite('computed', async () => {
  await test('it returns value', async () => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)
    const sum = computed(() => a() + b())

    assert(sum() === 2, 'it returns the value')
  })

  await test('it reacts to new values', async () => {
    const [a, setA] = signal(1)
    const [b, setB] = signal(1)
    const sum = computed(() => a() + b())

    assert(sum() === 2, 'it returns the value')

    setA(10)
    setB(10)

    // Wait for computed signal to update
    await Promise.resolve()

    assert(sum() === 20, 'it returns the updated value')
  })
})

runner.run()