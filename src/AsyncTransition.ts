/**
 * @fileOverview This file holds the AsyncTransition class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 */

import type AsyncState from './AsyncState';
import type { ITransitionOptions } from './types';

/**
 * This class defines a new transition for the state machine. Transitions
 * are associated with every state. Only explicit transitions are allowed
 * between states.
 */
export default class AsyncTransition<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> {
  /**
   * Instantiates a new transition.
   * @param triggerId A unique identifier for the trigger.
   * @param targetState The new state that will be entered if the transition is successful.
   * @param options Optional transition options, such as `reenter`.
   */
  public constructor(
    triggerId: string,
    targetState: AsyncState<TContext, TStateId, TTriggerId>,
    options: ITransitionOptions = {}
  ) {
    this._triggerId = triggerId;
    this._targetState = targetState;
    this._reenter = options.reenter ?? false;
  }

  private _triggerId: string;
  /** A unique identifier for the trigger. */
  public get triggerId(): string {
    return this._triggerId;
  }

  private _targetState: AsyncState<TContext, TStateId, TTriggerId>;
  /** The new state that will be entered if the transition is successful. */
  public get targetState(): AsyncState<TContext, TStateId, TTriggerId> {
    return this._targetState;
  }

  private _reenter: boolean;
  /** Whether this transition may target the state it starts from (a self-transition). */
  public get reenter(): boolean {
    return this._reenter;
  }
}
