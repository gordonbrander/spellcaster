import { store, computed, next, unknown } from '../../spellcaster.js';
import { tags, repeat, text, cid, index } from '../../hyperscript.js';
const { div, button, input } = tags;
const updateInputMsg = (value) => ({
    type: 'updateInput',
    value
});
const submitInputMsg = (value) => ({
    type: 'submitInput',
    value
});
const completeMsg = (id, isComplete) => ({
    type: 'complete',
    id,
    isComplete
});
const TodoModel = ({ id = cid(), isComplete = false, text = '' }) => ({
    id,
    isComplete,
    text
});
const Todo = (todo, send) => div({ className: 'todo' }, [
    div({ className: 'todo-text' }, text(() => todo().text)),
    button({
        className: 'button-done',
        onclick: () => send(completeMsg(todo().id, true))
    }, text('Done'))
]);
const InputModel = ({ text = '' }) => ({ text });
const TodoInput = (state, send) => input(() => ({
    value: state().text,
    placeholder: 'Enter todo...',
    oninput: event => send(updateInputMsg(event.target.value)),
    onkeyup: event => {
        if (event.key === 'Enter') {
            send(submitInputMsg(event.target.value));
        }
    },
    type: 'text',
    className: 'todo-input'
}));
const AppModel = ({ input = InputModel({}), todos = new Map() }) => ({
    input,
    todos
});
const App = (state, send) => div({ className: 'app' }, [
    TodoInput(computed(() => state().input), send),
    div({ className: 'todos' }, repeat(Todo, computed(() => state().todos), send))
]);
const init = () => next(AppModel({}));
const update = (state, msg) => {
    switch (msg.type) {
        case 'updateInput':
            return updateInput(state, msg.value);
        case 'submitInput':
            return submitInput(state, msg.value);
        case 'complete':
            return complete(state, msg.id);
        default:
            return unknown(state, msg);
    }
};
const updateInput = (state, text) => next({
    ...state,
    input: InputModel({ text })
});
const submitInput = (state, text) => next({
    ...state,
    input: InputModel({ text: '' }),
    todos: index([
        ...state.todos.values(),
        TodoModel({ text })
    ])
});
const complete = (state, id) => {
    if (!state.todos.has(id)) {
        console.log("No item for ID. Doing nothing.", id);
        return next(state);
    }
    const todos = new Map(state.todos);
    todos.delete(id);
    return next({
        ...state,
        todos
    });
};
const [state, send] = store({
    init,
    update,
    debug: true
});
const appEl = App(state, send);
document.body.append(appEl);
