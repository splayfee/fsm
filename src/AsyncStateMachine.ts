/**
 * @fileOverview This file holds the AsyncStateMachine class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 1.0.0
 */

import AsyncState, { TEntryActionFn, TExitActionFn } from './AsyncState';
import Transition from './AsyncTransition';
import kebabCase from 'lodash-es/kebabCase';

/**
 * This class defines a new state machine. The state machine takes in
 * multiple states which hold transitions. It changes state on behalf
 * of each state and enforces transition rules. An application can have
 * multiple state machines.
 */
export default class AsyncStateMachine<TContext = any> {
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

  private _isTransitioning = false;

  /** A unique identifier for this state machine. */
  private _name: string;

  /** An optional context that will automatically be sent to every state action. */
  private _context?: TContext;

  /** A collection of all possible global machine transitions between states. */
  private _transitions = new Map<string, Transition>();

  /** A collection of all possible states for this state machine. */
  private _states = new Map<string, AsyncState>();

  /** The state that should be entered when the machine is first started. */
  private _startState?: AsyncState<TContext> = undefined;

  /** The current state of the machine. */
  private _currentState?: AsyncState<TContext> = undefined;

  /** The previous state of the machine; undefiend if there is no previous state. */
  private _previousState?: AsyncState<TContext> = undefined;

  /** A unique identifier for this state machine. */
  public get name(): string {
    return this._name;
  }

  /** An identifier for this state machine. Not gauaranteed unique. Format is snake case and derived from the state machine's name. */
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
  public get currentState(): AsyncState | undefined {
    return this._currentState;
  }

  /** Returns the previous state object or undefined if not set. */
  public get previousState(): AsyncState | undefined {
    return this._previousState;
  }

  /** Flag that indicates whether the state machine has started. */
  public get started(): boolean {
    return this._currentState instanceof AsyncState;
  }

  /**
   * Returns states registered with this state machine.
   */
  public get states(): Map<string, AsyncState<TContext>> {
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
  private async _changeState(newState: AsyncState): Promise<void> {
    let allowExit = true;

    console.info('changing state to: ', newState.name);

    // Throw an error if the machine is already in the requested state.
    if (newState === this._currentState) {
      this._throwStateMachineError(`Already in state: currentState: ${this._currentState.name}.`);
    }

    // Perform an exit action if it exists and record whether to allow the state change.
    if (this._currentState?.exitAction) {
      allowExit = await this._currentState.exitAction(this._currentState, this._context);
      console.info('local exit action allowed? ', allowExit);
    }

    if (this._currentState && this._exitAction) {
      allowExit = await this._exitAction(this._currentState, this._context);
      console.info('global exit action allowed? ', allowExit);
    }

    console.info('allowExit? ', allowExit);

    // The current state can cancel the state change request if necessary.
    if (allowExit) {
      this._previousState = this._currentState;
      this._currentState = newState;

      // Perform any entrance action if it exists
      if (this._currentState?.entryAction) {
        console.info('local entryAction started');
        await this._currentState.entryAction(newState, this._context);
        console.info('local entryAction completed');
      }
      if (this._entryAction) {
        console.info('global entryAction completed');
        await this._entryAction(newState, this._context);
        console.info('global entryAction completed');
      }
    }
  }

  /**
   * This method handles all transitions from state to state. It receives a message used to determine which transition to execute.
   * @param triggerId A unique identifier for the trigger.
   */
  private async _transitionHandler(triggerId: string): Promise<void> {
    console.info('transition start: ', triggerId);
    if (!this.started) {
      this._throwStateMachineError('not started.');
    }

    let transition: Transition | undefined = this._currentState?.getTransition(triggerId);

    // Look for a global state transition
    if (!transition) {
      transition = this._transitions.get(kebabCase(triggerId));
    }

    if (!transition) {
      this._throwStateMachineError(`Invalid Transition - triggerId: ${triggerId}.`);
    } else {
      console.info('transition found: ', transition.targetState.name);
      return this._changeState(transition.targetState);
    }
  }

  /**
   * Adds a new state to the state machine.
   * @param state A new state instance.
   */
  public addState(state: AsyncState): void {
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
  public addGlobalTransition(triggerId: string, targetState: AsyncState): void {
    console.log('triggerId: ', kebabCase(triggerId));
    this._transitions.set(kebabCase(triggerId), new Transition(triggerId, targetState));
  }

  /**
   * This method provides a convenient way to create a new state and automatically add it to this state machine. States can be created and added manually as well.
   * @param id A unique identifier for the new state.
   * @param [isComplete] Boolean that indicates whether the state is a completed state.
   * @param [entryAction] An optional action that fires whenever the state machine enters this state.
   * @param [exitAction] An optional action that fires whenever the state machine exits this state.
   * @returns The newly created state.
   */
  public createState(
    id: string,
    isComplete = false,
    entryAction?: TEntryActionFn<TContext>,
    exitAction?: TExitActionFn<TContext>
  ): AsyncState<TContext> {
    const state = new AsyncState(this, id, isComplete);
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
  public getStateById(id: string): AsyncState | undefined {
    return this._states.get(kebabCase(id));
  }

  /**
   * Starts the state machine, throwing it into its starting state.
   * @param [startState] An optional start state, the default is the first state that was added to the machine.
   */
  public async start(startState: AsyncState = this._states.values().next().value): Promise<void> {
    // Don't restart the machine if it's already started
    if (this._currentState) {
      this._throwStateMachineError('The state machine has already started.');
    }

    // Don't start the machine if there are no states defined
    if (this._states.size === 0) {
      this._throwStateMachineError(
        'No states have been defined. The state machine cannot be started.'
      );
    }

    this._startState = startState;
    await this._changeState(startState);
  }

  /**
   * Resets the state machine.
   * @param [restart] An optional flag that indicates the state machine should be restarted after reset.
   */
  public async reset(restart = false): Promise<void> {
    this._previousState = undefined;
    this._currentState = undefined;
    if (restart) {
      await this.start(this._startState);
    }
  }

  /**
   * Emits a new trigger message which causes the state machine to transition to a new state.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Tells the system to send a global transition rather than a state-specific transition.
   */
  public async trigger(triggerId: string, sendGlobal = false): Promise<void> {
    if (this._isTransitioning) {
      this._throwStateMachineError(
        `Transition from state "${this.currentState?.name}" in progress, cannot start a new transition (${triggerId}) until the previous transition is complete.`
      );
      return;
    }

    this._isTransitioning = true;
    if (!sendGlobal && this._currentState) {
      triggerId = `${this._currentState.id}:${kebabCase(triggerId)}`;
    }
    await this._transitionHandler(triggerId);
    this._isTransitioning = false;
  }
}
