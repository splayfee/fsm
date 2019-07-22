'use strict';

/**
 * @fileOverview This file holds the Transition class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 2.0.0
 */

import State from './State';

/**
 * This class defines a new transition for the state machine. Transitions
 * are associated with every state. Only explicit transitions are allowed
 * between states.
 */
export default class Transition {
  /**
     * Instantiates a new transition.
     * @param triggerId A unique identifier for the trigger.
     * @param targetState The new state that will be entered if the transition is successful.
     */
  public constructor(triggerId: string, targetState: State) {
    this._triggerId = triggerId;
    this._targetState = targetState;
  }

  private _triggerId: string;
  /** A unique identifier for the trigger. */
  public get triggerId(): string {
    return this._triggerId;
  }

  private _targetState: State;
  /** The new state that will be entered if the transition is successful. */
  public get targetState(): State {
    return this._targetState;
  }
}

module.exports = Transition;
