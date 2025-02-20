import { describe, it } from "mocha";
import { strict as assert, strictEqual as assertEqual, fail } from "assert";

import {
  throttled,
  signal,
  effect,
  computed,
  store,
  fxware,
  middleware,
  isSignal,
  sample,
  takeValues,
} from "../dist/spellcaster.js";

const delay = (value, ms) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });

describe("throttled", () => {
  it("batches calls, only executing once per microtask", async () => {
    let count = 0;

    const inc = throttled(() => {
      count++;
    });

    inc();
    inc();
    inc();

    await Promise.resolve();

    assert(count === 1);
  });
});

describe("signal getter", () => {
  it("returns value", () => {
    const [state, _] = signal(0);
    assert(state() === 0);
  });

  it("triggers reaction when read within reactive scope", (done) => {
    const [state, setState] = signal(false);

    effect(() => {
      if (state()) {
        done();
      }
    });

    setState(true);
  });
});

describe("signal setter", () => {
  it("sets value immediately", () => {
    const [state, setState] = signal(0);
    setState(10);
    assert(state() === 10);
  });

  it("does not trigger reactions for values that are equal to the currently set value", async () => {
    const [state, setState] = signal(0);
    setState(10);
    setState(10);
    setState(10);

    let hitCount = 0;
    effect(() => {
      // Access value so that effect triggers
      state();

      hitCount++;
    });

    await Promise.resolve();

    assertEqual(hitCount, 1);
  });
});

describe("isSignal", () => {
  it("returns true for signal", () => {
    const [value, setValue] = signal(0);
    assert(isSignal(value));
  });

  it("returns true for computed", () => {
    const [a, setA] = signal(0);
    const [b, setB] = signal(0);
    const sum = computed(() => a() + b());
    assert(isSignal(sum));
  });

  it("returns true for any zero-argument function", () => {
    const constantZero = () => 0;
    assert(isSignal(constantZero));
  });

  it("returns false for functions with arguments ", () => {
    const id = (value) => value;
    assert(isSignal(id) === false);
  });
});

describe("sample", () => {
  it("samples a value", () => {
    assert(sample(0) === 0);
  });

  it("samples a signal", () => {
    const constantZero = () => 0;
    assert(sample(constantZero) === 0);
  });

  it("treats functions with arguments as values, not signals", () => {
    const id = (value) => value;
    assert(sample(id) === id);
  });
});

describe("effect", () => {
  it("executes once on initialization", (done) => {
    effect(done);
  });

  it("reacts to signals once per microtask, batching multiple updates", async () => {
    const [a, setA] = signal(1);
    const [b, setB] = signal(1);

    let count = 0;
    effect(() => {
      a();
      b();
      count++;
    });
    setA(10);
    setB(10);

    await delay(null, 10);

    assertEqual(count, 2, "batched");
  });

  it("it is disjoint from other effects", async () => {
    const [a, setA] = signal(0);
    const [b, setB] = signal(0);

    let aCount = 0;
    effect(() => {
      a();
      aCount++;
    });

    let bCount = 0;
    effect(() => {
      b();
      bCount++;
    });

    setA(1);
    await delay(null, 1);

    assertEqual(aCount, 2, "a");
    assertEqual(bCount, 1, "b");
  });

  it("runs the cleanup function before next execution", async () => {
    const [counter, setCounter] = signal(0);

    let callCount = 0;
    let cleanupCount = 0;
    effect(() => {
      counter();
      callCount++;
      return () => cleanupCount++;
    });
    // Cleanup 1 called
    setCounter(1);
    await delay(null, 10);

    assertEqual(callCount, 2, "called");
    assertEqual(cleanupCount, 1, "cleaned");
  });

  it("runs the cleanup when running the dispose function", async () => {
    let cleanupCount = 0;
    const dispose = effect(() => {
      return () => cleanupCount++;
    });
    dispose();
    assertEqual(cleanupCount, 1);
  });
});

describe("computed", () => {
  it("computes immediately and returns value", () => {
    const [a, setA] = signal(1);
    const [b, setB] = signal(1);
    const sum = computed(() => a() + b());

    assert(sum() === 2);
  });

  it("recomputes when signal dependencies change, once per microtask, batching multiple updates", async () => {
    const [a, setA] = signal(1);
    const [b, setB] = signal(1);
    const sum = computed(() => a() + b());

    assert(sum() === 2);

    setA(10);
    setB(10);

    // Recomputes are batched on next microtask, so await next microtask
    await Promise.resolve();

    assert(sum() === 20);
  });
});

describe("store", () => {
  it("returns a signal as the first item of the array pair", () => {
    const initial = {};
    const update = (state, msg) => ({});

    const [state, send] = store({
      state: initial,
      update,
    });

    assert(isSignal(state));
  });

  it("returns a send function as the second item of the array pair", () => {
    const initial = {};
    const update = (state, msg) => ({});

    const [state, send] = store({
      state: initial,
      update,
    });

    assertEqual(typeof send, "function");
    assertEqual(send.length, 1);
  });

  it("updates the state immediately", () => {
    const Msg = {};
    Msg.inc = { type: "inc" };

    const init = () => ({ count: 0 });

    const update = (state, msg) => {
      switch (msg.type) {
        case "inc":
          return { ...state, count: state.count + 1 };
        default:
          return state;
      }
    };

    const [state, send] = store({
      state: init(),
      update,
    });

    assert(state().count === 0);

    send(Msg.inc);

    assert(state().count === 1);
  });
});

describe("fxware", () => {
  it("runs effects when plugged in as store fx driver", async () => {
    const TIMEOUT = 1;

    const Msg = {};
    Msg.incLater = { type: "incLater" };
    Msg.inc = { type: "inc" };

    const init = () => ({ count: 0 });

    const update = (state, msg) => {
      switch (msg.type) {
        case "inc":
          return { ...state, count: state.count + 1 };
        default:
          return state;
      }
    };

    const fx = (_state, msg) => {
      switch (msg.type) {
        case "incLater":
          const incFx = () => delay(Msg.inc, TIMEOUT);
          return [incFx];
        default:
          return [];
      }
    };

    const [state, send] = store({
      state: init(),
      update,
      middleware: fxware(fx),
    });

    send(Msg.incLater);

    await delay(null, TIMEOUT + 1);

    assertEqual(state().count, 1);
  });

  it("runs effects that immediately return a value", async () => {
    const TIMEOUT = 1;

    const Msg = {};
    Msg.incLater = { type: "incLater" };
    Msg.inc = { type: "inc" };

    const init = () => ({ count: 0 });

    const update = (state, msg) => {
      switch (msg.type) {
        case "inc":
          return { ...state, count: state.count + 1 };
        default:
          return state;
      }
    };

    const fx = (_state, msg) => {
      switch (msg.type) {
        case "incLater":
          const incFx = () => Msg.inc;
          return [incFx];
        default:
          return [];
      }
    };

    const [state, send] = store({
      state: init(),
      update,
      middleware: fxware(fx),
    });

    send(Msg.incLater);

    await delay(null, TIMEOUT + 1);

    assertEqual(state().count, 1);
  });
});

describe("middleware", () => {
  it("it composes the fx drivers", (done) => {
    const driverA = (state) => (send) => (msg) => send(`a${state()}${msg}`);
    const driverB = (state) => (send) => (msg) => send(`b${state()}${msg}`);
    const driverC = (state) => (send) => (msg) => send(`c${state()}${msg}`);

    const driver = middleware(driverA, driverB, driverC);

    const state = () => "-";

    const send = (msg) => {
      assertEqual(msg, "a-b-c-123");
      done();
    };

    const decorate = driver(state);
    const sendDecorated = decorate(send);

    sendDecorated("123");
  });
});

describe("takeValues", () => {
  it("ends the signal on the first null or undefined value", async () => {
    const [maybeValue, setMaybeValue] = signal("a");

    const value = takeValues(maybeValue);
    setMaybeValue("b");

    await Promise.resolve();

    assert(value() === "b");

    // Should end `value` signal
    setMaybeValue(null);

    await Promise.resolve();

    assert(value() === "b");

    // `value` signal should be ended at this point, and should never see these.
    setMaybeValue("c");
    setMaybeValue("d");

    await Promise.resolve();

    assert(value() === "b");
  });
});
