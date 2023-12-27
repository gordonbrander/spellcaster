import {
  map,
  indexed,
  pipe,
  useStore,
  next,
  unknown,
  index,
  animate
} from '../../tendril.js'

import {
  h,
  children,
  list,
  text,
  cid
} from '../../dom.js'

const action = {}

action.updateItems = ({type: 'updateItems'})

const modelItem = ({
  id=cid(),
  text=''
}) => ({
  id,
  text
})

const viewItem = ($item, send) => h(
  'div',
  {className: 'item'},
  children(
    h(
      'div',
      {className: 'todo-text'},
      text(map($item, item => item.text))
    )
  )
)

const modelApp = ({
  items=new Map()
}) => ({
  items
})

const viewApp = ($state, send) => h(
  'div',
  {className: 'app'},
  list(
    viewItem,
    map($state, state => state.items),
    send
  )
)

const init = () => {
  const itemList = []
  for (var i = 0; i < 1000; i++) {
    const item = modelItem({text: Math.random()})
    itemList.push(item)
  }
  const items = index(itemList)
  return next(modelApp({items}))
}

const update = (state, msg) => {
  switch (msg.type) {
  case 'updateItems':
    return updateItems(state)
  default:
    return unknown(state, msg)
  }
}

const updateItems = state => {
  const items = pipe(
    state.items.values(),
    Array.from,
    items => items.map(item => modelItem({id: item.id, text: Math.random()})),
    index
  )

  return next(
    modelApp({
      ...state,
      items
    })
  )
}

const [$state, send] = useStore({
  init,
  update,
  debug: true
})

const appEl = viewApp(animate($state), send)
document.body.append(appEl)

setInterval(
  () => send(action.updateItems),
  0
)