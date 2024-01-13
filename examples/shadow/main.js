import { signal } from '../../spellcaster.js'
import { shadow, tags, text } from '../../hyperscript.js'
const {div, button} = tags

const viewCounter = () => {
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

document.body.append(viewCounter())