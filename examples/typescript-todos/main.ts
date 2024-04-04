import {
  store,
  computed,
  logware
} from '../../src/spellcaster.ts'

import {
  tags,
  repeat,
  text,
  cid,
  indexById,
  Identifiable
} from '../../src/hyperscript.js'

const {div, button, input} = tags

// Messages

type Msg = UpdateInputMsg | SubmitInputMsg | CompleteMsg

type UpdateInputMsg = {
  type: 'updateInput'
  value: string
}

const updateInputMsg = (value: string): UpdateInputMsg => ({
  type: 'updateInput',
  value
})

type SubmitInputMsg = {
  type: 'submitInput'
  value: string
}

const submitInputMsg = (value: string): SubmitInputMsg => ({
  type: 'submitInput',
  value
})

type CompleteMsg = {
  type: 'complete'
  id: string
  isComplete: boolean
}

const completeMsg = (id: string, isComplete: boolean): CompleteMsg => ({
  type: 'complete',
  id,
  isComplete
})

// Models and views

interface TodoModel extends Identifiable {
  id: string
  isComplete: boolean
  text: string
}

const TodoModel = ({
  id=cid(),
  isComplete=false,
  text=''
}): TodoModel => ({
  id,
  isComplete,
  text
})

const Todo = (
  todo: () => TodoModel,
  send: (msg: Msg) => void
) => div(
  {className: 'todo'},
  [
    div(
      {className: 'todo-text'},
      text(() => todo().text)
    ),
    button(
      {
        className: 'button-done',
        onclick: () => send(completeMsg(todo().id, true))
      },
      text('Done')
    )
  ]
)

type InputModel = {
  text: string
}

const InputModel = ({text=''}): InputModel => ({text})

const TodoInput = (
  state: () => InputModel,
  send: (msg: Msg) => void
) => input(
  () => ({
    value: state().text,
    placeholder: 'Enter todo...',
    oninput: event => send(updateInputMsg(event.target.value)),
    onkeyup: event => {
      if (event.key === 'Enter') {
        send(submitInputMsg(event.target.value))
      }
    },
    type: 'text',
    className: 'todo-input'
  })
)

type AppModel = {
  input: InputModel
  todos: Map<string, TodoModel>
}

const AppModel = ({
  input=InputModel({}),
  todos=new Map<string, TodoModel>()
}): AppModel => ({
  input,
  todos
})

const App = (
  state: () => AppModel,
  send: (msg: Msg) => void
): HTMLElement => {
  const todos = computed(() => state().todos)
  const input = computed(() => state().input)

  return div(
    {className: 'app'},
    [
      TodoInput(input, send),
      div(
        {className: 'todos'},
        repeat(todos, todo => Todo(todo, send))
      )
    ]
  )
}

const init = () => AppModel({})

const update = (
  state: AppModel,
  msg: Msg
): AppModel => {
  switch (msg.type) {
  case 'updateInput':
    return updateInput(state, msg.value)
  case 'submitInput':
    return submitInput(state, msg.value)
  case 'complete':
    return complete(state, msg.id)
  default:
    console.warn("Unknown message type", msg)
    return state
  }
}

const updateInput = (
  state: AppModel,
  text: string
) => AppModel({
  ...state,
  input: InputModel({text})
})

const submitInput = (
  state: AppModel,
  text: string
) => AppModel({
  ...state,
  input: InputModel({text: ''}),
  todos: indexById<string, TodoModel>([
    ...state.todos.values(),
    TodoModel({text})
  ])
})

const complete = (
  state: AppModel,
  id: string
) => {
  if (!state.todos.has(id)) {
    console.log("No item for ID. Doing nothing.", id)
    return state
  }
  const todos = new Map(state.todos)
  todos.delete(id)
  return AppModel({
    ...state,
    todos
  })
}

const [state, send] = store({
  state: init(),
  update,
  middleware: logware({debug: true})
})

const appEl = App(state, send)
document.body.append(appEl)