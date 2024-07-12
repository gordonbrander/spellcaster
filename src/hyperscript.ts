import { effect, takeValues, sample, Signal } from "./spellcaster.js";

export { cid, getId, indexById, index, Identifiable } from "./util.js";

/** A view-constructing function */
export type View<State> = (state: Signal<State>) => HTMLElement;

/** Symbol for list item key */
const __key__ = Symbol("list item key");

/**
 * Create a function to efficiently render a dynamic list of views on a
 * parent element.
 */
export const repeat =
  <Key, State>(states: Signal<Map<Key, State>>, view: View<State>) =>
  (parent: HTMLElement) =>
    effect(() => {
      // Build an index of children and a list of children to remove.
      // Note that we must build a list of children to remove, since
      // removing in-place would change the live node list and bork iteration.
      const children = new Map();
      const removes = [];
      for (const child of parent.children) {
        children.set(child[__key__], child);
        if (!states().has(child[__key__])) {
          removes.push(child);
        }
      }

      for (const child of removes) {
        parent.removeChild(child);
      }

      let i = 0;
      for (const key of states().keys()) {
        const index = i++;
        const child = children.get(key);
        if (child != null) {
          insertElementAt(parent, child, index);
        } else {
          const child = view(takeValues(() => states().get(key)));
          child[__key__] = key;
          insertElementAt(parent, child, index);
        }
      }
    });

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
  index: number,
) => {
  const elementAtIndex = parent.children[index];
  if (elementAtIndex === element) {
    return;
  }
  parent.insertBefore(element, elementAtIndex);
};

export const children =
  (...children: Array<HTMLElement | string>) =>
  (parent: HTMLElement) => {
    parent.replaceChildren(...children);
  };

export const shadow =
  (...children: Array<HTMLElement | string>) =>
  (parent: HTMLElement) => {
    parent.attachShadow({ mode: "open" });
    parent.shadowRoot.replaceChildren(...children);
  };

/**
 * Write a value or signal of values to the text content of a parent element.
 * Value will be coerced to string. If nullish, will be coerced to empty string.
 */
export const text = (text: Signal<any> | any) => (parent) =>
  effect(() => setProp(parent, "textContent", sample(text) ?? ""));

const isArray = Array.isArray;

export type ElementConfigurator =
  | Array<HTMLElement | string>
  | ((element: HTMLElement) => void);

/**
 * Signals-aware hyperscript.
 * Create an element that can be updated with signals.
 * @param tag - the HTML element type to create
 * @param properties - a signal or object containing
 *   properties to set on the element.
 * @param configure - either a function called with the element to configure it,
 *  or an array of HTMLElements and strings to append. Optional.
 */
export const h = (
  tag: string,
  properties: Record<string, any> | Signal<Record<string, any>>,
  configure: ElementConfigurator = noConfigure,
): HTMLElement => {
  const element = document.createElement(tag);

  effect(() => setProps(element, sample(properties)));
  configureElement(element, configure);

  return element;
};

type TagFactory = (
  properties: Record<string, any> | Signal<Record<string, any>>,
  configure?: ElementConfigurator,
) => HTMLElement;

/**
 * Create a tag factory function - a specialized version of `h()` for a
 * specific tag.
 * @example
 * const div = tag('div')
 * div({className: 'wrapper'})
 */
export const tag =
  (tag: string): TagFactory =>
  (properties, configure = noConfigure) =>
    h(tag, properties, configure);

/**
 * Create a tag factory function by accessing any property of `tags`.
 * The key will be used as the tag name for the factory.
 * Key must be a string, and will be passed verbatim as the tag name to
 * `document.createElement()` under the hood.
 * @example
 * const {div} = tags
 * div({className: 'wrapper'})
 */
export const tags: Record<string, TagFactory> = new Proxy(Object.freeze({}), {
  get: (_, key): TagFactory => {
    if (typeof key !== "string") {
      throw new TypeError("Tag must be string");
    }
    return tag(key);
  },
});

const noConfigure = (parent: HTMLElement) => {};

const configureElement = (
  element: HTMLElement,
  configure: ElementConfigurator = noConfigure,
) => {
  if (isArray(configure)) {
    element.replaceChildren(...configure);
  } else {
    configure(element);
  }
};

/**
 * Layout-triggering DOM properties.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 */
const LAYOUT_TRIGGERING_PROPS = new Set(["innerText"]);

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
export const setProp = (element: Node, key: string, value: any) => {
  if (LAYOUT_TRIGGERING_PROPS.has(key)) {
    console.warn(
      `Checking property value for ${key} triggers layout. Consider writing to this property without using setProp().`,
    );
  }

  if (element[key] !== value) {
    element[key] = value;
  }
};

/**
 * Set properties on an element, but only if the value has actually changed.
 */
const setProps = (element: Node, props: Record<string, any>) => {
  for (const [key, value] of Object.entries(props)) {
    setProp(element, key, value);
  }
};

const stylesheetCache = new Map<string, CSSStyleSheet>();

/** Get or create a cached stylesheet from a string */
export const stylesheet = (cssString: string): CSSStyleSheet => {
  if (stylesheetCache.has(cssString)) {
    return stylesheetCache.get(cssString);
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssString);
  stylesheetCache.set(cssString, sheet);
  return sheet;
};

/**
 * CSS template literal tag
 * Takes a string without replacements and returns a CSSStyleSheet.
 */
export const css = (parts: TemplateStringsArray) => {
  if (parts.length !== 1) {
    throw new TypeError(`css string must not contain dynamic replacements`);
  }
  const [cssString] = parts;
  return stylesheet(cssString);
};

/**
 * Custom element base for Spellcaster
 */
export class SpellcasterElement<T> extends HTMLElement {
  #state: T | undefined = undefined;
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.createShadow();
    this.#shadow.adoptedStyleSheets = this.styles();
  }

  createShadow() {
    return this.attachShadow({ mode: "closed" });
  }

  styles(): CSSStyleSheet[] {
    return [];
  }

  render(state: T): Node {
    return new DocumentFragment();
  }

  setState(state: T) {
    this.#state = state;
    this.#shadow.replaceChildren(this.render(state));
  }

  get state() {
    return this.#state;
  }

  set state(state: T) {
    this.setState(state);
  }
}

const noStyles = () => [];

/**
 * Define and register a custom reactive element.
 * Returns a hyperscript function that creates an instance of the element.
 *
 * Calling `setState()` or `element.state = value` will rebuild the element's
 * shadow DOM using the `html()` function. This is typically done once at
 * construction, and then signals are allowed to perform fine-grained from
 * there on. However, you can call `setState()` or `element.state = value` at
 * any time to rebuild and re-bind the element's signals.
 *
 * @example
 * const Foo = component({
 *   tag: 'x-foo',
 *   styles: () => [css(`h1 { color: red; }`)],
 *   render: (state) => {
 *     return div({}, text(() => state().title))
 *   }
 * });
 *
 * const state = signal({title: 'Hello, world!'});
 *
 * const fooEl = Foo({
 *   className: 'foo',
 *   state,
 * });
 */
export const component = <T>({
  tag,
  styles = noStyles,
  render,
}: {
  tag: string;
  styles?: () => CSSStyleSheet[];
  render: (state: T) => HTMLElement | DocumentFragment;
}) => {
  class CustomSpellcasterElement extends SpellcasterElement<T> {
    styles() {
      return styles();
    }

    render(state: T) {
      return render(state);
    }
  }

  customElements.define(tag, CustomSpellcasterElement);

  const create = (props = {}, configure: ElementConfigurator = noConfigure) =>
    h(tag, props, configure) as CustomSpellcasterElement;

  return create;
};
