/**
 * @fileOverview Option and data types shared by the sync and async state machines.
 */

/** Options for a single transition, passed to `addTransition()` / `addGlobalTransition()`. */
export interface ITransitionOptions {
  /**
   * Allow this transition to target the state it starts from. The state is exited and entered
   * again: exit actions run (and can block it), listeners are notified, and entry actions run.
   * `previousState` is left unchanged. Defaults to `false`, which throws `Already in state`.
   */
  reenter?: boolean;
}

/** Options for `trigger()` and `canTrigger()`. */
export interface ITriggerOptions {
  /** Send the trigger as a global transition. Same as passing `true` as the second argument. */
  global?: boolean;
}

/** The second argument of `trigger()` / `canTrigger()`: the legacy `sendGlobal` boolean or an options object. */
export type TTriggerOptions = boolean | ITriggerOptions;

/** Machine-wide behavior options shared by both machines. */
export interface IMachineOptions {
  /**
   * When a trigger has no local transition on the current state, fall back to a global
   * transition with the same trigger id, so `trigger('done')` works without `{ global: true }`.
   * Defaults to `false`.
   */
  globalFallback?: boolean;
  /**
   * Warn (once per machine, outside `NODE_ENV=production`) when a state's id is derived from its
   * name and differs from it, for example `'My State'` stored as `'my-state'`. Defaults to `true`.
   * States created with an explicit `id` never warn.
   */
  warnOnIdChange?: boolean;
}

/** Options for a new state. */
export interface IStateOptions<TStateId extends string = string> {
  /** The state's id, used as-is. When omitted, the id is the kebab-cased name. */
  id?: TStateId;
  /** Whether the state is a completed state. Defaults to `false`. */
  isComplete?: boolean;
}

/** A plain, JSON-serializable record of where a machine is. Returned by `snapshot()`. */
export interface IStateMachineSnapshot<TStateId extends string = string> {
  /** The id of the current state. */
  stateId: TStateId;
  /** The id of the previous state, if there is one. */
  previousStateId?: TStateId;
  /** The id of the state `reset(true)` restarts from, if known. */
  startStateId?: TStateId;
}

/** Options for `restore()`. */
export interface IRestoreOptions {
  /**
   * Run the restored state's entry actions (state and machine) and notify transition listeners,
   * as `start()` does. Defaults to `false`: the machine continues exactly where it left off.
   */
  runEntry?: boolean;
}

/** Normalizes the second argument of `trigger()` / `canTrigger()` to the `sendGlobal` flag. */
export function isGlobal(options?: TTriggerOptions): boolean {
  return typeof options === 'boolean' ? options : (options?.global ?? false);
}

declare const process: { env: Record<string, string | undefined> };

/**
 * Whether the code runs with `NODE_ENV=production`. Written as a literal `process.env.NODE_ENV`
 * so bundlers can replace it; where `process` doesn't exist the access throws and counts as development.
 */
export function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === 'production';
  } catch {
    return false;
  }
}
