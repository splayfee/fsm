# Edium Finite State Machine

## Overview

**Edium FSM** is a lightweight, flexible finite state machine written in TypeScript. It works in both the browser and Node.js, supports local and global transitions, entry/exit/decide actions, blocked transitions, and optional context objects passed to all state actions.

It comes in two flavors that share one API: a synchronous `StateMachine` and an asynchronous `AsyncStateMachine` for `await`-driven work (client/server apps, workflows, async game logic). Both run every transition to completion before starting the next one, so actions can safely trigger further transitions.

> **New in 4.1:** typed state and trigger ids, explicit state ids, `{ global: true }` and `globalFallback` for global transitions, opt-in self-transitions, a required and typed `context` in actions, and `snapshot()` / `restore()`. Everything is opt-in, so 4.0 code runs unchanged. See [What's new in 4.1](#whats-new-in-41).
>
> **Upgrading from 3.x?** Most code works unchanged. Read [Migrating from 3.x](#migrating-from-3x) for the few behaviors that changed, and the [CHANGELOG](CHANGELOG.md) for everything in each release.

---

## Features

- Unlimited number of states.
- One or more completed states.
- Optional “go to previous state” behavior.
- Throws errors on invalid transitions.
- Entry, exit, and decide actions.
- Exit actions can block transitions.
- Reset and optional restart behavior.
- Local transitions (state-specific).
- Global transitions (bypass state rules).
- Trigger-driven state changes, queued safely when raised from inside an action.
- Optional context object passed to all actions.
- **Async FSM option** for `await`-driven logic.
- Transition listeners (`onTransition`) for logging and tracing.
- Non-throwing `canTrigger()` checks and read-only access to registered transitions.
- Structural validation (`validate()`) for unreachable and dead-end states.
- Diagram export to Mermaid and Graphviz DOT.
- Typed state and trigger ids (opt-in) that catch typos at compile time.
- Explicit state ids, or ids derived from names, with a warning when they differ.
- Opt-in self-transitions (re-entering the current state).
- `snapshot()` / `restore()` for saving and resuming a machine.
- Zero runtime dependencies. ESM and CommonJS builds with TypeScript types.

---

## Migrating from 3.x

The public API is unchanged except for one internal overload, so **TypeScript only catches the first item below**. The rest are runtime behavior changes. Each one fixes a 3.x bug, but search your code for these patterns before upgrading:

1. **`asyncMachine.trigger(id, sendGlobal, true)` no longer exists.** The third "internal" argument let any caller skip the busy check. Use `state.triggerInternal(id)` or `state.trigger(id)` from inside actions. TypeScript reports the extra argument. In plain JavaScript it's ignored, so the call is treated as external.
2. **Triggers raised inside an action now run after the current transition completes**, in both machines. In 3.x the sync machine ran them immediately, nested inside the action. So code that reads `machine.currentState` _after_ `state.trigger()` within the same action now sees the state the action belongs to, not the next one. The outer `start()` / `trigger()` call still returns only after every queued transition has run. Move any "after the transition" logic into the next state's entry action or an `onTransition` listener.
3. **Async: `start()` and `gotoPrevious()` now set the busy flag.** A `machine.trigger()` or `machine.gotoPrevious()` sent while another transition (including `start()`) is still running is rejected with `State Machine is busy.` rather than interleaving with it. `await` each call before making the next. Inside actions, use `state.trigger()` / `state.triggerInternal()`, which are queued.
4. **Async: `machine.gotoPrevious()` and `machine.reset()` can't be called from inside an action.** The machine is busy at that point, so they're rejected. (In 3.x `gotoPrevious()` ran nested and left the machine in an inconsistent state.) Use a transition instead, or call them after the outer `await` returns. The sync machine queues both, so they work from inside actions.
5. **`state.addTransition()` throws once the machine has started**, matching `addState()` and `addGlobalTransition()`. Define all transitions before `start()`, or `reset()` first.
6. **Exit actions are combined:** if both a state and its machine have exit actions, the transition proceeds only if both return `true`. In 3.x the machine-level result silently overrode the state's.
7. **Transitions must target a state of the same machine.** `addTransition()` / `addGlobalTransition()` now throw for a state that belongs to another machine (in 3.x this silently corrupted that machine).
8. **A failing queued trigger discards the rest of the queue**, and queued triggers re-check that the machine hasn't completed before running.

State and trigger ids, error messages and all other method signatures are unchanged.

---

## What's new in 4.1

Every change is opt-in. Existing 4.0 code compiles and behaves the same, except that a one-time console warning may appear (see [State ids](#state-ids)).

| Feature                                  | How to use it                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Typed state and trigger ids              | `new StateMachine<Ctx, StateId, TriggerId>(...)`                                                                             |
| Explicit state ids                       | `createState('Choosing tile', { id: 'choosingTile' })`                                                                       |
| Warning when an id differs from its name | On by default outside production; `warnOnIdChange: false` turns it off                                                       |
| Clearer global triggers                  | `trigger('done', { global: true })`, or the `globalFallback: true` machine option                                            |
| Self-transitions                         | `state.addTransition('again', state, { reenter: true })`                                                                     |
| Typed, required `context` in actions     | Automatic: `(state, ctx) => ctx.count++`                                                                                     |
| Save and resume                          | `machine.snapshot()` / `machine.restore(snapshot)`                                                                           |
| Options-object forms                     | `new StateMachine(name, ctx, { entryAction, globalFallback })`, `createState(name, { isComplete, entryAction, exitAction })` |

---

## Installation

```bash
pnpm install @edium/fsm
```

---

## Tests & Coverage

The codebase is fully unit-tested with near-100% coverage. All code is linted, prettified and type-checked.

---

# Synchronous Machine

### Importing

```ts
import { State, StateMachine } from '@edium/fsm';
```

```js
const { State, StateMachine } = require('@edium/fsm');
```

### Example

```ts
const entryAction = (state, context) => {
  state.trigger('next');
};

const exitAction = (state, context) => {
  return true;
};

const decideAction = (state, context) => {
  const index = context.randomize();
  if (index === 0) {
    state.trigger('gotoThree');
  } else if (index === 1) {
    state.trigger('gotoFour');
  }
};

const finalAction = (state) => {};

const context = {
  randomize: () => Math.floor(Math.random() * 2)
};

const stateMachine = new StateMachine('My first state machine', context);

const s1 = stateMachine.createState('My first state', false, entryAction);
const s2 = stateMachine.createState('My second state', false, decideAction, exitAction);
const s3 = stateMachine.createState('My third state', false, entryAction);
const s4 = stateMachine.createState('My fourth state', false, entryAction);
const s5 = stateMachine.createState('My fifth and final state', true, finalAction);

s1.addTransition('next', s2);
s2.addTransition('gotoThree', s3);
s2.addTransition('gotoFour', s4);
s3.addTransition('next', s5);
s4.addTransition('next', s5);

stateMachine.start(s1);
```

---

# Asynchronous Machine

This example implements a safe asynchronous state machine that does not allow the user to directly change the state during running work.

> **IMPORTANT**
> Inside entry/exit actions, trigger through the **state** (`state.triggerInternal()`, or its equivalent `state.trigger()`), never through **asyncStateMachine.trigger()**. Triggers sent through the state are queued and run once the current transition finishes. While any transition is running (including `start()`), `asyncStateMachine.trigger()` and `asyncStateMachine.gotoPrevious()` are rejected with `State Machine is busy.`

> **Note on timing**
> Inside an action, `await state.triggerInternal(...)` _schedules_ the transition; it runs after the current action returns, so code after the `await` still sees the current state. (Waiting for the queued transition there would deadlock, because the queue is waiting on that same action.) The outer `start()` / `trigger()` promise resolves only after every queued transition has run, and rejects if any of them fails; in that case the rest of the queue is discarded. The sync machine follows the same rules, without promises.

### Importing

```ts
import { AsyncState, AsyncStateMachine } from '@edium/fsm';
```

```js
const { AsyncState, AsyncStateMachine } = require('@edium/fsm');
```

### Example

```ts
const entryAction = async (state, context) => {
  // Safe: internal triggers are queued if the machine is already busy.
  await state.triggerInternal('next');
};

const exitAction = async (state, context) => {
  return true;
};

const decideAction = async (state, context) => {
  const index = context.randomize();
  if (index === 0) {
    await state.triggerInternal('gotoThree');
  } else if (index === 1) {
    await state.triggerInternal('gotoFour');
  }
};

const finalAction = async (state) => {};

const context = {
  randomize: () => Math.floor(Math.random() * 2)
};

const asyncStateMachine = new AsyncStateMachine('My first async state machine', context);

const s1 = asyncStateMachine.createState('My first state', false, entryAction);
const s2 = asyncStateMachine.createState('My second state', false, decideAction, exitAction);
const s3 = asyncStateMachine.createState('My third state', false, entryAction);
const s4 = asyncStateMachine.createState('My fourth state', false, entryAction);
const s5 = asyncStateMachine.createState('My fifth and final state', true, finalAction);

s1.addTransition('next', s2);
s2.addTransition('gotoThree', s3);
s2.addTransition('gotoFour', s4);
s3.addTransition('next', s5);
s4.addTransition('next', s5);

await asyncStateMachine.start(s1);
```

---

# Common Patterns

## State ids

**A state's id is its kebab-cased name**, unless you give it one. `'Choosing tile'` gets the id `'choosing-tile'`, so comparing `machine.currentState.id === 'Choosing tile'` is always false. Compare against `state.id`, keep the `State` object you created, or pass an explicit id:

```ts
const choosing = machine.createState('Choosing tile', { id: 'choosingTile' });
choosing.id; // 'choosingTile', used exactly as given
choosing.name; // 'Choosing tile', for display
machine.getStateById('choosingTile'); // the state
```

`getStateById()` tries the exact id first, then the kebab-cased form, so it also finds a derived id by its name. Trigger ids are always kebab-cased: `trigger('pickTile')` matches a transition added as `'pick-tile'`.

When a derived id differs from its name, the machine logs a warning once (not when `NODE_ENV` is `production`). Pass an explicit `id` for that state, or create the machine with `warnOnIdChange: false`:

```ts
const machine = new StateMachine('composer', context, { warnOnIdChange: false });
```

## Typed states and triggers

Declare your state and trigger ids as unions to catch typos at compile time. Both type parameters default to `string`, so untyped code doesn't change.

```ts
type StateId = 'idle' | 'choosing-tile' | 'done';
type TriggerId = 'pick' | 'back' | 'finish';

const m = new StateMachine<Ctx, StateId, TriggerId>('composer', ctx);
const idle = m.createState('idle');
const done = m.createState('Done!', { id: 'done', isComplete: true });
idle.addTransition('finish', done);

m.trigger('finsh'); // ✗ compile error
m.getStateById('dnoe'); // ✗ compile error
m.currentState?.id; // StateId
```

With typed ids, a `createState(name)` call without an `id` must use a name that is already a valid id. Use kebab-case names, or pass `{ id }`.

## Typed context

Actions receive the machine's context as a required, typed second argument:

```ts
const machine = new StateMachine<{ score: number }>('game', { score: 0 });
machine.createState('scoring', false, (state, ctx) => {
  ctx.score += 1; // no `ctx?.` needed
});
```

If you create a typed machine without a context, actions receive `undefined`. Handlers written as `(state, ctx?) => …` still type-check.

## 1. State Guards (Blocking Transitions)

```ts
const guardedExit = (state, ctx) => {
  return ctx.isAllowed === true;
};
```

## 2. Global Transitions

A global transition can fire from any state. **A plain `trigger(id)` only looks for local transitions** on the current state. To send a global trigger, say so:

```ts
machine.addGlobalTransition('reset', startState);

machine.trigger('reset', { global: true }); // explicit
machine.trigger('reset', true); // the same, using the original boolean form
machine.canTrigger('reset', { global: true }); // the same rule applies to canTrigger
```

Or create the machine with `globalFallback: true`, so a trigger with no matching local transition falls back to the global one with the same id. A local transition with the same id still wins.

```ts
const machine = new StateMachine('composer', context, { globalFallback: true });
machine.addGlobalTransition('done', idle);
machine.trigger('done'); // no local 'done' here, so the global transition fires
machine.canTrigger('done'); // true
```

## Self-transitions

By default, a transition to the current state throws `Already in state`. Pass `{ reenter: true }` to allow it. The state's exit actions run (and can block the transition), listeners are notified, and its entry actions run again. `previousState` is left unchanged, so `gotoPrevious()` still returns to the state before.

```ts
upkeep.addTransition('handled', upkeep, { reenter: true });
machine.addGlobalTransition('refresh', board, { reenter: true }); // also works for global transitions
```

## Saving and resuming

`snapshot()` returns a plain, JSON-serializable object. `restore()` puts a machine, started or not, back into those states. By default it does **not** run entry actions or notify listeners, so a restored machine continues exactly where it left off.

```ts
const saved = JSON.stringify(machine.snapshot());
// { "stateId": "deploy", "previousStateId": "turn-start", "startStateId": "turn-start" }

const restored = buildMachine(); // same states, not started
restored.restore(JSON.parse(saved));
restored.trigger('end'); // carries on from 'deploy'
```

- `restore(snapshot, { runEntry: true })` runs the restored state's entry actions and notifies listeners, as `start()` does.
- Exit actions of the state being replaced are not run, as with `reset()`.
- An unknown state id throws before anything changes.
- In the sync machine, a `restore()` called from inside an action is queued. The async machine's `restore()` returns a promise and rejects while the machine is busy, like `reset()`.

## 3. Sub-State Machines (Hierarchical Composition)

```ts
const sub = new StateMachine('sub');
const parent = new StateMachine('parent');

parent.createState('run-sub', false, () => {
  sub.start();
});
```

## 4. Async Workflows

```ts
const entry = async (s, ctx) => {
  const data = await fetch('/api/data').then((r) => r.json());
  ctx.data = data;
  // Safe: internal triggers are queued if the machine is already busy.
  await s.triggerInternal('next');
};
```

## 5. Observing Transitions

```ts
const unsubscribe = machine.onTransition(({ from, to, trigger }) => {
  logger.info(`${from?.name ?? '(start)'} -> ${to.name} via ${trigger ?? '(none)'}`);
});

// later
unsubscribe(); // or machine.offTransition(listener)
```

Listeners run after exit actions have allowed the change and before entry actions, and transitions are reported in the order they happen. `trigger` is the id passed to `trigger()`, and is `undefined` for `start()`, `gotoPrevious()` and `restore({ runEntry: true })`. Listeners are synchronous and are not awaited by the async machine. A listener that throws aborts the transition at that point.

## 6. Introspection

```ts
// Machine options can also be passed as an object, with or without machine-level actions:
const machine = new StateMachine('m', context, { entryAction, exitAction, globalFallback: true });
// ...and states can be created with an options object:
machine.createState('Done', { isComplete: true, entryAction, exitAction });

if (machine.canTrigger('next')) {
  machine.trigger('next');
}

state.transitions; // ReadonlyMap of local transitions, keyed "<state-id>:<trigger-id>"
machine.globalTransitions; // ReadonlyMap of global transitions, keyed by trigger id
state.stateMachine; // the machine a state belongs to
```

`canTrigger(triggerId, options?)` never throws. It accepts the same `{ global: true }` or `true` as `trigger()`. It returns `false` if the machine hasn't started or has completed, if no transition matches, or if the transition targets the current state without `reenter`. It does not run exit actions, so a transition it reports as valid can still be blocked. On the async machine it ignores the busy flag.

## 7. Validation and Diagrams

```ts
const result = machine.validate();
// { valid, unreachable: string[], deadEnds: string[], unregisteredTargets: string[] }

console.log(machine.toMermaid()); // Mermaid stateDiagram-v2
console.log(machine.toDot()); // Graphviz DOT
```

- **unreachable**: states that can't be reached from the start state (the machine's start state once started, otherwise the first state added, or one you pass in).
- **deadEnds**: states that aren't complete but have no transition to another state.
- **unregisteredTargets**: states used as transition targets that were never added to the machine.

Global transitions count as available from every state. In diagrams they're drawn from every non-complete state (dashed in DOT, labeled `(global)` in Mermaid).

## 8. Error Handling

All internal errors are thrown as `StateMachineError`:

- `error.message` – Prefixed message: `State Machine (My Machine) - …`
- `error.machine` – State machine name
- `error.state` – Current state name (if any)
- `error.trigger` – Trigger id (if any)

You can `instanceof StateMachineError` to distinguish FSM errors from other errors.

Transitions must target a state that belongs to the same machine. `addTransition()` and `addGlobalTransition()` throw if the target belongs to another machine.

---

# Behavior Notes & Known Limitations

- **Exit actions are combined.** When a state has an exit action and the machine also has one, both run, and the transition proceeds only if **both** return `true`.
- **Run to completion.** A trigger requested from inside an action or an `onTransition` listener is queued and runs after the current transition finishes. In the sync machine, so are `gotoPrevious()` and `reset()`. Queued work runs in order, and each trigger is resolved against the state current when it runs.
- **Endless trigger cycles never stop.** If entry actions keep triggering each other with no completed state in between, the machine loops forever instead of overflowing the stack.
- **Listeners are synchronous.** A listener that throws aborts the transition at that point: the new state is current but its entry action hasn't run. The error propagates to the caller.
- **Holding a state reference.** In the async machine, `state.trigger()` is queued (not rejected) while the machine is busy, even when called from outside an action. External code should call `machine.trigger()`.
- **`reset()` does not run exit actions.** If exit actions do cleanup (timers, subscriptions), run that cleanup yourself before calling `reset()`.
- **Id collisions.** Derived state ids and all trigger ids are kebab-cased, so `"My State"` and `"my-state"` resolve to the same id. Pass an explicit `{ id }` to control a state's id.

---

Created by Edium Interactive LLC.
