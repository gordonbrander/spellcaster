import {
  store,
  next,
  unknown
} from '../../tendril.js'

import {
  h,
  children,
  list,
  text,
  cid,
  index
} from '../../dom.js'

const msg = {}

msg.updateItems = ({type: 'updateItems'})

const modelItem = ({
  id=cid(),
  text=''
}) => ({
  id,
  text
})

const viewItem = (item, send) => h(
  'div',
  {className: 'item'},
  children(
    h(
      'div',
      {className: 'todo-text'},
      text(() => item().text)
    )
  )
)

const modelApp = ({
  items=new Map()
}) => ({
  items
})

const viewApp = (state, send) => h(
  'div',
  {className: 'app'},
  list(
    viewItem,
    () => state().items,
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
  const items = Array.from(state.items.values()).map(
    item => modelItem({id: item.id, text: Math.random()})
  )

  return next(
    modelApp({
      ...state,
      items: index(items)
    })
  )
}

const [state, send] = store({
  init,
  update,
  debug: true
})

const appEl = viewApp(state, send)
document.body.append(appEl)

setInterval(
  () => send(msg.updateItems),
  10
)