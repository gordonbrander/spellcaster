import {signal, hyperscript} from '../../bundle/spellcaster.js'
const {text, component} = hyperscript
const {div, button} = hyperscript.tags

const Counter = component({
  tag: 'x-counter',
  html: ({count, setCount}) => {
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
})

const [count, setCount] = signal(0)
const counter = Counter({count, setCount})

document.body.replaceChildren(counter)