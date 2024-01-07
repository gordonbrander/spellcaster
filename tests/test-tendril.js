import { TestRunner, expectation, test, assert } from './testrunner.js'

import {
    dependencyTracker,
    signal,
    computed,
    effect
} from '../tendril.js'

const runner = new TestRunner()

runner.suite('dependencyTracker', async () => {
    const {withTracking, getTracked} = dependencyTracker()

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
    await test('setter sets value immediately', async () => {
        const [state, setState] = signal(0)
        setState(10)
        assert(state() === 10, 'it sets value immediately')
    })
})

runner.run()