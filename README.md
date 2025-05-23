# 👋🔮 Spellcaster

![Node.js CI status](https://github.com/gordonbrander/spellcaster/actions/workflows/node.js.yml/badge.svg?branch=main)

Reactive UI without dark magic.

- Fine-grained reactive signals using the [TC39 Standard Signals polyfill](https://github.com/tc39/proposal-signals)
- Available as either a Typescript package or a vanilla JS bundle (with no build step)
- Less than 4kb compressed

## Introduction

Signals are reactive state containers that update whenever their values change.

`signal` takes an intial value, and returns a getter and a setter. The getter is a zero-argument function that returns the current value, and the setter can be called to set a new value for the signal. This will feel familiar if you've ever used React hooks.

```js
import {signal} from 'spellcaster/spellcaster.js'

const [count, setCount] = signal(0)

console.log(count()) // 0

// Update the signal
setCount(1)

console.log(count()) // 1
```

So far, so good. But signals have a hidden superpower: they're reactive! When we reference a signal within a rective scope, that scope will re-run whenever the signal value updates.

Spellcaster uses this superpower to offer React-like components for vanilla DOM elements. Signals are bound to specific points in the DOM tree, and whenever the signal updates, a fine-grained update is made to the DOM. For example, here's a simple counter app:

```js
import {signal} from 'spellcaster/spellcaster.js'
import {tags, text} from 'spellcaster/hyperscript.js'
const {div, button} = tags

const Counter = () => {
  const [count, setCount] = signal(0)

  return div(
    {className: 'counter'},
    [
      div({className: 'counter-text'}, text(count)),
      button(
        {
          className: 'counter-button',
          onclick: () => setCount(count() + 1)
        },
        text('Increment')
      )
    ]
  )
}

document.body.append(Counter())
```

## Installation

### Via NPM

```
npm install spellcaster
```

Then import into JavaScript or TypeScript:

```js
import * as spellcaster from 'spellcaster/spellcaster.js'
```

TypeScript types are exported using the newer package.json `exports` field. To access types, you'll want to use Typescript >= 4.7, and add the following to your `tsconfig.json`:

```js
// tsconfig.json
"compilerOptions": {
  "moduleResolution": "node16" // or "nodenext"
}
```

### As a vanilla JS library

Spellcaster is also available as a vanilla JS module... no npm or build step necessary!

To use the Spellcaser as a vanilla JS module, download the bundle zip from the [latest release](https://github.com/gordonbrander/spellcaster/releases/latest), and then import the library and signals polyfill (provided with the download).

In your HTML file, add the following to the head:

```html
<script type="importmap">
  {
    "imports": {
      "signal-polyfill": "./path/to/signal-polyfill.js",
      "spellcaster": "./path/to/spellcaster.js"
    }
  }
</script>
<script type="module" src="path/to/main.js"></script>
```

Now you can import Spellcaster from your vanilla JS module:

```js
import {signal} from 'spellcaster'
```

Happy hacking!

## Creating reactive components with signals

Here's a simple counter example using signals and hyperscript.

```js
import {signal} from 'spellcaster/spellcaster.js'
import {tags, text} from 'spellcaster/hyperscript.js'
const {div, button} = tags

const Counter = () => {
  const [count, setCount] = signal(0)

  return div(
    {className: 'counter'},
    [
      div({className: 'counter-text'}, text(count)),
      button(
        {
          className: 'counter-button',
          onclick: () => setCount(count() + 1)
        },
        text('Increment')
      )
    ]
  )
}

document.body.append(Counter())
```

What's going on here? To make sense of this, let's rewrite this component using only signals and vanilla DOM methods.

```js
const viewCounter = () => {
  const [count, setCount] = signal(0)

  const counter = document.createElement('div')
  counter.className = 'counter'

  // Create counter text element
  const counterText = document.createElement('div')
  counterText.className = 'counter-text'
  counter.append(counterText)

  // Create button
  const button = document.createElement('button')
  button.textContent = 'Increment'
  button.className = 'counter-button'
  // Set count when button is clicked
  button.onclick = () => setCount(count() + 1)
  counter.append(button)

  // Write text whenever signal changes
  effect(() => counterText.textContent = count())

  return counter
}
```

We can see that hyperscript is just an ergonomic way to build ordinary DOM elements. Since signals are reactive, the returned element is also reactive. When the signal value changes, the element automatically updates, making precision updates to the DOM. No virtual DOM diffing is needed!

The above example uses `signal` for local component state, but you can also pass a signal down from a parent.

```js
const Title = title => h1({className: 'title'}, text(title))
```

Here's a more complex example, with some dynamic properties. Instead of passing the tag a props object, we'll pass it a function that returns an object. This function is evaluated within a reactive scope, so whenever `isHidden()` changes, the props are updated.

```js
const Modal = (isHidden, children) => div(
  () => ({
    className: 'modal',
    hidden: isHidden()
  }),
  children
)
```

Passing down signals allows you to share reactive state between components. You can even centralize all of your application state into one signal, passing down scoped signals to sub-components using `computed`.

Signals give you ergonomic, efficient, reactive components, without the need for a virtual DOM or compile step.

## Deriving signals with `computed`

`computed()` lets you to derive a signal from one or more other signals.

```js
import {signal, computed} from 'spellcaster/spellcaster.js'

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

You never have to worry about registering and removing listeners, or cancelling subscriptions. Spellcaster manages all of that for you. We call this fine-grained reactivity.

Simple apps that use local component state may not need `computed`, but it comes in handy for complex apps that want to centralize state in one place.

## Performing side-effects with `effect`

What about when you want do something in response to signal changes? This is where `effect` comes in. It lets you perform a side-effect whenever a signal changes:

```js
// Log every time title changes
effect(() => console.log(title()))
```

Effect is where signals meet the real world. You can use `effect` like you might use `useEffect` in React... to kick off HTTP requests, perform DOM mutations, or anything else that should react to state updates.

Effect can also optionally return a function to perform cleanup between updates:

```js
// Log every time title changes
effect(() => {
  const x = new ResourceOfSomeKind()
  x.perform()
  return () => x.close()
})
```

## Using `store` to manage state with reducers

`store` offers an Elm/Redux-like store for managing application state.

- State is updated via a reducer function, making state changes predictable and reproducible.
- Supports asynchronous side-effects with effects middleware.
- State can be centralized in a single store, like Redux, or contained in multiple stores, like useReducer

`store` can be initialized and used much like `signal`. However, instead of being initialized with a value, it is initialized with an options object containing an initial `state`, a reducer function, and an optional start msg. Store returns an array pair containing a signal for the state, and a `send(msg)` function that allows you to send messages to the store.

```js
const update = (state, msg) => {
  switch (msg.type) {
  case 'increment':
    return {...state, count: state.count + 1}
  default:
    return state
  }
}

const [state, send] = store({
  state: {count: 0},
  update
})

console.log(state()) // {count: 0}
send({type: 'increment'})
console.log(state()) // {count: 1}
```

### Side-effects with middleware

Stores can also manage asynchronous side-effects, such as HTTP requests and timers using middleware. Spellcaster offers a default effects middlware called `fxware`. Side-effects are modeled as zero-argument functions that return a message, or a promise for a message.

```js
// Fetches count from API and returns it as a message
const fetchCount = async () => {
  const resp = await fetch('https://api.example.com/count').json()
  const count = resp.count
  return {type: 'setCount', count}
}

const update = (state, msg) => {
  switch (msg.type) {
  case 'setCount':
    return {...state, count: msg.count}
  default:
    return state
  }
}

const fx = (state, msg) => {
  switch (msg.type) {
  case 'fetchCount':
    return [fetchCount]
  default:
    return []
  }
}

const [state, send] = store({
  state,
  update,
  middleware: fxware(fx)
})
```

Store will perform each effect concurrently, and feed their resulting messages back into the store. This allows you to model side-effects along with state changes in your reducer function, making side-effects deterministic and predictable.

### Creating and combining middleware

Store middleware is just a higher-order function that takes a state and a send function and returns a send function, e.g.:

```typescript
export type Middleware<Msg> = (state: Signal<State>) => (send: (msg: Msg) => void) => (msg: Msg) => void
```

This makes it easy to write your own middleware.

You can also combine middleware using a provided middleware composition helper:

```js
const [state, send] = store({
  state,
  update,
  middleware: middleware(
    logware({debug: true}),
    fxware(fx)
  )
})
```

Middleware provides a very powerful customization hook for stores.

## Hyperscript

Spellcaster hyperscript is a functional shorthand for creating reactive HTML elements.

```js
h(tag, props, config)
```

- Parameters
  - `{string} tag` - a string for the tag to be created
  - `{object} props` - an object, or a signal for an object that contains props to be set on the element
  - `{Array<HTMLElement|string>|(HTMLElement) => void} config` - an array of elements and strings, OR an optional callback that receives the element and can modify it
- Returns: `HTMLElement` - the constructed element

Here's a simple hello world example.

```js
const Greeting = greeting => h(
  'p',
  {className: 'greeting'},
  [
    greeting
  ]
)

Greeting("Hello world")
```

### Named tag functions

Alternatively, we can use the hyperscript `tags` object to get named hyperscript functions:

```js
import {tags} from './hyperscript.js'
const {div} = tags

const Greeting = title => div({className: 'greeting'}, [title])
```

Clean! Now let's add some interactivity. Hyperscript is signals-aware, so we can use signals to drive element changes.

```js
const Title = title => h1(
  {className: 'title'},
  // Automatically update the text content of the element with a signal
  text(title)
)

const Modal = (isHidden, children) => div(
  // Automatically update properties with signals, by passing a function that
  // returns an object.
  () => ({
    className: 'modal',
    hidden: isHidden()
  }),
  children
)
```

### Dynamic lists

What about rendering dynamic lists of children? For this, we can use `repeat(signal, view)`. It takes a signal of `Map<Key, Item>`, and will efficiently re-render children, updating, moving, or removing elements as needed, making the minimal number of DOM modifications.

```js
const Todos = todos => div(
  { className: 'todos' },
  repeat(todos, Todo)
);
```

With hyperscript, most of the DOM tree is static. Only dynamic properties, text, and `repeat()` are dynamic. This design approach is inspired by [SwiftUI](https://developer.apple.com/documentation/swiftui/list), and it makes DOM updates extremely efficient.

### Web components

Spellcaster Hyperscript also offers a lightweight helper that transforms any view function into a custom element:

```js
import { always } from "spellcaster/spellcaster.js";
import { component, css } from "spellcaster/hyperscript.js";

const styles = css`
:host {
  display: block;
}
`;

const props = () => ({ hello: always("Hello") });

const Hello = ({ hello }) => {
  return h('div', { className: 'title' }, text(hello));
};

component({
  tag: 'x-hello',
  styles: [baseStyles, styles],
  props,
  render: Hello
});
```

View functions that are registered as components receive the element instance as their props argument. This allows you to modify the element and use the element's properties as the function's props. To access the element instance, you can pass it in as a variable instead of destructuring:

```js
const Hello = (element) => {
  const { hello } = element;
  return h('div', { className: 'title' }, text(hello));
};
```

Like the rest of Spellcaster, the component's render function is called just once, to build the shadow DOM of the element and bind signals to specific places in the DOM. The component will wait until you append the element to the DOM to call the render function, giving you an opportunity to set element properties before the element shadow DOM is built.

```js
const [hello, setHello] = signal("Bonjour");

// Set a signal to drive the element
const helloElement = h('x-hello', { hello });

// Build shadow DOM
document.append(element);
```
