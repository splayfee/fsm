/**
 * @fileOverview This file holds the AsyncTransition class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 2.0.0
 */

import AsyncState from './AsyncState';

/**
 * This class defines a new transition for the state machine. Transitions
 * are associated with every state. Only explicit transitions are allowed
 * between states.
 */
export default class AsyncTransition {
  /**
   * Instantiates a new transition.
   * @param triggerId A unique identifier for the trigger.
   * @param targetState The new state that will be entered if the transition is successful.
   */
  public constructor(triggerId: string, targetState: AsyncState) {
    this._triggerId = triggerId;
    this._targetState = targetState;
  }

  private _triggerId: string;
  /** A unique identifier for the trigger. */
  public get triggerId(): string {
    return this._triggerId;
  }

  private _targetState: AsyncState;
  /** The new state that will be entered if the transition is successful. */
  public get targetState(): AsyncState {
    return this._targetState;
  }
}
