# Edium Finite State Machine

## Overview

**Edium FSM** is a lightweight, flexible finite state machine written in TypeScript. It works in both the browser and Node.js, supports local and global transitions, entry/exit/decide actions, blocked transitions, and optional context objects passed to all state actions.

It comes in two flavors that share one API: a synchronous `StateMachine` and an asynchronous `AsyncStateMachine` for `await`-driven work (client/server apps, workflows, async game logic). Both run every transition to completion before starting the next one, so actions can safely trigger further transitions.

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

## 1. State Guards (Blocking Transitions)

```ts
const guardedExit = (state, ctx) => {
  return ctx.isAllowed === true;
};
```

## 2. Global Transitions

```ts
machine.addGlobalTransition('reset', startState);
machine.trigger('reset', true); // `true` sends the trigger as a global transition
```

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

Listeners run after exit actions have allowed the change and before entry actions, and transitions are reported in the order they happen. `trigger` is the id passed to `trigger()`, and is `undefined` for `start()` and `gotoPrevious()`. Listeners are synchronous and are not awaited by the async machine. A listener that throws aborts the transition at that point.

## 6. Introspection

```ts
if (machine.canTrigger('next')) {
  machine.trigger('next');
}

state.transitions; // ReadonlyMap of local transitions, keyed "<state-id>:<trigger-id>"
machine.globalTransitions; // ReadonlyMap of global transitions, keyed by trigger id
state.stateMachine; // the machine a state belongs to
```

`canTrigger(triggerId, sendGlobal?)` never throws. It returns `false` if the machine hasn't started or has completed, if no transition matches, or if the transition targets the current state. It does not run exit actions, so a transition it reports as valid can still be blocked. On the async machine it ignores the busy flag.

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
- **Id collisions.** State and trigger ids are kebab-cased, so `"My State"` and `"my-state"` resolve to the same id.

---

Created by Edium Interactive LLC.
