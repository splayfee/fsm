/**
 * @fileOverview This file holds the AsyncState class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 */

import kebabCase from './kebabCase';
import type AsyncStateMachine from './AsyncStateMachine';
import AsyncTransition from './AsyncTransition';
import { TRIGGER_INTERNAL } from './internal';

export type TEntryActionAsyncFn<TContext = unknown> = (
  state: AsyncState<TContext>,
  context?: TContext
) => Promise<void>;
export type TExitActionAsyncFn<TContext = unknown> = (
  state: AsyncState<TContext>,
  context?: TContext
) => Promise<boolean>;

/** This class defines a new state for the state machine. */
export default class AsyncState<TContext = unknown> {
  /**
   * Instantiates a new state.
   * @param stateMachine The state machine this state is associated with.
   * @param name A descriptive name for the state. Can be used to retrieve the state
   * from the state machine. Also used when defining transitions.
   * @param isComplete Optional Flag that indicates whether the state is a completed state.
   */
  public constructor(stateMachine: AsyncStateMachine<TContext>, name: string, isComplete = false) {
    this._stateMachine = stateMachine;
    this._name = name;
    this._isComplete = isComplete;
  }

  /** A collection of transitions that are allowed for this state. */
  private _transitions = new Map<string, AsyncTransition<TContext>>();

  /** The state machine this state is associated with. */
  private _stateMachine: AsyncStateMachine<TContext>;

  /** The state machine this state is associated with. */
  public get stateMachine(): AsyncStateMachine<TContext> {
    return this._stateMachine;
  }

  /**
   * The local transitions registered on this state, keyed by their local trigger id
   * (`<state id>:<kebab-cased trigger id>`).
   */
  public get transitions(): ReadonlyMap<string, AsyncTransition<TContext>> {
    return this._transitions;
  }

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
  public entryAction?: TEntryActionAsyncFn<TContext>;

  /** An optional action that is invoked whenever the state machine exits this state. */
  public exitAction?: TExitActionAsyncFn<TContext>;

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
  public addTransition(triggerId: string, targetState: AsyncState<TContext>): void {
    const localTriggerId: string = this._getLocalTriggerId(triggerId);
    if (this._stateMachine.started) {
      this._stateMachine.throwError(
        'Cannot add a transition once the machine has started.',
        localTriggerId
      );
    }
    if (this._transitions.has(localTriggerId)) {
      this._stateMachine.throwError(`Transition exists: ${localTriggerId}.`, localTriggerId);
    }
    if (targetState.stateMachine !== this._stateMachine) {
      this._stateMachine.throwError(
        `Target state (${targetState.name}) belongs to a different state machine (${targetState.stateMachine.name}).`,
        localTriggerId
      );
    }
    this._transitions.set(
      localTriggerId,
      new AsyncTransition<TContext>(localTriggerId, targetState)
    );
  }

  /** Returns the transition relating to the trigger specified. */
  public getTransition(triggerId: string): AsyncTransition<TContext> | undefined {
    return this._transitions.get(triggerId);
  }

  /**
   * Triggers the state machine which will attempt to transition to a new state.
   * Equivalent to `triggerInternal()`: called from inside a state action (while the machine is
   * busy) the trigger is queued and runs once the current transition completes. Code outside the
   * machine should call `machine.trigger()`, which rejects while the machine is busy.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Optional flag which tells the state machine to send a
   * global transition rather than a state-specific transition. Global transitions
   * can bypass local state transition rules.
   */
  public async trigger(triggerId: string, sendGlobal = false): Promise<void> {
    return this._stateMachine[TRIGGER_INTERNAL](triggerId, sendGlobal);
  }

  /**
   * Triggers the state machine which will attempt to transition to a new state
   * from within this state (entry/exit). These triggers are considered
   * *internal* and are queued while the state machine is busy; the queued trigger runs once
   * the current transition completes.
   * @param triggerId A unique identifier for the trigger.
   * @param sendGlobal Optional flag which tells the state machine to send a
   * global transition rather than a state-specific transition. Global transitions
   * can bypass local state transition rules.
   */
  public async triggerInternal(triggerId: string, sendGlobal = false): Promise<void> {
    return this._stateMachine[TRIGGER_INTERNAL](triggerId, sendGlobal);
  }
}
