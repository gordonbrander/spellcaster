import { signal } from '../../tendril.js'

import {
  h,
  text,
  children
} from '../../hyperscript.js'

const viewCounter = () => {
  const [count, setCount] = signal(0)

  return h(
    'div',
    {className: 'counter'},
    children(
      h('div', {className: 'counter-text'}, text(count)),
      h(
        'button',
        {
          className: 'counter-button',
          onclick: () => setCount(count() + 1)
        },
        text('Increment')
      )
  ))
}

document.body.append(viewCounter())