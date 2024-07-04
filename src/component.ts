export class SpellcasterElement<T> extends HTMLElement {
  #state: T|undefined = undefined
  #shadow: ShadowRoot

  constructor() {
    super()
    this.#shadow = this.attachShadow({mode: 'closed'})
    this.#shadow.adoptedStyleSheets = this.css()
  }

  css(): CSSStyleSheet[] {
    return []
  }

  html(state: T): Element {
    return document.createElement('div')
  }

  setState(state: T) {
    this.#state = state
    this.#shadow.replaceChildren(this.html(state))
  }

  get state() {
    return this.#state
  }

  set state(state: T) {
    this.setState(state)
  }
}

/**
 * Define a custom reactive element.
 * 
 * @example
 * const Foo = component({
 *   tag: 'x-foo',
 *   css: () => [css`h1 { color: red; }`],
 *   html: (state) => {
 *     return div({}, text(() => state().title))
 *   }
 * }
 * 
 * const fooEl = Foo(someSignal)
 */
export const component = ({
  tag,
  css,
  html
}) => {
  class CustomSpellcasterElement<T> extends SpellcasterElement<T> {
    css() {
      return css()
    }

    html(state: T) {
      return html(state)
    }
  }

  customElements.define(tag, CustomSpellcasterElement)

  const create = <T>(state: T) => {
    const element = document.createElement(tag) as SpellcasterElement<T>
    element.setState(state)
    return element
  }

  return create
}

export default component