import {
  store,
  computed,
  next,
  unknown
} from '../../dist/spellcaster.js'

import {
  tags,
  repeat,
  text,
  cid,
  indexById
} from '../../dist/hyperscript.js'

const {div, button, input} = tags

const Msg = {}

Msg.complete = id => ({
  type: 'complete',
  id
})

Msg.updateInput = value => ({type: 'updateInput', value})
Msg.submitInput = value => ({type: 'submitInput', value})

const modelTodo = ({
  id=cid(),
  isComplete=false,
  text=''
}) => ({
  id,
  isComplete,
  text
})

const Todo = (todo, send) => div(
  {className: 'todo'},
  [
    div(
      {className: 'todo-text'},
      text(() => todo().text)
    ),
    button(
      {
        className: 'button-done',
        onclick: () => send(Msg.complete(todo().id, true))
      },
      text('Done')
    )
  ]
)

const modelInput = ({text=''}) => ({text})

const TodoInput = (state, send) => input(
  () => ({
    value: state().text,
    placeholder: 'Enter todo...',
    oninput: event => send(Msg.updateInput(event.target.value)),
    onkeyup: event => {
      if (event.key === 'Enter') {
        send(Msg.submitInput(event.target.value))
      }
    },
    type: 'text',
    className: 'todo-input'
  })
)

const modelApp = ({
  input=modelInput({}),
  todos=new Map()
}) => ({
  input,
  todos
})

const App = (state, send) => {
  const todos = computed(() => state().todos)
  return div(
    {className: 'app'},
    [
      TodoInput(
        computed(() => state().input),
        send
      ),
      div(
        {className: 'todos'},
        repeat(todos, todo => Todo(todo, send))
      )
    ]
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
  todos: indexById([
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

const [state, send] = store({
  init,
  update,
  debug: true
})

window.state = state

const appEl = App(state, send)
document.body.append(appEl)