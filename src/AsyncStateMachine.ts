/**
 * @fileOverview This file holds the AsyncStateMachine class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 */

import AsyncState, {
  ICreateAsyncStateOptions,
  TEntryActionAsyncFn,
  TExitActionAsyncFn
} from './AsyncState';
import AsyncTransition from './AsyncTransition';
import kebabCase from './kebabCase';
import StateMachineError from './StateMachineError';
import { IValidationResult, toDot, toMermaid, validateGraph } from './graph';
import { ID_DERIVED, TRIGGER_INTERNAL } from './internal';
import {
  IMachineOptions,
  IRestoreOptions,
  IStateMachineSnapshot,
  ITransitionOptions,
  TTriggerOptions,
  isGlobal,
  isProduction
} from './types';

/** Describes a completed state change. Passed to every `onTransition` listener. */
export interface IAsyncTransitionEvent<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> {
  /** The state that was exited, or undefined when the machine was just started. */
  from?: AsyncState<TContext, TStateId, TTriggerId>;
  /** The state that was entered. */
  to: AsyncState<TContext, TStateId, TTriggerId>;
  /** The trigger id as it was passed to `trigger()`; undefined for `start()`, `gotoPrevious()` and `restore()`. */
  trigger?: TTriggerId;
}

export type TAsyncTransitionListenerFn<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> = (event: IAsyncTransitionEvent<TContext, TStateId, TTriggerId>) => void;

/** Options for a new `AsyncStateMachine`: machine-level actions plus behavior options. */
export interface IAsyncStateMachineOptions<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> extends IMachineOptions {
  /** Fires after the state's own entry action whenever any state is entered. */
  entryAction?: TEntryActionAsyncFn<TContext, TStateId, TTriggerId>;
  /** Fires after the state's own exit action whenever any state is exited. Can block the exit. */
  exitAction?: TExitActionAsyncFn<TContext, TStateId, TTriggerId>;
}

/** A unit of queued work: a triggered transition, a start, or a return to the previous state. */
type TJob = () => Promise<void>;

/**
 * This class defines a new state machine. The state machine takes in
 * multiple states which hold transitions. It changes state on behalf
 * of each state and enforces transition rules. An application can have
 * multiple state machines.
 *
 * @typeParam TContext The context object passed to every action.
 * @typeParam TStateId A union of the valid state ids. Defaults to `string`.
 * @typeParam TTriggerId A union of the valid trigger ids. Defaults to `string`.
 */
export default class AsyncStateMachine<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> {
  /**
   * Instantiates a new state machine.
   * @param name A unique identifier for this state machine.
   * @param context An optional context that will automatically be sent to every state action.
   * @param entryAction An optional action that fires whenever any state is entered.
   * @param exitAction An optional action that fires whenever any state is exited. Can block the exit.
   * @param options Optional behavior options.
   */
  public constructor(
    name: string,
    context?: TContext,
    entryAction?: TEntryActionAsyncFn<TContext, TStateId, TTriggerId>,
    exitAction?: TExitActionAsyncFn<TContext, TStateId, TTriggerId>,
    options?: IMachineOptions
  );
  /**
   * Instantiates a new state machine.
   * @param name A unique identifier for this state machine.
   * @param context A context that will automatically be sent to every state action.
   * @param options Machine-level actions and behavior options.
   */
  public constructor(
    name: string,
    context: TContext | undefined,
    options: IAsyncStateMachineOptions<TContext, TStateId, TTriggerId>
  );
  public constructor(
    name: string,
    context?: TContext,
    entryActionOrOptions?:
      | TEntryActionAsyncFn<TContext, TStateId, TTriggerId>
      | IAsyncStateMachineOptions<TContext, TStateId, TTriggerId>,
    exitAction?: TExitActionAsyncFn<TContext, TStateId, TTriggerId>,
    options?: IMachineOptions
  ) {
    let resolved: IAsyncStateMachineOptions<TContext, TStateId, TTriggerId>;
    if (typeof entryActionOrOptions === 'object' && entryActionOrOptions !== null) {
      resolved = entryActionOrOptions;
    } else {
      resolved = { ...options, entryAction: entryActionOrOptions, exitAction };
    }
    this._name = name;
    this._context = context;
    this._entryAction = resolved.entryAction;
    this._exitAction = resolved.exitAction;
    this._globalFallback = resolved.globalFallback ?? false;
    this._warnOnIdChange = resolved.warnOnIdChange ?? true;
  }

  /**
   * Flag that indicates the state machine is currently processing a transition.
   * External triggers are blocked while busy.
   */
  private _busy = false;

  /**
   * Work waiting to run, in order. Internal triggers raised from states during entry/exit are
   * enqueued here and run once the current transition completes.
   */
  private _queue: TJob[] = [];

  /** Listeners notified after every state change. */
  private _transitionListeners = new Set<
    TAsyncTransitionListenerFn<TContext, TStateId, TTriggerId>
  >();

  /** Fires when this state is entered. */
  private _entryAction?: TEntryActionAsyncFn<TContext, TStateId, TTriggerId>;

  /** Fires when this state attempts to exit. Can be blocked. */
  private _exitAction?: TExitActionAsyncFn<TContext, TStateId, TTriggerId>;

  /** Whether a trigger with no local transition falls back to a global one. */
  private _globalFallback: boolean;

  /** Whether to warn when a derived state id differs from the state's name. */
  private _warnOnIdChange: boolean;

  /** A unique identifier for this state machine. */
  private _name: string;

  /** An optional context that will automatically be sent to every state action. */
  private _context?: TContext;

  /** A collection of all possible global machine transitions between states. */
  private _transitions = new Map<string, AsyncTransition<TContext, TStateId, TTriggerId>>();

  /** A collection of all possible states for this state machine. */
  private _states = new Map<TStateId, AsyncState<TContext, TStateId, TTriggerId>>();

  /** The state that should be entered when the machine is first started. */
  private _startState?: AsyncState<TContext, TStateId, TTriggerId> = undefined;

  /** The current state of the machine. */
  private _currentState?: AsyncState<TContext, TStateId, TTriggerId> = undefined;

  /** The previous state of the machine; undefined if there is no previous state. */
  private _previousState?: AsyncState<TContext, TStateId, TTriggerId> = undefined;

  /**
   * Runs a job under the busy flag, then any jobs queued while it ran.
   *
   * While busy, external work is rejected and internal work is queued. A queued job runs after
   * the action that raised it returns: awaiting it from inside that action would deadlock, since
   * this loop is itself waiting on the action. The promise for the outermost job settles only once
   * the queue has drained, and rejects if any queued job fails.
   * @param job The work to run.
   * @param internal Whether the job was raised from inside a state action.
   * @param triggerId The trigger id, for error reporting.
   */
  private async _run(job: TJob, internal: boolean, triggerId?: string): Promise<void> {
    if (this._busy) {
      if (!internal) {
        this.throwError('State Machine is busy.', triggerId);
      }
      this._queue.push(job);
      return;
    }

    this._queue.push(job);
    this._busy = true;
    try {
      while (this._queue.length > 0) {
        await this._queue.shift()!();
      }
    } catch (error) {
      // Drop anything queued behind the failed job so it can't fire on a later, unrelated trigger.
      this._queue = [];
      throw error;
    } finally {
      this._busy = false;
    }
  }

  /**
   * Validates and runs (or queues) a trigger.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Whether the trigger targets a global transition.
   * @param internal Whether the trigger was raised from inside a state action.
   */
  private _trigger(triggerId: TTriggerId, sendGlobal: boolean, internal: boolean): Promise<void> {
    this._assertCanTrigger(triggerId);
    return this._run(
      async (): Promise<void> => {
        // Checked again when the trigger runs: an earlier queued job may have completed the machine.
        this._assertCanTrigger(triggerId);
        // Resolved when the trigger runs, not when it was queued, so a trigger queued from an exit
        // action applies to the state being entered.
        await this._transitionHandler(triggerId, sendGlobal);
      },
      internal,
      triggerId
    );
  }

  /**
   * Throws if the machine cannot accept a trigger because it has not started or has completed.
   * @param triggerId The trigger id, for error reporting.
   */
  private _assertCanTrigger(triggerId: string): void {
    if (!this.started) {
      this.throwError('Cannot trigger if the machine has not started.', triggerId);
    }
    if (this.isComplete) {
      this.throwError('Cannot trigger if the machine has completed.', triggerId);
    }
  }

  /**
   * Returns the registered state with this id, or throws.
   * @param id The state id.
   */
  private _requireState(id: TStateId): AsyncState<TContext, TStateId, TTriggerId> {
    const state = this.getStateById(id);
    if (!state) {
      this.throwError(`Unknown state id: ${id}.`);
    }
    return state;
  }

  /** A unique identifier for this state machine. */
  public get name(): string {
    return this._name;
  }

  /**
   * Flag that indicates the state machine is currently processing a transition.
   * External triggers are blocked while busy.
   */
  public get busy(): boolean {
    return this._busy;
  }

  /** An identifier for this state machine. Not guaranteed unique. Format is kebab case and derived from the state machine's name. */
  public get id(): string {
    return kebabCase(this.name);
  }

  /** Flag that indicates whether the state machine is in a completed state. */
  public get isComplete(): boolean {
    let isComplete = false;
    if (this._currentState) {
      isComplete = this._currentState.isComplete;
    }
    return isComplete;
  }

  /** Returns the current state object or undefined if not set. */
  public get currentState(): AsyncState<TContext, TStateId, TTriggerId> | undefined {
    return this._currentState;
  }

  /** Returns the previous state object or undefined if not set. */
  public get previousState(): AsyncState<TContext, TStateId, TTriggerId> | undefined {
    return this._previousState;
  }

  /** Flag that indicates whether the state machine has started. */
  public get started(): boolean {
    return this._currentState instanceof AsyncState;
  }

  /**
   * Returns states registered with this state machine, keyed by state id.
   */
  public get states(): ReadonlyMap<TStateId, AsyncState<TContext, TStateId, TTriggerId>> {
    return this._states;
  }

  /** Returns the global transitions registered with this state machine, keyed by kebab-cased trigger id. */
  public get globalTransitions(): ReadonlyMap<
    string,
    AsyncTransition<TContext, TStateId, TTriggerId>
  > {
    return this._transitions;
  }

  // ----------------------------------------------------------
  // METHODS
  // ----------------------------------------------------------

  /**
   * Makes `newState` current, notifies listeners and runs entry actions. Exit actions are not run.
   * @param newState The state to enter.
   * @param trigger The trigger id that caused the change, if any.
   */
  private async _enter(
    newState: AsyncState<TContext, TStateId, TTriggerId>,
    trigger?: TTriggerId
  ): Promise<void> {
    const from = this._currentState;
    // A re-entry (self-transition) keeps previousState pointing at the state before it, and
    // entering from no state (start, restore) leaves it as is.
    if (from && newState !== from) {
      this._previousState = from;
    }
    this._currentState = newState;

    // Notify listeners before entry actions so that transitions triggered from inside an
    // entry action are reported in the order they happen.
    for (const listener of this._transitionListeners) {
      listener({ from, to: newState, trigger });
    }

    // Perform any entrance action if it exists
    if (newState.entryAction) {
      await newState.entryAction(newState, this._context as TContext);
    }
    if (this._entryAction) {
      await this._entryAction(newState, this._context as TContext);
    }
  }

  /**
   * This method changes the state of the state machine.
   * @param newState The new state of the machine.
   * @param trigger The trigger id that caused the change, if any.
   * @param reenter Whether the machine may re-enter the current state.
   */
  private async _changeState(
    newState: AsyncState<TContext, TStateId, TTriggerId>,
    trigger?: TTriggerId,
    reenter = false
  ): Promise<void> {
    let allowExit = true;

    // Throw an error if the machine is already in the requested state.
    if (newState === this._currentState && !reenter) {
      this.throwError(`Already in state: currentState: ${this._currentState.name}.`);
    }

    // Perform exit actions if they exist. Both run; either one can block the state change.
    if (this._currentState?.exitAction) {
      allowExit = await this._currentState.exitAction(
        this._currentState,
        this._context as TContext
      );
    }

    if (this._currentState && this._exitAction) {
      const machineAllowExit = await this._exitAction(
        this._currentState,
        this._context as TContext
      );
      allowExit = allowExit && machineAllowExit;
    }

    // The current state can cancel the state change request if necessary.
    if (allowExit) {
      await this._enter(newState, trigger);
    }
  }

  /**
   * Converts a trigger id into the key used to look up the transition.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Whether the trigger targets a global transition.
   */
  private _resolveTriggerId(triggerId: string, sendGlobal: boolean): string {
    if (!sendGlobal && this._currentState) {
      return `${this._currentState.id}:${kebabCase(triggerId)}`;
    }
    return triggerId;
  }

  /**
   * Finds the transition for a trigger: a local transition on the current state first, then a
   * global transition. With `globalFallback`, a local trigger that matches nothing falls back to
   * the global transition with the same id.
   * @param triggerId The trigger id as passed by the caller.
   * @param sendGlobal Whether the trigger targets a global transition.
   */
  private _findTransition(
    triggerId: string,
    sendGlobal: boolean
  ): AsyncTransition<TContext, TStateId, TTriggerId> | undefined {
    const resolvedTriggerId = this._resolveTriggerId(triggerId, sendGlobal);
    const transition =
      this._currentState?.getTransition(resolvedTriggerId) ??
      this._transitions.get(kebabCase(resolvedTriggerId));
    if (transition || sendGlobal || !this._globalFallback) {
      return transition;
    }
    return this._transitions.get(kebabCase(triggerId));
  }

  /**
   * This method handles all transitions from state to state. It receives a message used to determine which transition to execute.
   * @param triggerId The trigger id as passed by the caller.
   * @param sendGlobal Whether the trigger targets a global transition.
   */
  private async _transitionHandler(triggerId: TTriggerId, sendGlobal: boolean): Promise<void> {
    const transition = this._findTransition(triggerId, sendGlobal);
    if (!transition) {
      const resolvedTriggerId = this._resolveTriggerId(triggerId, sendGlobal);
      this.throwError(`Invalid Transition - triggerId: ${resolvedTriggerId}.`, resolvedTriggerId);
    } else {
      return this._changeState(transition.targetState, triggerId, transition.reenter);
    }
  }

  /**
   * Adds a new state to the state machine.
   * @param state A new state instance.
   */
  public addState(state: AsyncState<TContext, TStateId, TTriggerId>): void {
    if (this._states.has(state.id)) {
      this.throwError(`State exists: ${state.id}.`);
    }
    if (this.started) {
      this.throwError('Cannot add a state once the machine has started.');
    }
    this._warnIfIdChanged(state);
    this._states.set(state.id, state);
  }

  /** Warns, once per machine, about a state whose derived id differs from its name. */
  private _warnIfIdChanged(state: AsyncState<TContext, TStateId, TTriggerId>): void {
    if (!this._warnOnIdChange || !state[ID_DERIVED] || state.id === state.name) {
      return;
    }
    this._warnOnIdChange = false;
    if (!isProduction()) {
      console.warn(
        `State Machine (${this._name}) - State "${state.name}" has id "${state.id}". ` +
          'Ids are kebab-cased from names: compare against state.id, or pass an explicit { id } ' +
          'to createState(). Set warnOnIdChange: false to silence this warning.'
      );
    }
  }

  /**
   * Adds a global transition from the current state to some new state. Global transitions can
   * bypass local state transition restrictions and eliminate the need to register a transition
   * with each local state. Send them with `trigger(id, { global: true })`, or create the machine
   * with `globalFallback: true` so a plain `trigger(id)` falls back to them.
   * @param triggerId A unique identifier for the trigger.
   * @param targetState The target state.
   * @param options Optional transition options. `{ reenter: true }` allows the trigger to fire
   * while the machine is already in `targetState`, re-entering it.
   */
  public addGlobalTransition(
    triggerId: TTriggerId,
    targetState: AsyncState<TContext, TStateId, TTriggerId>,
    options?: ITransitionOptions
  ): void {
    if (this.started) {
      this.throwError('Cannot add a transition once the machine has started.');
    }
    if (targetState.stateMachine !== this) {
      this.throwError(
        `Target state (${targetState.name}) belongs to a different state machine (${targetState.stateMachine.name}).`,
        triggerId
      );
    }
    this._transitions.set(
      kebabCase(triggerId),
      new AsyncTransition<TContext, TStateId, TTriggerId>(triggerId, targetState, options)
    );
  }

  /**
   * Returns true if `trigger()` would find a valid transition for this trigger right now.
   * Never throws. Exit actions are not run, so a transition reported as valid can still be
   * blocked by an exit action. The busy flag is not considered: while busy, an external
   * `trigger()` is rejected, but an internal one is queued.
   * @param triggerId A unique identifier for the trigger.
   * @param options `{ global: true }` (or the legacy `true`) checks for a global transition
   * rather than a state-specific one.
   */
  public canTrigger(triggerId: TTriggerId, options?: TTriggerOptions): boolean {
    if (!this.started || this.isComplete) {
      return false;
    }
    const transition = this._findTransition(triggerId, isGlobal(options));
    return (
      transition !== undefined &&
      (transition.reenter || transition.targetState !== this._currentState)
    );
  }

  /**
   * Creates a new state and adds it to this state machine. States can be created and added manually as well.
   * @param name A unique name for the new state. Its kebab-cased form is the state's id.
   * @param isComplete Boolean that indicates whether the state is a completed state.
   * @param entryAction An optional action that fires whenever the state machine enters this state.
   * @param exitAction An optional action that fires whenever the state machine exits this state.
   * @returns The newly created state.
   */
  public createState(
    name: TStateId,
    isComplete?: boolean,
    entryAction?: TEntryActionAsyncFn<TContext, TStateId, TTriggerId>,
    exitAction?: TExitActionAsyncFn<TContext, TStateId, TTriggerId>
  ): AsyncState<TContext, TStateId, TTriggerId>;
  /**
   * Creates a new state and adds it to this state machine.
   * @param name A descriptive name for the new state. Its kebab-cased form is the state's id.
   * @param options Completion flag and entry/exit actions.
   * @returns The newly created state.
   */
  public createState(
    name: TStateId,
    options?: Omit<ICreateAsyncStateOptions<TContext, TStateId, TTriggerId>, 'id'>
  ): AsyncState<TContext, TStateId, TTriggerId>;
  /**
   * Creates a new state with an explicit id and adds it to this state machine.
   * @param name A descriptive name for the new state.
   * @param options The state's `id` (used as-is), completion flag and entry/exit actions.
   * @returns The newly created state.
   */
  public createState(
    name: string,
    options: ICreateAsyncStateOptions<TContext, TStateId, TTriggerId> & { id: TStateId }
  ): AsyncState<TContext, TStateId, TTriggerId>;
  public createState(
    name: string,
    isCompleteOrOptions: boolean | ICreateAsyncStateOptions<TContext, TStateId, TTriggerId> = false,
    entryAction?: TEntryActionAsyncFn<TContext, TStateId, TTriggerId>,
    exitAction?: TExitActionAsyncFn<TContext, TStateId, TTriggerId>
  ): AsyncState<TContext, TStateId, TTriggerId> {
    const options: ICreateAsyncStateOptions<TContext, TStateId, TTriggerId> =
      typeof isCompleteOrOptions === 'boolean'
        ? { isComplete: isCompleteOrOptions, entryAction, exitAction }
        : isCompleteOrOptions;
    const state = new AsyncState<TContext, TStateId, TTriggerId>(
      this,
      name,
      options as ICreateAsyncStateOptions<TContext, TStateId, TTriggerId> & { id: TStateId }
    );
    state.entryAction = options.entryAction;
    state.exitAction = options.exitAction;
    this.addState(state);
    return state;
  }

  /**
   * This method returns the state machine to the previous state if there is one.
   * Rejects while the machine is busy, like an external `trigger()`.
   */
  public async gotoPrevious(): Promise<void> {
    return this._run(async (): Promise<void> => {
      if (this._previousState) {
        await this._changeState(this._previousState);
      }
    }, false);
  }

  /**
   * Returns the state corresponding to the requested unique identifier. An exact id match wins;
   * otherwise the id is kebab-cased, so a state's name also finds it.
   * @param id A unique identifier for the state.
   * @returns The state corresponding to the id, or undefined if one is not found.
   */
  public getStateById(id: TStateId): AsyncState<TContext, TStateId, TTriggerId> | undefined {
    return this._states.get(id) ?? this._states.get(kebabCase(id) as TStateId);
  }

  /**
   * Registers a listener that is called after every state change, once exit actions have allowed
   * it and before entry actions run. Listeners are called synchronously and are not awaited.
   * @param listener The listener to call.
   * @returns A function that removes the listener.
   */
  public onTransition(
    listener: TAsyncTransitionListenerFn<TContext, TStateId, TTriggerId>
  ): () => void {
    this._transitionListeners.add(listener);
    return (): void => {
      this.offTransition(listener);
    };
  }

  /**
   * Removes a listener registered with `onTransition`.
   * @param listener The listener to remove.
   */
  public offTransition(listener: TAsyncTransitionListenerFn<TContext, TStateId, TTriggerId>): void {
    this._transitionListeners.delete(listener);
  }

  /**
   * Starts the state machine, throwing it into its starting state.
   * @param startState An optional start state, the default is the first state that was added to the machine.
   */
  public async start(startState?: AsyncState<TContext, TStateId, TTriggerId>): Promise<void> {
    // Don't start the machine if there are no states defined
    if (this._states.size === 0) {
      this.throwError('No states have been defined. The state machine cannot be started.');
    }

    // Don't restart the machine if it's already started.
    if (this._currentState) {
      this.throwError('The state machine has already started.');
    }

    // If a start state is not provided, default to the first state.
    if (!startState) {
      startState = this._states.values().next().value!;
    }

    // If the startState is missing.
    if (startState && !this._states.has(startState.id)) {
      this.throwError(`Start state (${startState.name}) is not part of this machine.`);
    }

    const initialState = startState;
    this._startState = initialState;
    // Runs under the busy flag, so external triggers are rejected until start() settles; entry
    // actions must use state.triggerInternal().
    return this._run((): Promise<void> => {
      return this._changeState(initialState);
    }, false);
  }

  /**
   * Resets the state machine. Exit actions are not run.
   * @param restart An optional flag that indicates the state machine should be restarted after reset.
   */
  public async reset(restart = false): Promise<void> {
    if (this._busy) {
      this.throwError('The state machine is busy. Cannot reset.');
    }
    this._queue = [];
    this._previousState = undefined;
    this._currentState = undefined;
    if (restart) {
      await this.start(this._startState);
    }
  }

  /**
   * Returns a plain, JSON-serializable record of the current, previous and start states, for
   * saving and later passing to `restore()`.
   */
  public snapshot(): IStateMachineSnapshot<TStateId> {
    if (!this._currentState) {
      this.throwError('Cannot take a snapshot before the machine has started.');
    }
    const snapshot: IStateMachineSnapshot<TStateId> = { stateId: this._currentState.id };
    if (this._previousState) {
      snapshot.previousStateId = this._previousState.id;
    }
    if (this._startState) {
      snapshot.startStateId = this._startState.id;
    }
    return snapshot;
  }

  /**
   * Puts the machine into the states recorded by `snapshot()`. Works whether or not the machine
   * has started; exit actions are not run, as with `reset()`. By default entry actions are not run
   * and listeners are not notified, so the machine continues exactly where it left off. Unknown
   * state ids throw before anything changes. Rejects while the machine is busy, like `reset()`.
   * @param snapshot A snapshot taken from this machine (or one with the same state ids).
   * @param options `{ runEntry: true }` runs the restored state's entry actions, as `start()` does.
   */
  public async restore(
    snapshot: IStateMachineSnapshot<TStateId>,
    options: IRestoreOptions = {}
  ): Promise<void> {
    if (this._busy) {
      this.throwError('The state machine is busy. Cannot restore.');
    }
    const state = this._requireState(snapshot.stateId);
    const previous =
      snapshot.previousStateId === undefined
        ? undefined
        : this._requireState(snapshot.previousStateId);
    const start =
      snapshot.startStateId === undefined ? undefined : this._requireState(snapshot.startStateId);

    this._queue = [];
    this._startState = start ?? this._startState ?? state;
    if (!options.runEntry) {
      this._currentState = state;
      this._previousState = previous;
      return;
    }
    this._currentState = undefined;
    this._previousState = previous;
    return this._run((): Promise<void> => {
      return this._enter(state);
    }, false);
  }

  /**
   * This method throws an error with state machine details prefixed to the message.
   * @param message The message to be prefixed.
   * @param trigger Optional trigger.
   */
  public throwError(message: string, trigger?: string): never {
    throw new StateMachineError(
      this._name,
      `State Machine (${this._name}) - ${message}`,
      this._currentState?.name,
      trigger
    );
  }

  /**
   * Checks the machine's structure without running it. Reports registered states that cannot be
   * reached from the start state, non-complete states with no way out, and transitions that target
   * states never added to this machine.
   * @param startState The state to analyze from. Defaults to the start state if the machine has
   * started, otherwise the first state that was added.
   */
  public validate(startState?: AsyncState<TContext, TStateId, TTriggerId>): IValidationResult {
    return validateGraph(this, startState ?? this._startState);
  }

  /**
   * Returns a Mermaid `stateDiagram-v2` definition of this machine.
   * @param startState The state to mark as initial. Defaults as in `validate()`.
   */
  public toMermaid(startState?: AsyncState<TContext, TStateId, TTriggerId>): string {
    return toMermaid(this, startState ?? this._startState);
  }

  /**
   * Returns a Graphviz DOT definition of this machine.
   * @param startState The state to mark as initial. Defaults as in `validate()`.
   */
  public toDot(startState?: AsyncState<TContext, TStateId, TTriggerId>): string {
    return toDot(this, startState ?? this._startState);
  }

  /**
   * Emits a new trigger message which causes the state machine to transition to a new state.
   * Rejects while the machine is busy; from inside a state action use `state.triggerInternal()`.
   * @param triggerId A unique identifier for the trigger.
   * @param options `{ global: true }` (or the legacy `true`) sends a global transition rather
   * than a state-specific one.
   */
  public async trigger(triggerId: TTriggerId, options?: TTriggerOptions): Promise<void> {
    return this._trigger(triggerId, isGlobal(options), false);
  }

  /**
   * Queues a trigger raised from inside a state action. Library-private: reachable only through
   * `AsyncState.triggerInternal()`, because the key is not exported from the package.
   * @param triggerId A unique identifier for the trigger.
   * @param options `{ global: true }` (or the legacy `true`) sends a global transition.
   */
  public async [TRIGGER_INTERNAL](triggerId: TTriggerId, options?: TTriggerOptions): Promise<void> {
    return this._trigger(triggerId, isGlobal(options), true);
  }
}
