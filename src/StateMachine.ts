/**
 * @fileOverview This file holds the StateMachine class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 1.0.0
 */

import State, { TEntryActionFn, TExitActionFn } from './State';
import Transition from './Transition';
import kebabCase from 'lodash-es/kebabCase';

/**
 * This class defines a new state machine. The state machine takes in
 * multiple states which hold transitions. It changes state on behalf
 * of each state and enforces transition rules. An application can have
 * multiple state machines.
 */
export default class StateMachine<TContext = unknown> {
  /**
   * Instantiates a new state machine.
   * @param name A unique identifier for this state machine.
   * @param [context] An optional context that will automatically be sent to every state action.
   */
  public constructor(
    name: string,
    context?: TContext,
    entryAction?: TEntryActionFn<TContext>,
    exitAction?: TExitActionFn<TContext>
  ) {
    this._name = name;
    this._context = context;
    this._entryAction = entryAction;
    this._exitAction = exitAction;
  }

  private _entryAction?: TEntryActionFn<TContext>;
  private _exitAction?: TExitActionFn<TContext>;

  /** A unique identifier for this state machine. */
  private _name: string;

  /** An optional context that will automatically be sent to every state action. */
  private _context?: TContext;

  /** A collection of all possible global machine transitions between states. */
  private _transitions = new Map<string, Transition>();

  /** A collection of all possible states for this state machine. */
  private _states = new Map<string, State<TContext>>();

  /** The state that should be entered when the machine is first started. */
  private _startState?: State<TContext> = undefined;

  /** The current state of the machine. */
  private _currentState?: State<TContext> = undefined;

  /** The previous state of the machine; undefined if there is no previous state. */
  private _previousState?: State<TContext> = undefined;

  /** A unique identifier for this state machine. */
  public get name(): string {
    return this._name;
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
  public get currentState(): State | undefined {
    return this._currentState;
  }

  /** Returns the previous state object or undefined if not set. */
  public get previousState(): State | undefined {
    return this._previousState;
  }

  /** Flag that indicates whether the state machine has started. */
  public get started(): boolean {
    return this._currentState instanceof State;
  }

  /**
   * Returns states registered with this state machine.
   */
  public get states(): ReadonlyMap<string, State<TContext>> {
    return this._states;
  }

  // ----------------------------------------------------------
  // METHODS
  // ----------------------------------------------------------

  /**
   * This method throws an error with state machine details prefixed to the message.
   * @param message The message to be prefixed.
   */
  private _throwStateMachineError(message: string): string {
    throw new Error(`State Machine (${this._name}) - ${message}`);
  }

  /**
   * This method changes the state of the state machine.
   * @param newState The new state of the machine.
   */
  private _changeState(newState: State): void {
    let allowExit = true;

    // Throw an error if the machine is already in the requested state.
    if (newState === this._currentState) {
      this._throwStateMachineError(`Already in state: currentState: ${this._currentState.name}.`);
    }

    // Perform an exit action if it exists and record whether to allow the state change.
    if (this._currentState?.exitAction) {
      allowExit = this._currentState.exitAction(this._currentState, this._context);
    }

    if (this._currentState && this._exitAction) {
      allowExit = this._exitAction(this._currentState, this._context);
    }

    // The current state can cancel the state change request if necessary.
    if (allowExit) {
      this._previousState = this._currentState;
      this._currentState = newState;

      // Perform an entrance action if it exists
      if (this._currentState?.entryAction) {
        this._currentState.entryAction(newState, this._context);
      }
      if (this._entryAction) {
        this._entryAction(newState, this._context);
      }
    }
  }

  /**
   * This method handles all transitions from state to state. It receives a message used to determine which transition to execute.
   * @param triggerId A unique identifier for the trigger.
   */
  private _transitionHandler(triggerId: string): void {
    if (!this.started) {
      this._throwStateMachineError('Not started. Call start() before trigger().');
    }

    let transition: Transition | undefined = this._currentState?.getTransition(triggerId);

    // Look for a global state transition
    if (!transition) {
      transition = this._transitions.get(kebabCase(triggerId));
    }

    if (!transition) {
      this._throwStateMachineError(`Invalid Transition - triggerId: ${triggerId}.`);
    } else {
      this._changeState(transition.targetState);
    }
  }

  /**
   * Adds a new state to the state machine.
   * @param state A new state instance.
   */
  public addState(state: State): void {
    if (this._states.has(state.id)) {
      this._throwStateMachineError(`State exists: ${state.id}.`);
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
  public addGlobalTransition(triggerId: string, targetState: State): void {
    this._transitions.set(kebabCase(triggerId), new Transition(triggerId, targetState));
  }

  /**
   * This method provides a convenient way to create a new state and automatically add it to this state machine. States can be created and added manually as well.
   * @param name A unique name for the new state.
   * @param [isComplete] Boolean that indicates whether the state is a completed state.
   * @param [entryAction] An optional action that fires whenever the state machine enters this state.
   * @param [exitAction] An optional action that fires whenever the state machine exits this state.
   * @returns The newly created state.
   */
  public createState(
    name: string,
    isComplete = false,
    entryAction?: TEntryActionFn<TContext>,
    exitAction?: TExitActionFn<TContext>
  ): State<TContext> {
    const state = new State(this, name, isComplete);
    state.entryAction = entryAction;
    state.exitAction = exitAction;
    this.addState(state);
    return state;
  }

  /** This method returns the state machine to the previous state if there is one. */
  public gotoPrevious(): void {
    if (this._previousState) {
      this._changeState(this._previousState);
    }
  }

  /**
   * Returns the state corresponding to the requested unique identifier.
   * Every state must have a unique identifier.
   * @param id A unique identifier for the state.
   * @returns The state corresponding to the id, or null if one is not found.
   */
  public getStateById(id: string): State | undefined {
    return this._states.get(kebabCase(id));
  }

  /**
   * Starts the state machine, throwing it into its starting state.
   * @param [startState] An optional start state, the default is the first state that was added to the machine.
   */
  public start(startState: State = this._states.values().next().value): void {
    // Don't restart the machine if it's already started
    if (this._currentState) {
      this._throwStateMachineError('The state machine has already started.');
    }

    // If the startState is missing.
    if (startState && !this._states.has(startState.id)) {
      this._throwStateMachineError(`Start state (${startState.name}) is not part of this machine.`);
    }

    // Don't start the machine if there are no states defined
    if (this._states.size === 0) {
      this._throwStateMachineError(
        'No states have been defined. The state machine cannot be started.'
      );
    }

    this._startState = startState;
    this._changeState(startState);
  }

  /**
   * Resets the state machine.
   * @param [restart] An optional flag that indicates the state machine should be restarted after reset.
   */
  public reset(restart = false): void {
    this._previousState = undefined;
    this._currentState = undefined;
    if (restart) {
      this.start(this._startState);
    }
  }

  /**
   * Emits a new trigger message which causes the state machine to transition to a new state.
   * @param triggerId A unique identifier for the trigger.
   * @param [sendGlobal] Tells the system to send a global transition rather than a state-specific transition.
   */
  public trigger(triggerId: string, sendGlobal = false): void {
    if (!sendGlobal && this._currentState) {
      triggerId = `${this._currentState.id}:${kebabCase(triggerId)}`;
    }
    this._transitionHandler(triggerId);
  }
}
