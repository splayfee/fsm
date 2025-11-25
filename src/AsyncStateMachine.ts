/**
 * @fileOverview This file holds the AsyncStateMachine class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 */

import AsyncState, { TEntryActionAsyncFn, TExitActionAsyncFn } from './AsyncState';
import AsyncTransition from './AsyncTransition';
import kebabCase from 'lodash-es/kebabCase';
import StateMachineError from './StateMachineError';

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
   * Internal queue of trigger identifiers that will be processed sequentially.
   * Internal triggers raised from states during entry/exit are enqueued here.
   */
  private _triggerQueue: string[] = [];

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
   * Processes queued triggers sequentially while the state machine is busy.
   * Internal triggers raised during entry/exit are enqueued and handled here.
   */
  private async _processTriggerQueue(): Promise<void> {
    // Another processor is already running; nothing to do.
    if (this._busy) {
      return;
    }

    this._busy = true;
    try {
      while (this._triggerQueue.length > 0) {
        const nextTriggerId = this._triggerQueue.shift()!;
        await this._transitionHandler(nextTriggerId);
      }
    } finally {
      this._busy = false;
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

  // ----------------------------------------------------------
  // METHODS
  // ----------------------------------------------------------

  /**
   * This method changes the state of the state machine.
   * @param newState The new state of the machine.
   */
  private async _changeState(newState: AsyncState<TContext>): Promise<void> {
    let allowExit = true;

    // Throw an error if the machine is already in the requested state.
    if (newState === this._currentState) {
      this.throwError(`Already in state: currentState: ${this._currentState.name}.`);
    }

    // Perform an exit action if it exists and record whether to allow the state change.
    if (this._currentState?.exitAction) {
      allowExit = await this._currentState.exitAction(this._currentState, this._context);
    }

    if (this._currentState && this._exitAction) {
      allowExit = await this._exitAction(this._currentState, this._context);
    }

    // The current state can cancel the state change request if necessary.
    if (allowExit) {
      this._previousState = this._currentState;
      this._currentState = newState;

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
   * This method handles all transitions from state to state. It receives a message used to determine which transition to execute.
   * @param triggerId A unique identifier for the trigger.
   */
  private async _transitionHandler(triggerId: string): Promise<void> {
    let transition: AsyncTransition<TContext> | undefined =
      this._currentState?.getTransition(triggerId);

    // Look for a global state transition
    if (!transition) {
      transition = this._transitions.get(kebabCase(triggerId));
    }

    if (!transition) {
      this.throwError(`Invalid Transition - triggerId: ${triggerId}.`, triggerId);
    } else {
      return this._changeState(transition.targetState);
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
    this._transitions.set(
      kebabCase(triggerId),
      new AsyncTransition<TContext>(triggerId, targetState)
    );
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

  /** This method returns the state machine to the previous state if there is one. */
  public async gotoPrevious(): Promise<void> {
    if (this._previousState) {
      await this._changeState(this._previousState);
    }
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

    this._startState = startState;
    await this._changeState(startState);
  }

  /**
   * Resets the state machine.
   * @param restart An optional flag that indicates the state machine should be restarted after reset.
   */
  public async reset(restart = false): Promise<void> {
    if (this._busy) {
      this.throwError('The state machine is busy. Cannot reset.');
    }
    this._triggerQueue = [];
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
  public throwError(message: string, trigger?: string): void {
    throw new StateMachineError(
      this._name,
      `State Machine (${this._name}) - ${message}`,
      this._currentState?.name,
      trigger
    );
  }

  /**
   * Emits a new trigger message which causes the state machine to transition to a new state.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Tells the system to send a global transition rather than a state-specific transition.
   */
  public async trigger(triggerId: string, sendGlobal?: boolean): Promise<void>;
  public async trigger(
    triggerId: string,
    sendGlobal: boolean | undefined,
    internal: boolean
  ): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public async trigger(triggerId: string, sendGlobal = false, _internal = false): Promise<void> {
    if (!this.started) {
      this.throwError('Cannot trigger if the machine has not started.', triggerId);
    }
    if (this.isComplete) {
      this.throwError('Cannot trigger if the machine has completed.', triggerId);
    }

    // External callers must respect the busy flag.
    if (this._busy && !_internal) {
      this.throwError('State Machine is busy.', triggerId);
    }

    // Compute the local trigger id relative to the current state unless this is a global trigger.
    if (!sendGlobal && this._currentState) {
      triggerId = `${this._currentState.id}:${kebabCase(triggerId)}`;
    }

    // If we're already busy and this is an internal trigger, just enqueue it.
    if (this._busy && _internal) {
      this._triggerQueue.push(triggerId);
      return;
    }

    // Not busy: enqueue this trigger and start the processor.
    this._triggerQueue.push(triggerId);
    return this._processTriggerQueue();
  }
}
