# Tendril

The lightest FRP signals library.

- Less than 4kb
- Fine-grained reactivity and automatic dependency tracking.
- Vanilla JavaScript. No compile step. Types provided by JSDoc.

## Introduction

Signals are reactive state containers that update whenever their values change.

`signal` takes an intial value, and returns a getter and a setter. The getter is a zero-argument function that returns the current value, and the setter can be called to set a new value for the signal. This will feel familiar if you've ever used React hooks.

```js
import {signal} from './tendril.js'

const [count, setCount] = signal(0)

console.log(count()) // 0

// Update the signal
setCount(1)

console.log(count()) // 1
```

So far, so good. But signals have a hidden superpower: they're reactive!

When we reference a signal within a rective scope, that scope will re-run whenever the signal value updates. For example, let's create a derived signal from another signal, using `computed()`.

```js
import {signal, computed} from './tendril.js'

const [todos, setTodos] = signal([
  { text: 'Chop wood', isComplete: true },
  { text: 'Carry water', isComplete: false }
])

// Create a computed signal from other signals
const completed = computed(() => {
  // Re-runs automatically when todos signal changes
  return todos().filter(todo => todo.isComplete).length
})

console.log(completed()) // 1
```

`computed` runs the function you provide within a reactive scope, so when the signal changes, the function is re-run.

What about when you want to react to value changes? That's where `effect` comes in. It lets you perform a side-effect whenever a signal changes:

```js
// Log every time title changes
effect(() => console.log(title()))
```

Effect is where signals meet the real world. You can use `effect` like you might use `useEffect` in React... to kick off HTTP requests, perform DOM mutations, or anything else that should react to state updates.

## Installation

Tendril is a vanilla JavaScript module. You can import it directly. No compile step needed!

```js
import * as tendril from './tendril.js'
```

```html
<script type="module" src="tendril.js">
```

## Creating reactive components with signals

Here's a simple counter example using signals and hyperscript.

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

What's going on here? To make sense of this, let's rewrite this component using only signals and vanilla DOM methods.

```js
const viewCounter = () => {
  const [count, setCount] = signal(0)

  const wrapper = document.createElement('div')
  wrapper.className = 'wrapper'

  // Create count element
  const count = document.createElement('div')
  count.className = 'count'
  wrapper.append(count)

  // Create button
  const button = document.createElement('button')
  button.textContent = 'Increment'
  // Set count when button is clicked
  button.onclick = () => setCount(count() + 1)
  wrapper.append(button)

  // Write text whenever signal changes
  effect(() => count.textContent = text())

  return wrapper
}
```

We can see that hyperscript is just an ergonomic way to construct an element. We're just constructing return an ordinary DOM element here! Since signals are reactive representations of values, the returned element is reactive. When the signal value changes, the element automatically updates. No virtual DOM diffing is needed.

The above example uses `signal` for local component state, but you can also pass a signal down from a parent.

```js
const viewTitle = title => h('h1', {className: 'title'}, text(title))
```

Here's a more complex example, with some dynamic properties. Instead of passing `h()` a props object, we'll pass it a function that returns an object. This function is evaluated within a reactive scope, so whenever `isHidden()` changes, the props are updated.

```js
const viewModal = (isHidden, ...childViews) => h(
  'div',
  () => ({
    className: 'modal',
    hidden: isHidden()
  }),
  children(...childViews)
)
```

Passing down signals allows you to share reactive state between components. You can even centralize all of your application state into one signal, and pass down scoped signals to sub-components using `computed`.

Signals give you rrgonomic, efficient, reactive components, without a virtual DOM or compile step.

## Deriving signals with `computed`

`computed()` lets you to derive a signal from one or more other signals.

```js
import {signal, computed} from './tendril.js'

const [todos, setTodos] = signal([
  { text: 'Chop wood', isComplete: true },
  { text: 'Carry water', isComplete: false }
])

// Create a computed signal from other signals
const completed = computed(() => {
  // Re-runs automatically when todos signal changes
  return todos().filter(todo => todo.isComplete).length
})

console.log(completed()) // 1
```

Computed signals automatically track their dependencies, and recompute whenever their dependencies change. Only the signals that are executed are registered as dependencies. For example, if you have an `if` statement and each arm references different signals, only the signals in the active arm will be registered as dependencies. If a signal stops being executed (for example, if it is in the inactive arm of an if statement), it will be automatically de-registered.

```js
const fizzBuzz = computed(() => {
  if (isActive()) {
    // Registered as a dependency only when isActive is true
    return fizz()
  } else {
    // Registered as a dependency only when isActive is false
    return buzz()
  }
})
```

You never have to worry about registering and removing listeners, or cancelling subscriptions. Tendril manages all of that for you. We call this fine-grained reactivity.

Simple apps that use local component state may not need `computed`, but it comes in handy for complex apps that want to centralize state in one place.

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

Tendril hyperscript is a functional shorthand for creating reactive HTML elements.

```js
h(tag, props, config)
```

- Parameters
  - `tag` - a string for the tag to be created
  - `props:` - an object, or a signal for an object that contains props to be set on the element
  - `config(element)?` - an optional callback that receives the constructed element and can modify it
- Returns: `HTMLElement` - the constructed element

`h()` can be used with config helpers like `text()` and `children()` to efficiently build HTML elements.

```js
const viewTitle = title => h(
  'h1',
  {className: 'title'},
  // Set text content of element
  text(title)
)

const viewModal = (isHidden, ...content) => h(
  'div',
  () => ({
    className: 'modal',
    hidden: isHidden()
  }),
  // Assign a static list of children to element
  children(...content)
)

const viewCustom = () => h(
  'div',
  {},
  element => {
    // Custom logic
  }
)
```

What about rendering dynamic lists of children? For this, we can use `list()`. It takes a `() => Map<Key, Item>` and will efficiently re-render children, updating, moving, or removing elements as needed, making the minimal number of DOM modifications.

```js
const viewTodos = todos => h(
  'div',
  {className: 'todos'},
  list(todos, viewTodo)
)
```

With hyperscript, most of the DOM tree is static. Only dynamic properties, text, and lists are dynamic. This design approach is inspired by [SwiftUI](https://developer.apple.com/documentation/swiftui/list), and it makes updates extremely efficient.