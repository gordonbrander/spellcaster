/**
 * Creates a dependency tracker
 * We use this to allow signals to automatically gather their downstream
 * dependencies.
 */
export const dependencyTracker = () => {
    const scopes = [];
    /** Get the current tracked scope */
    const getTracked = () => scopes[scopes.length - 1];
    /** Perform a function while setting thunk as the current tracked scope */
    const withTracking = (onChange, perform) => {
        scopes.push(onChange);
        const value = perform();
        scopes.pop();
        return value;
    };
    return { withTracking, getTracked };
};
export const { withTracking, getTracked } = dependencyTracker();
/**
 * Given a zero-argument function, create a throttled version of that function
 * that will run only once per microtask.
 */
export const throttled = (job) => {
    let isScheduled = false;
    const perform = () => {
        job();
        isScheduled = false;
    };
    const schedule = () => {
        if (!isScheduled) {
            isScheduled = true;
            queueMicrotask(perform);
        }
    };
    return schedule;
};
/**
 * Create a transaction notification publisher.
 * Allows you to register listeners that are called once during the next
 * transaction.
 */
export const transaction = () => {
    let transaction = new Set();
    /**
     * Add listener to current transaction.
     * Listener functions are deduped. E.g. if you add the same listener twice to
     * the same transaction, it's only added once.
     */
    const withTransaction = (listener) => {
        if (typeof listener === 'function') {
            transaction.add(listener);
        }
    };
    /**
     * Perform a transaction.
     * Listeners in transaction are notified once and then forgotten.
     */
    const transact = () => {
        // Capture transaction
        const listeners = transaction;
        // Create a new transaction. This transaction will gather dependencies
        // queued while executing listeners.
        transaction = new Set();
        // Perform transaction.
        for (const listener of listeners) {
            listener();
        }
        // Listeners are released after scope exits so they can be garbaged.
    };
    return { withTransaction, transact };
};
/**
 * Is value a signal-like function?
 * A signal is any zero-argument function.
 */
export const isSignal = (value) => (typeof value === 'function' && value.length === 0);
/** Sample a value that may be a signal, or just an ordinary value */
export const sample = (value) => isSignal(value) ? value() : value;
/**
 * A signal is a reactive state container. It holds a single value which is
 * updated atomically.
 *
 * When signal values are read within reactive scopes, such as `computed` or
 * `effect`, the scope will automatically re-execute when the signal changes.
 */
export const signal = (initial) => {
    const didChange = transaction();
    let state = initial;
    /**
     * Read current signal state
     * When read within reactive scopes, such as `computed` or `effect`,
     * the scope will automatically re-execute when the signal changes.
     */
    const read = () => {
        didChange.withTransaction(getTracked());
        return state;
    };
    /**
     * Set signal value.
     * A value will only be set and trigger a reactive transaction if it
     * the new value is different from the old value as determined by a
     * strict equality check.
     */
    const set = (value) => {
        if (state !== value) {
            state = value;
            didChange.transact();
        }
    };
    return [read, set];
};
/**
 * Create a computed signal
 * Computed sigal takes a zero-argument function, `compute` which may read
 * from any other signal to produce a value.
 * `compute` is executed within a reactive scope, so signals referenced within
 * `compute` will automatically cause `compute` to be re-run when signal
 * state changes.
 */
export const computed = (compute) => {
    const didChange = transaction();
    // We batch recomputes to solve the diamond problem.
    // Every upstream signal read within the computed's tracking scope can
    // independently generate a change notification. This means if two upstream
    // signals change at once, our transaction callback gets called twice.
    // By scheduling batch updates on the next microtask, we ensure that the
    // computed signal is recomputed only once per event loop turn.
    const recompute = throttled(() => {
        const value = withTracking(recompute, compute);
        if (state !== value) {
            state = value;
            didChange.transact();
        }
    });
    const read = () => {
        didChange.withTransaction(getTracked());
        return state;
    };
    let state = withTracking(recompute, compute);
    return read;
};
/**
 * Perform a side-effect whenever signals referenced within `perform` change.
 * `perform` is executed within a reactive scope, so signals referenced within
 * `perform` will automatically cause `perform` to be re-run when signal
 * state changes.
 */
export const effect = (perform) => {
    const performEffect = throttled(() => {
        withTracking(performEffect, perform);
    });
    withTracking(performEffect, perform);
};
/**
 * Transform a signal, returning a computed signal that takes values until
 * the given signal returns null. Once the given signal returns null, the
 * signal is considered to be complete and no further updates will occur.
 *
 * This utility is useful for signals representing a child in a dynamic
 * collection of children, where the child may cease to exist.
 * A computed signal looks up the child, returns null if that child no longer
 * exists. This completes the signal and breaks the connection with upstream
 * signals, allowing the child signal to be garbaged.
 */
export const takeValues = (maybeSignal) => {
    const initial = maybeSignal();
    if (initial == null) {
        throw new TypeError("Signal initial value cannot be null");
    }
    let state = initial;
    let isComplete = false;
    return computed(() => {
        if (isComplete) {
            return state;
        }
        const next = maybeSignal();
        if (next != null) {
            state = next;
            return state;
        }
        else {
            isComplete = true;
            return state;
        }
    });
};
export const noFx = (state, msg, send) => { };
/**
 * Create store for state.
 * You centralize all state in a single store, use signals to scope pieces of
 * store state for views, or you can have many stores.
 * Stores may optionally generate asynchronous side-effects in response
 * to actions using the `fx` option, which is called with state and msg
 * for each msg sent to store, and must return an async generator for
 * msgs to send to the store.
 */
export const store = ({ state: initial, update, fx = noFx }) => {
    const [state, setState] = signal(initial);
    const send = (msg) => {
        const next = update(state(), msg);
        setState(next);
        fx(next, msg, send);
    };
    return [state, send];
};
export const sagaFx = (fx) => {
    // Live sagas
    const sagas = new Set();
    const advanceSaga = async (saga, state, send) => {
        const { done, value } = await saga.next(state);
        // Delete saga if it has completed. Ignore return value.
        // Otherwise, if saga has yielded an action, send it to the store.
        if (done) {
            sagas.delete(saga);
        }
        else if (value != null) {
            send(value);
        }
    };
    return (state, msg, send) => {
        const saga = fx(state, msg);
        sagas.add(saga);
        for (const saga of sagas) {
            advanceSaga(saga, state, send);
        }
    };
};
export const debugFx = ({ name = 'store', debug = false }) => (state, msg, send) => {
    if (sample(debug)) {
        console.debug({ name, msg });
    }
};
export const fxDrivers = (...fxDrivers) => (state, msg, send) => {
    for (const driver of fxDrivers) {
        driver(state, msg, send);
    }
};
export function* spinUntil(predicate) {
    while (true) {
        const state = yield;
        console.log('spinUntil', state);
        if (predicate(state)) {
            return state;
        }
    }
}
