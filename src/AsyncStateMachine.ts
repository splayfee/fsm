/**
 * @fileOverview This file holds the AsyncStateMachine class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 */

import AsyncState, { TEntryActionAsyncFn, TExitActionAsyncFn } from './AsyncState';
import AsyncTransition from './AsyncTransition';
import kebabCase from './kebabCase';
import StateMachineError from './StateMachineError';
import { IValidationResult, toDot, toMermaid, validateGraph } from './graph';
import { TRIGGER_INTERNAL } from './internal';

/** Describes a completed state change. Passed to every `onTransition` listener. */
export interface IAsyncTransitionEvent<TContext = unknown> {
  /** The state that was exited, or undefined when the machine was just started. */
  from?: AsyncState<TContext>;
  /** The state that was entered. */
  to: AsyncState<TContext>;
  /** The trigger id as it was passed to `trigger()`; undefined for `start()` and `gotoPrevious()`. */
  trigger?: string;
}

export type TAsyncTransitionListenerFn<TContext = unknown> = (
  event: IAsyncTransitionEvent<TContext>
) => void;

/** A unit of queued work: a triggered transition, a start, or a return to the previous state. */
type TJob = () => Promise<void>;

/**
 * This class defines a new state machine. The state machine takes in
 * multiple states which hold transitions. It changes state on behalf
 * of each state and enforces transition rules. An application can have
 * multiple state machines.
 */
export default class AsyncStateMachine<TContext = unknown> {
  /**
   * Instantiates a new state machine.
   * @param name A unique identifier for this state machine.
   * @param context An optional context that will automatically be sent to every state action.
   */
  public constructor(
    name: string,
    context?: TContext,
    entryAction?: TEntryActionAsyncFn<TContext>,
    exitAction?: TExitActionAsyncFn<TContext>
  ) {
    this._name = name;
    this._context = context;
    this._entryAction = entryAction;
    this._exitAction = exitAction;
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
  private _transitionListeners = new Set<TAsyncTransitionListenerFn<TContext>>();

  /** Fires when this state is entered. */
  private _entryAction?: TEntryActionAsyncFn<TContext>;

  /** Fires when this state attempts to exit. Can be blocked. */
  private _exitAction?: TExitActionAsyncFn<TContext>;

  /** A unique identifier for this state machine. */
  private _name: string;

  /** An optional context that will automatically be sent to every state action. */
  private _context?: TContext;

  /** A collection of all possible global machine transitions between states. */
  private _transitions = new Map<string, AsyncTransition<TContext>>();

  /** A collection of all possible states for this state machine. */
  private _states = new Map<string, AsyncState<TContext>>();

  /** The state that should be entered when the machine is first started. */
  private _startState?: AsyncState<TContext> = undefined;

  /** The current state of the machine. */
  private _currentState?: AsyncState<TContext> = undefined;

  /** The previous state of the machine; undefined if there is no previous state. */
  private _previousState?: AsyncState<TContext> = undefined;

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
  private _trigger(triggerId: string, sendGlobal: boolean, internal: boolean): Promise<void> {
    this._assertCanTrigger(triggerId);
    return this._run(
      async (): Promise<void> => {
        // Checked again when the trigger runs: an earlier queued job may have completed the machine.
        this._assertCanTrigger(triggerId);
        // Resolved when the trigger runs, not when it was queued, so a trigger queued from an exit
        // action applies to the state being entered.
        await this._transitionHandler(this._resolveTriggerId(triggerId, sendGlobal), triggerId);
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
  public get currentState(): AsyncState<TContext> | undefined {
    return this._currentState;
  }

  /** Returns the previous state object or undefined if not set. */
  public get previousState(): AsyncState<TContext> | undefined {
    return this._previousState;
  }

  /** Flag that indicates whether the state machine has started. */
  public get started(): boolean {
    return this._currentState instanceof AsyncState;
  }

  /**
   * Returns states registered with this state machine.
   */
  public get states(): ReadonlyMap<string, AsyncState<TContext>> {
    return this._states;
  }

  /** Returns the global transitions registered with this state machine, keyed by kebab-cased trigger id. */
  public get globalTransitions(): ReadonlyMap<string, AsyncTransition<TContext>> {
    return this._transitions;
  }

  // ----------------------------------------------------------
  // METHODS
  // ----------------------------------------------------------

  /**
   * This method changes the state of the state machine.
   * @param newState The new state of the machine.
   * @param trigger The trigger id that caused the change, if any.
   */
  private async _changeState(newState: AsyncState<TContext>, trigger?: string): Promise<void> {
    let allowExit = true;

    // Throw an error if the machine is already in the requested state.
    if (newState === this._currentState) {
      this.throwError(`Already in state: currentState: ${this._currentState.name}.`);
    }

    // Perform exit actions if they exist. Both run; either one can block the state change.
    if (this._currentState?.exitAction) {
      allowExit = await this._currentState.exitAction(this._currentState, this._context);
    }

    if (this._currentState && this._exitAction) {
      const machineAllowExit = await this._exitAction(this._currentState, this._context);
      allowExit = allowExit && machineAllowExit;
    }

    // The current state can cancel the state change request if necessary.
    if (allowExit) {
      const from = this._currentState;
      this._previousState = this._currentState;
      this._currentState = newState;

      // Notify listeners before entry actions so that transitions triggered from inside an
      // entry action are reported in the order they happen.
      for (const listener of this._transitionListeners) {
        listener({ from, to: newState, trigger });
      }

      // Perform any entrance action if it exists
      if (this._currentState?.entryAction) {
        await this._currentState.entryAction(newState, this._context);
      }
      if (this._entryAction) {
        await this._entryAction(newState, this._context);
      }
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
   * Finds the transition for a resolved trigger id: a local transition on the current state
   * first, then a global transition.
   * @param resolvedTriggerId A trigger id returned by `_resolveTriggerId`.
   */
  private _findTransition(resolvedTriggerId: string): AsyncTransition<TContext> | undefined {
    return (
      this._currentState?.getTransition(resolvedTriggerId) ??
      this._transitions.get(kebabCase(resolvedTriggerId))
    );
  }

  /**
   * This method handles all transitions from state to state. It receives a message used to determine which transition to execute.
   * @param resolvedTriggerId The trigger id used for lookup.
   * @param triggerId The trigger id as passed by the caller.
   */
  private async _transitionHandler(resolvedTriggerId: string, triggerId: string): Promise<void> {
    const transition = this._findTransition(resolvedTriggerId);
    if (!transition) {
      this.throwError(`Invalid Transition - triggerId: ${resolvedTriggerId}.`, resolvedTriggerId);
    } else {
      return this._changeState(transition.targetState, triggerId);
    }
  }

  /**
   * Adds a new state to the state machine.
   * @param state A new state instance.
   */
  public addState(state: AsyncState<TContext>): void {
    if (this._states.has(state.id)) {
      this.throwError(`State exists: ${state.id}.`);
    }
    if (this.started) {
      this.throwError('Cannot add a state once the machine has started.');
    }
    this._states.set(state.id, state);
  }

  /**
   * Adds a global transition from the current state to some new state. Global transitions can
   * bypass local state transition restrictions and eliminate the need to register a transition
   * with each local state.
   * @param triggerId A unique identifier for the trigger.
   * @param targetState The target state.
   */
  public addGlobalTransition(triggerId: string, targetState: AsyncState<TContext>): void {
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
      new AsyncTransition<TContext>(triggerId, targetState)
    );
  }

  /**
   * Returns true if `trigger()` would find a valid transition for this trigger right now.
   * Never throws. Exit actions are not run, so a transition reported as valid can still be
   * blocked by an exit action. The busy flag is not considered: while busy, an external
   * `trigger()` is rejected, but an internal one is queued.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Whether to check for a global transition rather than a state-specific transition.
   */
  public canTrigger(triggerId: string, sendGlobal = false): boolean {
    if (!this.started || this.isComplete) {
      return false;
    }
    const transition = this._findTransition(this._resolveTriggerId(triggerId, sendGlobal));
    return transition !== undefined && transition.targetState !== this._currentState;
  }

  /**
   * This method provides a convenient way to create a new state and automatically add it to this state machine. States can be created and added manually as well.
   * @param name A unique name for the new state.
   * @param isComplete Boolean that indicates whether the state is a completed state.
   * @param entryAction An optional action that fires whenever the state machine enters this state.
   * @param exitAction An optional action that fires whenever the state machine exits this state.
   * @returns The newly created state.
   */
  public createState(
    name: string,
    isComplete = false,
    entryAction?: TEntryActionAsyncFn<TContext>,
    exitAction?: TExitActionAsyncFn<TContext>
  ): AsyncState<TContext> {
    const state = new AsyncState(this, name, isComplete);
    state.entryAction = entryAction;
    state.exitAction = exitAction;
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
   * Returns the state corresponding to the requested unique identifier.
   * Every state must have a unique identifier.
   * @param id A unique identifier for the state.
   * @returns The state corresponding to the id, or null if one is not found.
   */
  public getStateById(id: string): AsyncState<TContext> | undefined {
    return this._states.get(kebabCase(id));
  }

  /**
   * Registers a listener that is called after every state change, once exit actions have allowed
   * it and before entry actions run. Listeners are called synchronously and are not awaited.
   * @param listener The listener to call.
   * @returns A function that removes the listener.
   */
  public onTransition(listener: TAsyncTransitionListenerFn<TContext>): () => void {
    this._transitionListeners.add(listener);
    return (): void => {
      this.offTransition(listener);
    };
  }

  /**
   * Removes a listener registered with `onTransition`.
   * @param listener The listener to remove.
   */
  public offTransition(listener: TAsyncTransitionListenerFn<TContext>): void {
    this._transitionListeners.delete(listener);
  }

  /**
   * Starts the state machine, throwing it into its starting state.
   * @param startState An optional start state, the default is the first state that was added to the machine.
   */
  public async start(startState?: AsyncState<TContext>): Promise<void> {
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
  public validate(startState?: AsyncState<TContext>): IValidationResult {
    return validateGraph(this, startState ?? this._startState);
  }

  /**
   * Returns a Mermaid `stateDiagram-v2` definition of this machine.
   * @param startState The state to mark as initial. Defaults as in `validate()`.
   */
  public toMermaid(startState?: AsyncState<TContext>): string {
    return toMermaid(this, startState ?? this._startState);
  }

  /**
   * Returns a Graphviz DOT definition of this machine.
   * @param startState The state to mark as initial. Defaults as in `validate()`.
   */
  public toDot(startState?: AsyncState<TContext>): string {
    return toDot(this, startState ?? this._startState);
  }

  /**
   * Emits a new trigger message which causes the state machine to transition to a new state.
   * Rejects while the machine is busy; from inside a state action use `state.triggerInternal()`.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Tells the system to send a global transition rather than a state-specific transition.
   */
  public async trigger(triggerId: string, sendGlobal = false): Promise<void> {
    return this._trigger(triggerId, sendGlobal, false);
  }

  /**
   * Queues a trigger raised from inside a state action. Library-private: reachable only through
   * `AsyncState.triggerInternal()`, because the key is not exported from the package.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Tells the system to send a global transition rather than a state-specific transition.
   */
  public async [TRIGGER_INTERNAL](triggerId: string, sendGlobal = false): Promise<void> {
    return this._trigger(triggerId, sendGlobal, true);
  }
}
