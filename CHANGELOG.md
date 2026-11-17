# Changelog

All notable changes to `@edium/fsm` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [4.1.0] - 2026-11-16

A usability release based on feedback from using 4.0 in a rules engine and a UI interaction
machine. Every change is opt-in and backwards-compatible: 4.0 code compiles and behaves the same.
The one visible difference is a one-time console warning, described under **Added**.

### Added

- **Typed state and trigger ids.** `StateMachine<TContext, TStateId, TTriggerId>` (and the async
  equivalents). With unions such as `'idle' | 'done'`, typos in `createState`, `addTransition`,
  `addGlobalTransition`, `trigger`, `canTrigger`, `getStateById` and `restore` are compile errors.
  `state.id`, `machine.states` keys and listener events are typed too. Both parameters default to
  `string`.
- **Explicit state ids.** `createState(name, { id, isComplete, entryAction, exitAction })`, and the
  same options in the `State` / `AsyncState` constructors. An explicit id is used as-is (not
  kebab-cased). The positional `createState(name, isComplete, entry, exit)` form still works.
  `getStateById()` tries the exact id first, then the kebab-cased form.
- **Warning when a derived id differs from its name**, such as `'My State'` stored as `'my-state'`.
  It's logged once per machine, never when `NODE_ENV` is `production`, and never for states with an
  explicit id. Turn it off with the `warnOnIdChange: false` machine option.
- **Clearer global transitions.** `trigger(id, { global: true })` and `canTrigger(id, { global: true })`
  work alongside the boolean, as do `state.trigger()` and `state.triggerInternal()`. The new
  `globalFallback: true` machine option makes a plain `trigger(id)` fall back to the global
  transition when no local transition matches. A local transition still wins.
- **Opt-in self-transitions.** `addTransition(id, sameState, { reenter: true })` (also on
  `addGlobalTransition`) runs exit actions, listeners and entry actions again instead of throwing
  `Already in state`. `previousState` is left unchanged. `Transition.reenter` exposes the flag, and
  diagrams draw re-entering global transitions as self-loops.
- **`snapshot()` and `restore(snapshot, { runEntry? })`** on both machines. A snapshot is a plain
  `{ stateId, previousStateId?, startStateId? }`. By default `restore()` doesn't run entry actions
  or notify listeners. Unknown ids throw before anything changes.
- **Options-object constructor:** `new StateMachine(name, context, { entryAction, exitAction,
globalFallback, warnOnIdChange })`. The positional form takes an options object as its fifth
  argument.
- Exported types: `IMachineOptions`, `IStateMachineOptions`, `IAsyncStateMachineOptions`,
  `IStateOptions`, `ICreateStateOptions`, `ICreateAsyncStateOptions`, `ITransitionOptions`,
  `ITriggerOptions`, `TTriggerOptions`, `IStateMachineSnapshot`, `IRestoreOptions`.

### Changed

- **Actions receive `context` as a required, typed parameter** (`(state, context: TContext)`)
  instead of `context?: TContext`. This is a types-only change: handlers written with an optional
  context still type-check. At runtime the value is still `undefined` when no context was given.

### Documentation

- Explained how state ids are derived from names, and showed the global-trigger flag next to
  `addGlobalTransition()`.
- New sections on typed ids, typed context, self-transitions, and saving/resuming.

## [4.0.0] - 2026-11-15

A reliability release. Every bug found in a full audit of 3.x is fixed, new observability and
validation tools are added, and the package no longer has runtime dependencies. Most code upgrades
unchanged; see **[Migrating from 3.x](README.md#migrating-from-3x)** for a checklist.

### Breaking changes

TypeScript reports only the first item; the others are runtime behavior changes.

- **Removed the public `AsyncStateMachine.trigger(id, sendGlobal, internal)` overload.** The third
  argument let any caller bypass the busy check. `state.trigger()` and `state.triggerInternal()`
  now use a private path. In JavaScript the extra argument is ignored.
- **Run-to-completion in both machines.** A trigger raised inside an action is queued and runs
  after the current transition completes. In 3.x the sync machine ran it immediately on the same
  call stack, which grew the stack on long chains, let the machine-level entry action see a stale
  state, and left `currentState`/`previousState` inconsistent when triggered from an exit action.
  In the sync machine, `gotoPrevious()` and `reset()` called from inside an action are queued the
  same way.
- **Async: `start()` and `gotoPrevious()` now set the busy flag.** While any transition is running,
  `machine.trigger()` and `machine.gotoPrevious()` are rejected with `State Machine is busy.`
  instead of interleaving with it. Inside actions, `state.trigger()` (now equivalent to
  `state.triggerInternal()`) is queued.
- **`state.addTransition()` throws once the machine has started**, like `addState()` and
  `addGlobalTransition()`.

### Added

- `onTransition(listener)` / `offTransition(listener)` on both machines. Listeners receive
  `{ from, to, trigger }` after exit actions allow a change and before entry actions run.
  `onTransition` returns an unsubscribe function.
- `canTrigger(triggerId, sendGlobal?)` on both machines, a check that never throws.
- `state.transitions`, `machine.globalTransitions` and `state.stateMachine` read-only getters.
- A `busy` getter on the sync `StateMachine` (the async machine already had one).
- `validate()` on both machines, which reports unreachable states, dead-end states and transitions
  to states never added to the machine.
- `toMermaid()` and `toDot()` diagram export on both machines.
- Exported types: `ITransitionEvent`, `IAsyncTransitionEvent`, `TTransitionListenerFn`,
  `TAsyncTransitionListenerFn`, `IValidationResult`.

### Fixed

- **Exit actions are combined.** When both a state and its machine define an exit action, the
  transition proceeds only if both return `true`. Previously the machine-level result silently
  overrode a state that blocked the exit.
- **Transitions to another machine's state are rejected.** `addTransition()` and
  `addGlobalTransition()` now throw when the target state belongs to a different machine.
  Previously this silently corrupted the other machine.
- **Async: external calls could interleave with a running transition.** `machine.trigger()` during
  `start()`'s entry action was accepted, and so was `gotoPrevious()` during any transition. Both
  are now rejected while busy (see Breaking changes).
- **A failed queued trigger no longer leaves stale triggers behind.** If queued work throws, the
  rest of the queue is discarded and the machine is left idle and usable. Previously, leftover
  triggers fired on the next, unrelated call.
- **Queued triggers resolve against the state that is current when they run.** Calling
  `triggerInternal()` from an exit action used to always fail with `Invalid Transition`.
- **Queued triggers re-check completion.** A trigger queued behind one that reached a completed
  state is rejected instead of running from the final state.
- **Sync: long trigger chains no longer overflow the stack** (see Breaking changes).
- **CommonJS type resolution.** `require('@edium/fsm')` under TypeScript's `node16`/`nodenext`
  resolution now gets the CommonJS declarations (`index.d.cts`). Previously the types resolved as
  ESM and failed to import.

### Changed

- **Zero runtime dependencies.** `lodash-es` was replaced with a built-in port of `kebabCase`.
  State and trigger ids are unchanged; tests verify the output matches lodash.
- `throwError()` is now typed as returning `never` (it always throws). This isn't breaking:
  `never` is assignable to `void`.
- The published package now includes `LICENSE-MIT` and `CHANGELOG.md`.

### Documentation

- Added a migration guide, plus sections on observing transitions, introspection, validation and
  diagrams.
- Documented run-to-completion timing and the known limitations.
- Fixed the global-transition example, which omitted the required `sendGlobal` argument.

## 3.0.2 - 2026-04-22

### Changed

- Updated development dependencies.

## 3.0.1 - 2025-11-25

### Fixed

- README typos.

## [3.0.0] - 2025-11-25

### Added

- Asynchronous machine: `AsyncState`, `AsyncStateMachine` and `AsyncTransition`, with a busy flag
  and an internal trigger queue (`state.triggerInternal()`).
- Machine-level entry and exit actions (constructor arguments).
- `StateMachineError`, with `machine`, `state` and `trigger` fields.
- Dual ESM and CommonJS builds.

The synchronous API is unchanged from 2.x.

## 2.x and earlier

See the [git history](https://github.com/splayfee/fsm/commits/main).

[4.1.0]: https://github.com/splayfee/fsm/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/splayfee/fsm/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/splayfee/fsm/compare/v2.1.5...v3.0.0
