/**
 * @fileOverview This file holds the AsyncState class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 2.0.0
 */

import kebabCase from 'lodash-es/kebabCase';
import AsyncStateMachine from './AsyncStateMachine';
import AsyncTransition from './AsyncTransition';

export type TEntryActionFn<TContext = unknown> = (
  state: AsyncState<TContext>,
  context?: TContext
) => Promise<void>;
export type TExitActionFn<TContext = unknown> = (
  state: AsyncState<TContext>,
  context?: TContext
) => Promise<boolean>;

/** This class defines a new state for the state machine. */
export default class AsyncState<TContext = any> {
  /**
   * Instantiates a new state.
   * @param stateMachine The state machine this state is associated with.
   * @param name A descriptive name for the state. Can be used to retrieve the state
   * from the state machine. Also used when defining transitions.
   * @param isComplete Optional Flag that indicates whether the state is a completed state.
   */
  public constructor(stateMachine: AsyncStateMachine, name: string, isComplete = false) {
    this._stateMachine = stateMachine;
    this._name = name;
    this._isComplete = isComplete;
  }

  /** A collection of transitions that are allowed for this state. */
  private _transitions = new Map<string, AsyncTransition>();

  /** The state machine this state is associated with. */
  private _stateMachine: AsyncStateMachine;

  private _name: string;
  /**
   * A descriptive name for the state. Can be used to retrieve the state
   * from the state machine. Also used when defining transitions.
   */
  public get name(): string {
    return this._name;
  }

  /**
   * An identifier for this state. Not guaranteed unique. Format is kebab case and derived from the state's name.
   */
  public get id(): string {
    return kebabCase(this.name);
  }

  private _isComplete: boolean;
  /** Optional Flag that indicates whether the state is a completed state. */
  public get isComplete(): boolean {
    return this._isComplete;
  }

  /** An optional action that is invoked whenever the state machine enters this state. */
  public entryAction?: TEntryActionFn<TContext>;

  /** An optional action that is invoked whenever the state machine exits this state. */
  public exitAction?: TExitActionFn<TContext>;

  //-----------------------------------------------------------------------
  // METHODS
  //-----------------------------------------------------------------------

  /**
   * This method returns a trigger id specific to this state and converted to kebab case.
   * @param triggerId The initial trigger id.
   */
  private _getLocalTriggerId(triggerId: string): string {
    return `${this.id}:${kebabCase(triggerId)}`;
  }

  /**
   * Adds a local transition from this state to a new target state.
   * @param triggerId The associated unique identifier used to trigger this transition.
   * @param targetState The target state to enter upon transition.
   */
  public addTransition(triggerId: string, targetState: AsyncState): void {
    const localTriggerId: string = this._getLocalTriggerId(triggerId);
    if (this._transitions.has(localTriggerId)) {
      this._stateMachine.throwStateMachineError?.(`Transition exists: ${localTriggerId}.`);
    }
    this._transitions.set(localTriggerId, new AsyncTransition(localTriggerId, targetState));
  }

  /** Returns the transition relating to the trigger specified. */
  public getTransition(triggerId: string): AsyncTransition | undefined {
    return this._transitions.get(triggerId);
  }

  /**
   * Triggers the state machine which will attempt to transition to a new state.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Optional flag which tells the state machine to send a
   * global transition rather than a state-specific transition. Global transitions
   * can bypass local state transition rules.
   */

  public async trigger(triggerId: string, sendGlobal = false): Promise<void> {
    return this._stateMachine.trigger(triggerId, sendGlobal);
  }
}
