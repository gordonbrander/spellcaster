import {signal} from '../../spellcaster.js'
import {tags, shadow, text} from '../../hyperscript.js'
const {div, button} = tags

const Counter = () => {
  const [count, setCount] = signal(0)

  return div(
    {className: 'counter'},
    shadow(
      div({className: 'counter-text'}, text(count)),
      button(
        {
          className: 'counter-button',
          onclick: () => setCount(count() + 1)
        },
        text('Increment')
      )
    )
  )
}

document.body.append(Counter())