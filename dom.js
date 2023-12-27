import {scope, wrapSignal, setCancel, unwrapComplete, noOp} from './tendril.js'

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

/**
 * Symbol for list item key
 */
const __key__ = Symbol('list item key')

export const list = (view, $states, send) => parent => {
  const cancel = $states.listen(states => {
    let i = 0

    // Build an index of children and a list of children to remove.
    // Note that we must build a list of children to remove, since
    // removing in-place would change the live node list and bork iteration.
    const children = new Map()
    const removes = []
    for (const child of parent.children) {
      children.set(child[__key__], child)
      if (!states.has(child[__key__])) {
        removes.push(child)
      }
    }

    for (const child of removes) {
      parent.removeChild(child)
    }

    for (const key of states.keys()) {
      const index = i++
      const child = children.get(key)
      if (child != null) {
        insertElementAt(parent, child, index)
      } else {
        const child = view(
          scope($states, states => states.get(key)),
          send
        )
        child[__key__] = key
        insertElementAt(parent, child, index)
      }
    }
  })
  setCancel(parent, cancel)
  return parent
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
  for (const child of children) {
    parent.append(child)
  }
}

export const text = text => parent => {
  const cancel = wrapSignal(text)
    .listen(text => parent.textContent = unwrapComplete(text))
  setCancel(parent, cancel)
  return parent
}

export const h = (tag, properties, configure=noOp) => {
  const element = document.createElement(tag)

  wrapSignal(properties)
    .listen(value => props(element, unwrapComplete(value)))

  configure(element)

  return element
}

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
export const prop = (object, key, value) => {
  if (LAYOUT_TRIGGERING_PROPS.has(key)) {
    console.warn(`Checking property value for ${key} triggers layout. Consider writing to this property without using prop().`)
  }

  if (object[key] !== value) {
    object[key] = value
  }
}

const props = (element, props) => {
  for (let [key, value] of Object.entries(props)) {
    prop(element, key, value)
  }
}