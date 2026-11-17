/**
 * @fileOverview This file holds the State class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 */

import { ID_DERIVED } from './internal';
import kebabCase from './kebabCase';
import type StateMachine from './StateMachine';
import Transition from './Transition';
import type { IStateOptions, ITransitionOptions, TTriggerOptions } from './types';

export type TEntryActionFn<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> = (state: State<TContext, TStateId, TTriggerId>, context: TContext) => void;
export type TExitActionFn<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> = (state: State<TContext, TStateId, TTriggerId>, context: TContext) => boolean;

/** Options for `createState()`: state options plus its entry and exit actions. */
export interface ICreateStateOptions<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> extends IStateOptions<TStateId> {
  /** An optional action that fires whenever the state machine enters this state. */
  entryAction?: TEntryActionFn<TContext, TStateId, TTriggerId>;
  /** An optional action that fires whenever the state machine exits this state. Can block the exit. */
  exitAction?: TExitActionFn<TContext, TStateId, TTriggerId>;
}

/** This class defines a new state for the state machine. */
export default class State<
  TContext = unknown,
  TStateId extends string = string,
  TTriggerId extends string = string
> {
  /**
   * Instantiates a new state.
   * @param stateMachine The state machine this state is associated with.
   * @param name A descriptive name for the state. Its kebab-cased form is the id unless `id` is given.
   * @param isCompleteOrOptions Whether the state is a completed state, or a state options object.
   */
  public constructor(
    stateMachine: StateMachine<TContext, TStateId, TTriggerId>,
    name: TStateId,
    isCompleteOrOptions?: boolean | Omit<IStateOptions<TStateId>, 'id'>
  );
  public constructor(
    stateMachine: StateMachine<TContext, TStateId, TTriggerId>,
    name: string,
    options: IStateOptions<TStateId> & { id: TStateId }
  );
  public constructor(
    stateMachine: StateMachine<TContext, TStateId, TTriggerId>,
    name: string,
    isCompleteOrOptions: boolean | IStateOptions<TStateId> = false
  ) {
    const options: IStateOptions<TStateId> =
      typeof isCompleteOrOptions === 'boolean'
        ? { isComplete: isCompleteOrOptions }
        : isCompleteOrOptions;
    if (options.id !== undefined && (typeof options.id !== 'string' || options.id === '')) {
      stateMachine.throwError(`State id must be a non-empty string (state: ${name}).`);
    }
    this._stateMachine = stateMachine;
    this._name = name;
    this._idDerived = options.id === undefined;
    this._id = options.id ?? (kebabCase(name) as TStateId);
    this._isComplete = options.isComplete ?? false;
  }

  /** A collection of transitions that are allowed for this state. */
  private _transitions = new Map<string, Transition<TContext, TStateId, TTriggerId>>();

  /** The state machine this state is associated with. */
  private _stateMachine: StateMachine<TContext, TStateId, TTriggerId>;

  /** The state machine this state is associated with. */
  public get stateMachine(): StateMachine<TContext, TStateId, TTriggerId> {
    return this._stateMachine;
  }

  /**
   * The local transitions registered on this state, keyed by their local trigger id
   * (`<state id>:<kebab-cased trigger id>`).
   */
  public get transitions(): ReadonlyMap<string, Transition<TContext, TStateId, TTriggerId>> {
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

  private _id: TStateId;
  /**
   * An identifier for this state: the `id` option if one was given, otherwise the kebab-cased
   * name (`'My State'` becomes `'my-state'`). Compare against this, not `name`.
   */
  public get id(): TStateId {
    return this._id;
  }

  private _idDerived: boolean;
  /** Library-private: whether the id was derived from the name rather than given explicitly. */
  public get [ID_DERIVED](): boolean {
    return this._idDerived;
  }

  private _isComplete: boolean;
  /** Optional Flag that indicates whether the state is a completed state. */
  public get isComplete(): boolean {
    return this._isComplete;
  }

  /** An optional action that is invoked whenever the state machine enters this state. */
  public entryAction?: TEntryActionFn<TContext, TStateId, TTriggerId>;

  /** An optional action that is invoked whenever the state machine exits this state. */
  public exitAction?: TExitActionFn<TContext, TStateId, TTriggerId>;

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
   * @param options Optional transition options. `{ reenter: true }` allows `targetState` to be this state.
   */
  public addTransition(
    triggerId: TTriggerId,
    targetState: State<TContext, TStateId, TTriggerId>,
    options?: ITransitionOptions
  ): void {
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
      new Transition<TContext, TStateId, TTriggerId>(localTriggerId, targetState, options)
    );
  }

  /** Returns the transition relating to the trigger specified. */
  public getTransition(triggerId: string): Transition<TContext, TStateId, TTriggerId> | undefined {
    return this._transitions.get(triggerId);
  }

  /**
   * Triggers the state machine which will attempt to transition to a new state.
   * @param triggerId A unique identifier for the trigger.
   * @param options `{ global: true }` (or the legacy `true`) sends a global transition rather
   * than a state-specific one. Global transitions can bypass local state transition rules.
   */
  public trigger(triggerId: TTriggerId, options?: TTriggerOptions): void {
    this._stateMachine.trigger(triggerId, options);
  }
}
