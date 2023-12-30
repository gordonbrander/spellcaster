import {
  scope,
  indexIter,
  animate,
  pipe,
  useStore,
  next,
  unknown
} from '../../tendril.js'

import {
  h,
  children,
  list,
  text,
  cid
} from '../../dom.js'

const msg = {}

msg.complete = id => ({
  type: 'complete',
  id
})

msg.updateInput = value => ({type: 'updateInput', value})
msg.submitInput = value => ({type: 'submitInput', value})

const modelTodo = ({
  id=cid(),
  isComplete=false,
  text=''
}) => ({
  id,
  isComplete,
  text
})

const viewTodo = ($todo, send) => {
  const $text = scope($todo, todo => todo.text)

  const $buttonProps = scope($todo, todo => ({
    className: 'button-done',
    onclick: () => send(msg.complete(todo.id, true))
  }))

  return h(
    'div',
    {className: 'todo'},
    children(
      h(
        'div',
        {className: 'todo-text'},
        text($text)
      ),
      h(
        'button',
        $buttonProps,
        text('Done')
      )
    )
  )
}

const modelInput = ({text=''}) => ({text})

const viewInput = ($input, send) => {
  const $props = scope($input, input => ({
    value: input.text,
    oninput: event => send(msg.updateInput(event.target.value)),
    onkeyup: event => {
      if (event.key === 'Enter') {
        send(msg.submitInput(event.target.value))
      }
    },
    type: 'text',
    className: 'todo-input'
  }))

  return h('input', $props)
}

const modelApp = ({
  input=modelInput({}),
  todos=new Map()
}) => ({
  input,
  todos
})

const viewApp = ($state, send) => {
  const $input = scope($state, state => state.input)

  const $todos = scope($state, state => state.todos)

  return h(
    'div',
    {className: 'app'},
    children(
      viewInput($input, send),
      h(
        'div',
        {className: 'todos'},
        list(viewTodo, $todos, send)
      )
    )
  )
}

const init = () => next(
  modelApp({})
)

const update = (state, msg) => {
  switch (msg.type) {
  case 'updateInput':
    return updateInput(state, msg.value)
  case 'submitInput':
    return submitInput(state, msg.value)
  case 'complete':
    return complete(state, msg.id)
  default:
    return unknown(state, msg)
  }
}

const updateInput = (state, text) => next({
  ...state,
  input: modelInput({text})
})

const submitInput = (state, text) => next({
  ...state,
  input: modelInput({text: ''}),
  todos: indexIter([
    ...state.todos.values(),
    modelTodo({text})
  ])
})

const complete = (state, id) => {
  if (!state.todos.has(id)) {
    console.log("No item for ID. Doing nothing.", id)
    return next(state)
  }
  const todos = new Map(state.todos)
  todos.delete(id)
  return next({
    ...state,
    todos
  })
}

const [$state, send] = useStore({
  init,
  update,
  debug: true
})

window.$state = $state

const appEl = viewApp($state, send)
document.body.append(appEl)