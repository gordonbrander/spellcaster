The lightest FRP signals library.

- Less than 4kb of vanilla JavaScript enabling efficient reactive UI.
- Fine-grained reactivity and automatic dependency tracking.
- Vanilla JavaScript: No compile step. Types provided by JSDoc. Just import and go.

## Introduction

Signals are reactive containers for state that update whenever their values change. You can create signals from other signals, drilling down to just the pieces of state needed by a UI component, updating the DOM in the most efficient way possible.

Tendril is made up of just three reactive primitives: `signal`, `computed`, and `effect`.

`signal` takes an intial value, and returns a getter and a setter (this may feel familiar if you've ever used React hooks).

- The getter is just a zero-argument function that returns the current value.
- The setter can be called to set a new value on the signal.

```js
import {signal} from './tendril.js'

const [count, setCount] = signal(0)

console.log(count()) // 0

// Update the signal
setCount(1)

console.log(count()) // 1
```

Signals automatically track their dependencies, and will recompute whenever their dependencies change. For example, let's create a signal from another signal using `computed`:

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

Our new `title` signal will update only when the `title` field in the state changes. We call this fine-grained reactivity. You can drill down to just the properties a component needs, updating components in the most efficient way possible.

Signals automatically track their dependencies. Any signal referenced within the body of `computed` will be automatically registered as a dependency. Only the dependencies referenced are registered. If you stop referencing a dependency, it is automatically deregistered. For example, if you have an `if` statement and each arm references different signals, only the signals in the active arm will be registerd as dependencies. You never have to worry about registering and removing listeners, or cancelling subscriptions. Tendril manages all of this for you.

Lastly, you can react to signal changes using `effect`.

```js
const h1 = document.createElement('h1')

effect(() => h1.textContent = title())
```

Or, using signals-aware hyperscript:

```js
h('h1', {}, text(title))
```

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

## Using `store` for global app state

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