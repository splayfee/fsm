# Edium Finite State Machine

## Overview

**Edium FSM** is a lightweight, flexible finite state machine written in TypeScript. It works in both the browser and Node.js, supports local and global transitions, entry/exit/decide actions, blocked transitions, and optional context objects passed to all state actions.

Version **3.x** introduces a fully **asynchronous state machine**, useful for client/server apps, workflow systems, async game logic, and anything requiring `await` inside state actions.

> **Important**
> Version 3.x is **100% backward compatible** with earlier versions.
> The original synchronous API is unchanged — the new async API is optional.

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
- Trigger-driven state changes.
- Optional context object passed to all actions.
- **Async FSM option** for `await`-driven logic.

---

## Migration to 3.x

Version 3.x adds asynchronous FSM classes (`AsyncState`, `AsyncStateMachine`, `AsyncTransition`) _without changing_ the existing synchronous API.

### If you used version 2.x (or earlier)

You don’t need to change anything:

```ts
import { State, StateMachine } from '@edium/fsm';

const machine = new StateMachine('My FSM');
machine.start(...);
machine.trigger('next');
```

This continues to work exactly as before.

### To use the new async FSM

Switch to:

```ts
import { AsyncState, AsyncStateMachine } from '@edium/fsm';

await asyncMachine.start(...);
await asyncMachine.trigger('next');
```

Both styles can coexist in the same project.

---

## Installation

```bash
pnpm install @edium/fsm
```

---

## Tests & Coverage

The codebase is fully unit-tested with near-100% coverage.
All code is linted and type-checked.

---

## Examples

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
machine.trigger('reset');
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

---

Created by Edium Interactive LLC.
