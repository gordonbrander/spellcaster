The lightest FRP signals library.

- Less than 4kb of vanilla JavaScript enabling efficient reactive UI.
- Fine-grained reactivity and automatic dependency tracking.
- Vanilla JavaScript: No compile step. Types provided by JSDoc. Just import and go.

## Introduction

Signals are reactive state containers that update whenever their values change.

`signal` takes an intial value, and returns a getter and a setter. The getter is just a zero-argument function that returns the current value. The setter can be called to set a new value on the signal. This may feel familiar if you've ever used React hooks.

```js
import {signal} from './tendril.js'

const [count, setCount] = signal(0)

console.log(count()) // 0

// Update the signal
setCount(1)

console.log(count()) // 1
```

You can derive signals from other signals using `computed`. This lets you drill down to the smallest bits of state required by a UI component, updating the DOM in the most efficient way possible.

```js
import {signal, computed} from './tendril.js'

const [post, setPost] = signal({
  header: {
    title: 'Text',
    subtitle: 'x'
  },
  body: '...'
})

// Reacts only when title changes
const title = computed(() => post().header.title)
```

`title` will update only when the title field of the state changes. You can drill down to just the properties a component needs, updating components in the most efficient way possible.

Computed signals automatically track their dependencies, and recompute whenever their dependencies change. If a signal is referenced within the body of `computed`, it is automatically registered as a dependency. Only the dependencies referenced are registered. If you stop referencing a dependency, it is automatically deregistered. For example, if you have an `if` statement and each arm references different signals, only the signals in the active arm will be registerd as dependencies. We call this fine-grained reactivity. You never have to worry about registering and removing listeners, or cancelling subscriptions. Tendril manages all of that for you.

Finally, you can react to signal changes using `effect`.

```js
effect(() => console.log(title()))
```

Just like `computed`, `effect` will update whenever one or more of the signals it references updates.

Using `signal`, `computed`, and `effect` it becomes possible to build reactive components.

## Installation

Tendril is a vanilla JavaScript module. You can import it directly. No compile step needed!

```js
import * as tendril from './tendril.js'
```

```html
<script type="module" src="tendril.js">
```

## Usage example

Here's a simple counter example using signals and signals-aware hyperscript.

```js
import {signal} from './tendril.js'
import {h, text, children} from './hyperscript.js'

const viewCounter = () => {
  const [count, setCount] = signal(0)

  return h(
    'div',
    {className: 'wrapper'},
    children(
      h(
        'div',
        {className: 'count'},
        text(count)
      ),
      h(
        'button',
        {onclick: () => setCount(count() + 1)},
        text('Increment')
      )
    )
  )
}

const view = viewCounter()
document.body.append(view)
```

## Using signals for local component state

## Deriving state with `computed`

## Using `store` to manage global app state

`store` offers an Elm/Redux-like store for managing application state.

- All application state can be centralized in a single store.
- State is only be updated via a reducer function, making state changes predictable and reproducible.
- Store manages asynchronous side-effects with an effects runner.

`store` can be initialized and used much like `signal`. However, instead of being initialized with a value, it is initialized with two functions: `init()` and `update(state, msg)`. Both functions return a transaction object (created with `next`) that contains the next state. Store returns a signal for the state, as well as a send function that allows you to send messages to the store.

```js
const init = () => next({
  count: 0
})

const update = (state, msg) => {
  switch (msg.type) {
  case 'increment':
    return next({...state, count: state.count + 1})
  default:
    return next(state)
  }
}

const [state, send] = store({init, update})

console.log(state()) // {count: 0}
send({type: 'increment'})
console.log(state()) // {count: 1}
```

Transactions can also include asynchronous side-effects, such as HTTP requests and timers. Effects are modeled as promises that resolve to a `msg`.

```js
// Fetches count from API and returns it as a message
const fetchCount = async () => {
  const resp = await fetch('https://api.example.com/count').json()
  const count = resp.count
  return {type: 'setCount', count}
}

const update = (state, msg) => {
  switch (msg.type) {
  case 'fetchCount':
    // Include list of of effects with transaction
    return next(state, [fetchCount()])
  case 'setCount':
    return next({...state, count: msg.count})
  default:
    return next(state)
  }
}
```

Store will await each of the promises in the array of effects, and then feed their resulting messages back into the store. This allows you to model side-effects along with state changes in your reducer function, making side-effects deterministic and predictable.

## Hyperscript

## API

### `signal(value)`

### `computed(fn)`

### `effect(fn)`

### `store(options)`

Store offers an Elm/Redux-like reactive store powered by signals. Signal state is updated via a reducer function, which returns new states, and any side-effects.

### Utilities

#### `next(state, effects)`

#### `unknown(state, msg)`

#### `takeValues(signal)`