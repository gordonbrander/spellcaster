import {
  constant,
  map,
  indexed,
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

const action = {}

action.complete = id => ({
  type: 'complete',
  id
})

action.updateInput = value => ({type: 'updateInput', value})
action.submitInput = value => ({type: 'submitInput', value})

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
  const $text = map($todo, todo => todo.text)

  const $buttonProps = map($todo, todo => ({
    className: 'button-done',
    onclick: () => send(action.complete(todo.id, true))
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
  const $props = map($input, input => ({
    value: input.text,
    oninput: event => send(action.updateInput(event.target.value)),
    onkeyup: event => {
      if (event.key === 'Enter') {
        send(action.submitInput(event.target.value))
      }
    },
    type: 'text',
    className: 'todo-input'
  }))

  return h('input', $props)
}

const modelApp = ({
  input=modelInput({}),
  todos=[]
}) => ({
  input,
  todos
})

const viewApp = ($state, send) => {
  const $input = map($state, state => state.input)

  const $todos = pipe(
    map($state, state => state.todos),
    indexed
  )

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
  todos: [
    ...state.todos,
    modelTodo({text})
  ]
})

const complete = (state, id) => next(
  {
    ...state,
    todos: state.todos.filter(todo => todo.id !== id)
  }
)

const [$state, send] = useStore({
  init,
  update,
  debug: true
})

window.$state = $state

const appEl = viewApp(animate($state), send)
document.body.append(appEl)