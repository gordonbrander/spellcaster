import {signal, hyperscript} from '../../bundle/spellcaster.js'
const {text} = hyperscript
const {div, button} = hyperscript.tags

const Counter = () => {
  const [count, setCount] = signal(0)

  return div(
    {className: 'counter'},
    [
      div({className: 'counter-text'}, text(count)),
      button(
        {
          className: 'counter-button',
          onclick: () => setCount(count() + 1),
          attrs: {
            "data-short-desc": "Increases the count by one each time you click this button."
          }
        },
        text('Increment')
      )
    ]
  )
}

document.body.replaceChildren(Counter())