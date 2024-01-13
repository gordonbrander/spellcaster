// @ts-check
import {
  effect,
  takeValues,
  sample
} from './spellcaster.js'

/**
 * The counter that is incremented for `cid()`
 * @type {number}
 */
let _cid = 0

/**
 * Get an auto-incrementing client-side ID value.
 * IDs are NOT guaranteed to be stable across page refreshes.
 * @returns {string} a client ID string that is unique for the session.
 */
export const cid = () => `cid${_cid++}`

export const getId = object => object.id

/**
 * Index an iterable of items by key, returning a map.
 * @template Item
 * @template Key
 * @param {Iterable<Item>} iter 
 * @param {(item: Item) => Key} getKey 
 * @returns {Map<Key, Item>}
 */
export const index = (iter, getKey=getId) => {
  const indexed = new Map()
  for (const item of iter) {
    indexed.set(getId(item), item)
  }
  return indexed
}

/**
 * Symbol for list item key
 */
const __key__ = Symbol('list item key')

/**
 * @template Item
 * @template Key
 * @template Msg
 * @param {(state: () => Item, send: (msg: Msg) => void) => HTMLElement} view 
 * @param {() => Map<Key, Item>} states
 * @param {(msg: Msg) => void} send 
 * @returns {(parent: HTMLElement) => void}
 */
export const repeat = (view, states, send) => parent => {
  effect(() => {
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
        const child = view(
          takeValues(() => states().get(key)),
          send
        )
        child[__key__] = key
        insertElementAt(parent, child, index)
      }
    }
  })
}

/**
 * Insert element at index.
 * If element is already at index, this function is a no-op
 * (it doesn't remove-and-then-add element). By avoiding moving the element
 * unless needed, we preserve focus and selection state for elements that
 * don't move.
 * @param {HTMLElement} parent - the parent element to insert child into
 * @param {HTMLElement} element - the child element to insert
 * @param {number} index - the index at which to insert element
 */
export const insertElementAt = (parent, element, index) => {
  const elementAtIndex = parent.children[index]
  if (elementAtIndex === element) {
    return
  }
  parent.insertBefore(element, elementAtIndex)
}

export const children = (...children) => parent => {
  parent.replaceChildren(...children)
}

export const shadow = (...children) => parent => {
  parent.attachShadow({mode: 'open'})
  parent.shadowRoot.replaceChildren(...children)
}

/**
 * Write a signal of strings to the text content of a parent element.
 */
export const text = text => parent =>
  effect(() => setProp(parent, 'textContent', sample(text) ?? ''))

const noOp = () => {}

const isArray = Array.isArray

/**
 * Signals-aware hyperscript.
 * Create an element that can be updated with signals.
 * @param {string} tag - the HTML element type to create
 * @param {(() => object)|object} properties - a signal or object containing
 *   properties to set on the element.
 * @param {(element: HTMLElement) => void|Array<(HTMLElement|string)>} configure
 *   - either a function called with the element to configure it, or an array
 *   of HTMLElements and strings to append.
 * @returns {HTMLElement}
 */
export const h = (tag, properties, configure=noOp) => {
  const element = document.createElement(tag)

  effect(() => {
    setProps(element, sample(properties))
  })

  if (isArray(configure)) {
    element.replaceChildren(...configure)
  } else {
    configure(element)
  }

  return element
}

/**
 * @callback TagFactory
 * @param {(() => object)|object} properties - a signal or object containing
 *   properties to set on the element.
 * @param {(element: HTMLElement) => void|Array<(HTMLElement|string)>} configure
 *   - either a function called with the element to configure it, or an array
 *   of HTMLElements and strings to append.
 * @returns {HTMLElement}
 */

/**
 * Create a tag factory function - a specialized version of `h()` for a
 * specific tag.
 * @param {string} tag 
 * @returns {TagFactory}
 */
const tag = tag => (properties, configure=noOp) =>
  h(tag, properties, configure)

/**
 * Create a tag factory function, by calling any proprty of `tags`.
 * The key will be used as the tag name for the factory.
 * @example
 * const {div} = tags
 * div({className: 'wrapper'})
 */
export const tags = new Proxy({}, {
  get: (target, key) => {
    if (typeof key !== 'string') {
      throw new TypeError('Tag must be string')
    }
    return tag(key)
  }
})

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
 * @template Value - a value that corresponds to the property key
 * @param {object} object - the object to set property on
 * @param {string} key - the key
 * @param {Value} value - the value to set
 */
export const setProp = (object, key, value) => {
  if (LAYOUT_TRIGGERING_PROPS.has(key)) {
    console.warn(`Checking property value for ${key} triggers layout. Consider writing to this property without using setProp().`)
  }

  if (object[key] !== value) {
    console.log({prev: object[key], next: value})
    object[key] = value
  }
}

/**
 * Set properties on an element, but only if the value has actually changed.
 * @param {HTMLElement} element 
 * @param {object} props
 */
const setProps = (element, props) => {
  for (const [key, value] of Object.entries(props)) {
    setProp(element, key, value)
  }
}