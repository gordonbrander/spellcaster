import {
  useStore,
  next,
  unknown,
  map,
  index,
  list,
  animate,
  cid,
  render,
  html
} from '../../tendril.js'

const Msg = {}
Msg.setCardText = (id, value) => ({type: 'setCardText', id, value})
Msg.append = value => ({type: 'append', value})

const el = tag => document.createElement(tag)

const Card = (state, send) => {
  const cardEl = el('article')
  cardEl.classList.add('card')

  cardEl.onclick = event => send(
    Msg.setCardText(state().id, `Now: ${Date.now()}`)
  )

  const contentEl = el('div')
  contentEl.classList.add('card', 'content')
  cardEl.append(contentEl)

  let text = map(state, state => state.text)
  text.sub(text => contentEl.textContent = text)

  return cardEl
}

const Deck = (cards, send) => {
  let deckEl = el('div')
  deckEl.classList.add('deck')
  let cancel = list(deckEl, cards, state => Card(state, send))
  return deckEl
}
  
const App = (state, send) => {
  let appEl = el('div')
  appEl.classList.add('app')

  let deck = map(state, state => state.deck)
  let deckEl = Deck(deck, send)
  appEl.append(deckEl)

  let buttonEl = el('button')
  buttonEl.textContent = 'Append'
  buttonEl.onclick = () => send(
    Msg.append({
      id: cid(),
      text: 'text'
    })
  )
  appEl.append(buttonEl)

  return appEl
}

const init = () => next(
  {
    deck: index([
      {
        id: cid(),
        text: 'Abelisaurus'
      },
      {
        id: cid(),
        text: 'Acheroraptor'
      },
      {
        id: cid(),
        text: 'Achillesaurus'
      }
    ])
  }
)

/**
 * Create a draft array from an index, modifying it with `update`,
 * and returning a new index.
 */
export const produceIndex = (map, update) => {
  const draft = [...map.values()]
  const array = update(draft)
  return index(array)
}

const setCardText = (state, id, text) => {
  const card = state.deck.get(id)
  if (card == null) {
    console.log('No card for ID. Doing nothing.', id)
    return next(state)
  }
  const deck = new Map(state.deck)
  deck.set(id, {...card, text})
  return next({...state, deck})
}

const appendCard = (state, card) => {
  const deck = produceIndex(state.deck, cards => {
    cards.push(card)
    return cards
  })
  return next({...state, deck})
}

const update = (state, msg) => {
  switch (msg.type) {
  case 'append':
    return appendCard(state, msg.value)
  case 'setCardText':
    return setCardText(state, msg.id, msg.value)
  default:
    return unknown(state, msg)
  }
}

const [state, send] = useStore({
  debug: true,
  init,
  update
})

let appEl = App(animate(state), send)

document.body.append(appEl)

const articleTemplate = html`
<article class="article">
  <hgroup>
    <h1></h1>
    <p></p>
  </hgroup>
  <div class="article-content content">
  </div>
</article>
`

const fragment = render(articleTemplate)
console.log(fragment)