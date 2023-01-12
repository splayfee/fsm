'use strict';

/**
 * @fileOverview This file holds the State class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 2.0.0
 */

import { kebabCase } from 'lodash';
import StateMachine from './StateMachine';
import Transition from './Transition';

export type TEntryActionFn<TContext = any> = (state: State<TContext>, context?: TContext) => void;
export type TExitActionFn<TContext = any> = (state: State<TContext>, context?: TContext) => boolean;

/** This class defines a new state for the state machine. */
export default class State <TContext = any>{
  /**
   * Instantiates a new state machine.
   * @param stateMachine The state machine this state is associated with.
   * @param name A descriptive name for the state. Can be used to retrieve the state
   * from the state machine. Also used when defining transitions.
   * @param isComplete Optional Flag that indicates whether the state is a completed state.
   */
  public constructor(stateMachine: StateMachine, name: string, isComplete: boolean = false) {
    this._stateMachine = stateMachine;
    this._name = name;
    this._isComplete = isComplete;
  }

  /** A collection of transitions that are allowed for this state. */
  private _transitions: Map<string, Transition> = new Map();

  /** The state machine this state is associated with. */
  private _stateMachine: StateMachine;

  private _name: string;
  /**
   * A descriptive name for the state. Can be used to retrieve the state
   * from the state machine. Also used when defining transitions.
   */
  public get name(): string {
    return this._name;
  }

  /**
   * An identifier for this state. Not gauaranteed unique. Format is snake case and derived from the state's name.
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
   * This method returns a trigger id specific to this state and covnerted to snake case.
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
  public addTransition(triggerId: string, targetState: State): void {
    const localTriggerId: string = this._getLocalTriggerId(triggerId);
    this._transitions.set(localTriggerId, new Transition(localTriggerId, targetState));
  }

  /** Returns the transition relating to the trigger specified. */
  public getTransition(triggerId: string): Transition | undefined {
    return this._transitions.get(triggerId);
  }

  /**
   * Triggers the state machine which will attempt to transition to a new state.
   * @param {String} triggerId A unique identifier for the trigger.
   * @param {Boolean} [sendGlobal] Optional flag which tells the state machine to send a
   * global transition rather than a state-specific transition. Global transitions
   * can bypass local state transition rules.
   */
  public trigger(triggerId: string, sendGlobal: boolean = false): void {
    this._stateMachine.trigger(triggerId, sendGlobal);
  }
}
