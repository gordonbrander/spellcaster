import {
  effect,
  takeValues,
  sample,
  Signal
} from './spellcaster.js'

/** The counter that is incremented for `cid()` */
let _cid = 0

/**
 * Get an auto-incrementing client-side ID value.
 * IDs are NOT guaranteed to be stable across page refreshes.
 */
export const cid = (): string => `cid${_cid++}`

/** Index an iterable of items by key, returning a map. */
export const index = <Key, Item>(
  iter: Iterable<Item>,
  getKey: (item: Item) => Key
): Map<Key, Item> => {
  const indexed = new Map<Key, Item>()
  for (const item of iter) {
    indexed.set(getKey(item), item)
  }
  return indexed
}

/** An item that exposes an ID field that is unique within its collection */
export interface Identifiable {
  id: any
}

export const getId = <Key, Item extends Identifiable>(
  item: Item
) => item.id

/** Index a collection by ID */
export const indexById = <Key, Item extends Identifiable>(
  iter: Iterable<Item>
): Map<Key, Item> => index(iter, getId)

/** Symbol for list item key */
const __key__ = Symbol('list item key')

/** A view-constructing function */
export type View<State> = (state: Signal<State>) => HTMLElement

/**
 * Create a function to efficiently render a dynamic list of views on a
 * parent element.
 */
export const repeat = <Key, State>(
  states: Signal<Map<Key, State>>,
  view: View<State>
) => (parent: HTMLElement) => effect(() => {
  // Build an index of children and a list of children to remove.
  // Note that we must build a list of children to remove, since
  // removing in-place would change the live node list and bork iteration.
  const children = new Map()
  const removes = []
  for (const child of parent.children) {
    children.set(child[__key__], child)
    if (!states().has(child[__key__])) {
      removes.push(child)
    }
  }

  for (const child of removes) {
    parent.removeChild(child)
  }

  let i = 0
  for (const key of states().keys()) {
    const index = i++
    const child = children.get(key)
    if (child != null) {
      insertElementAt(parent, child, index)
    } else {
      const child = view(takeValues(() => states().get(key)))
      child[__key__] = key
      insertElementAt(parent, child, index)
    }
  }
})

/**
 * Insert element at index.
 * If element is already at index, this function is a no-op
 * (it doesn't remove-and-then-add element). By avoiding moving the element
 * unless needed, we preserve focus and selection state for elements that
 * don't move.
 */
export const insertElementAt = (
  parent: HTMLElement,
  element: HTMLElement,
  index: number
) => {
  const elementAtIndex = parent.children[index]
  if (elementAtIndex === element) {
    return
  }
  parent.insertBefore(element, elementAtIndex)
}

export const children = (
  ...children: Array<HTMLElement | string>
) => (parent: HTMLElement) => {
  parent.replaceChildren(...children)
}

export const shadow = (
  ...children: Array<HTMLElement | string>
) => (parent: HTMLElement) => {
  parent.attachShadow({mode: 'open'})
  parent.shadowRoot.replaceChildren(...children)
}

/**
 * Write a value or signal of values to the text content of a parent element.
 * Value will be coerced to string. If nullish, will be coerced to empty string.
 */
export const text = (
  text: Signal<any> | any
) => parent =>
  effect(() => setProp(parent, 'textContent', sample(text) ?? ''))

const noConfigure = (parent: HTMLElement) => {}

const isArray = Array.isArray

/**
 * Signals-aware hyperscript.
 * Create an element that can be updated with signals.
 * @param tag - the HTML element type to create
 * @param properties - a signal or object containing
 *   properties to set on the element.
 * @param configure - either a function called with the element to configure it,
 *  or an array of HTMLElements and strings to append. Optional.
 * @returns {HTMLElement}
 */
export const h = (
  tag: string,
  properties: Record<string, any> | Signal<Record<string, any>>,
  configure: (
    Array<HTMLElement | string> |
    ((element: HTMLElement) => void)
  ) = noConfigure
) => {
  const element = document.createElement(tag)

  effect(() => setProps(element, sample(properties)))

  if (isArray(configure)) {
    element.replaceChildren(...configure)
  } else {
    configure(element)
  }

  return element
}

type TagFactory = (
  properties: Record<string, any> | Signal<Record<string, any>>,
  configure?: (
    Array<HTMLElement | string> |
    ((element: HTMLElement) => void)
  )
) => HTMLElement

/**
 * Create a tag factory function - a specialized version of `h()` for a
 * specific tag.
 * @example
 * const div = tag('div')
 * div({className: 'wrapper'})
 */
export const tag = (tag: string): TagFactory =>
  (properties, configure=noConfigure) => h(tag, properties, configure)

/**
 * Create a tag factory function by accessing any property of `tags`.
 * The key will be used as the tag name for the factory.
 * Key must be a string, and will be passed verbatim as the tag name to
 * `document.createElement()` under the hood.
 * @example
 * const {div} = tags
 * div({className: 'wrapper'})
 */
export const tags: Record<string, TagFactory> = new Proxy(
  Object.freeze({}),
  {
    get: (_, key): TagFactory => {
      if (typeof key !== 'string') {
        throw new TypeError('Tag must be string')
      }
      return tag(key)
    }
  }
)

/**
 * Layout-triggering DOM properties.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 */
const LAYOUT_TRIGGERING_PROPS = new Set(['innerText'])

/**
 * Set object key, but only if value has actually changed.
 * This is useful when setting keys on DOM elements, where setting the same 
 * value twice might trigger an unnecessary reflow or a style recalc.
 * prop caches the written value and only writes the new value if it
 * is different from the last-written value.
 * 
 * In most cases, we can simply read the value of the DOM property itself.
 * However, there are footgun properties such as `innerText` which
 * will trigger reflow if you read from them. In these cases we warn developers.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 *
 * @param object - the object to set property on
 * @param key - the key
 * @param value - the value to set
 */
export const setProp = (
  element: Node,
  key: string,
  value: any
) => {
  if (LAYOUT_TRIGGERING_PROPS.has(key)) {
    console.warn(`Checking property value for ${key} triggers layout. Consider writing to this property without using setProp().`)
  }

  if (element[key] !== value) {
    element[key] = value
  }
}

/**
 * Set properties on an element, but only if the value has actually changed.
 */
const setProps = (
  element: Node,
  props: Record<string, any>
) => {
  for (const [key, value] of Object.entries(props)) {
    setProp(element, key, value)
  }
}

const templates = new Map<string, HTMLTemplateElement>();

/** Get cached template tag for string */
const template = (html: string) => {
  let template = templates.get(html);
  if (template == null) {
    template = document.createElement('template');
    template.innerHTML = html;
    templates.set(html, template);
  }
  return template;
}

template.clear = () => {
  templates.clear();
}

const replaceWith = (node: Node | undefined, replacement: Node) => {
  if (node == null) {
    console.warn('Node to replace is undefined');
    return
  }
  node.parentNode.replaceChild(replacement, node);
}

const replaceContent = (node: Node, replacement: any) => {
  if (replacement instanceof Node) {
    replaceWith(node, replacement);
  } else {
    replaceWith(node, document.createTextNode(`${replacement}`));
  }
}

const isPropKey = (key: string) => key.startsWith('.')

const cleanPropKey = (key: string) => key.replace(/\./, '')

const replaceReactiveProp = (element: Element, key: string, value: any) => {
  // Remove leading dot
  const cleanKey = cleanPropKey(key)
  effect(() => element[cleanKey] = sample(value))
  element.removeAttribute(key)
}

const isEventKey = (key: string) => key.startsWith('@')

const cleanEventKey = (key: string) => key.replace(/^@/, '')

const replaceEvent = (element: Element, key: string, value: any) => {
  // Remove leading dot
  const cleanKey = cleanEventKey(key);
  effect(() => element[`on${cleanKey}`] = sample(value))
  element.removeAttribute(key);
}

const TEMPLATE_MARKER = '#SPELLCASTER_TEMPLATE_MARKER#'

export const html = (strings: TemplateStringsArray, ...replacements: any[]) => {
  const str = strings.join(TEMPLATE_MARKER);
  const templateEl = template(str);
  const cloneEl = templateEl.content.cloneNode(true);

  const walker = document.createTreeWalker(
    cloneEl,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  // Reverse replacements, since we want to replace from left to right.
  // Popping off of the end of the reversed array is a bit more efficient.
  replacements.reverse();

  // Do template replacements
  let node: Node;
  while (node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      // Capture attrs, since we're about to modify them during iteration.
      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        if (attr.value === TEMPLATE_MARKER) {
          const replacement = replacements.pop();
          if (isPropKey(attr.name)) {
            replaceReactiveProp(element, attr.name, replacement);
          } else if (isEventKey(attr.name)) {
            replaceEvent(element, attr.name, replacement);
          } else {
            element.setAttribute(attr.name, replacement);
          }
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const replacement = replacements.pop();
      replaceContent(node, replacement);
    }
  }

  return cloneEl;
}