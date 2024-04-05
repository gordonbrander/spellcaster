import { Signal } from './spellcaster.js';
/**
 * Get an auto-incrementing client-side ID value.
 * IDs are NOT guaranteed to be stable across page refreshes.
 */
export declare const cid: () => string;
/** Index an iterable of items by key, returning a map. */
export declare const index: <Key, Item>(iter: Iterable<Item>, getKey: (item: Item) => Key) => Map<Key, Item>;
/** An item that exposes an ID field that is unique within its collection */
export interface Identifiable {
    id: any;
}
export declare const getId: <Key, Item extends Identifiable>(item: Item) => any;
/** Index a collection by ID */
export declare const indexById: <Key, Item extends Identifiable>(iter: Iterable<Item>) => Map<Key, Item>;
/** A view-constructing function */
export type View<State> = (state: Signal<State>) => HTMLElement;
/**
 * Create a function to efficiently render a dynamic list of views on a
 * parent element.
 */
export declare const repeat: <Key, State>(states: Signal<Map<Key, State>>, view: View<State>) => (parent: HTMLElement) => () => void;
/**
 * Insert element at index.
 * If element is already at index, this function is a no-op
 * (it doesn't remove-and-then-add element). By avoiding moving the element
 * unless needed, we preserve focus and selection state for elements that
 * don't move.
 */
export declare const insertElementAt: (parent: HTMLElement, element: HTMLElement, index: number) => void;
export declare const children: (...children: Array<HTMLElement | string>) => (parent: HTMLElement) => void;
export declare const shadow: (...children: Array<HTMLElement | string>) => (parent: HTMLElement) => void;
/**
 * Write a value or signal of values to the text content of a parent element.
 * Value will be coerced to string. If nullish, will be coerced to empty string.
 */
export declare const text: (text: Signal<any> | any) => (parent: any) => () => void;
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
export declare const h: (tag: string, properties: Record<string, any> | Signal<Record<string, any>>, configure?: (string | HTMLElement)[] | ((element: HTMLElement) => void)) => HTMLElement;
type TagFactory = (properties: Record<string, any> | Signal<Record<string, any>>, configure?: (Array<HTMLElement | string> | ((element: HTMLElement) => void))) => HTMLElement;
/**
 * Create a tag factory function - a specialized version of `h()` for a
 * specific tag.
 * @example
 * const div = tag('div')
 * div({className: 'wrapper'})
 */
export declare const tag: (tag: string) => TagFactory;
/**
 * Create a tag factory function by accessing any property of `tags`.
 * The key will be used as the tag name for the factory.
 * Key must be a string, and will be passed verbatim as the tag name to
 * `document.createElement()` under the hood.
 * @example
 * const {div} = tags
 * div({className: 'wrapper'})
 */
export declare const tags: Record<string, TagFactory>;
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
export declare const setProp: (element: Node, key: string, value: any) => void;
export {};
