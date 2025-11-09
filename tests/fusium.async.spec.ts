/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { AsyncState, AsyncStateMachine, AsyncTransition } from '../src/index';
import { TEntryActionFn, TExitActionFn } from '../src/AsyncState';

function _timeout(timeout = 100): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

describe('test states', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should reject when starting a machine with no states', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');

    await expect(stateMachine.start()).rejects.toThrow(
      'State Machine (my first state machine) - No states have been defined. The state machine cannot be started.'
    );
  });

  it('should reject when starting a machine that has already started', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state');
    expect(state1).toBeDefined();

    await stateMachine.start();
    await expect(stateMachine.start()).rejects.toThrow(
      'State Machine (my first state machine) - The state machine has already started.'
    );
  });

  it('should create and add a state manually', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = new AsyncState(stateMachine, 'my first state');
    stateMachine.addState(state1);

    const foundState: AsyncState | undefined = stateMachine.getStateById(state1.id);
    expect(foundState).toEqual(state1);
  });

  it('should create and add a state automatically', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    stateMachine.createState('my first state', true);

    const foundState: AsyncState | undefined = stateMachine.states.values().next().value;
    expect(foundState).toBeDefined();
    expect(foundState!.name).toBe('my first state');
    expect(foundState!.isComplete).toBe(true);
  });

  it('should throw a state exists error', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = new AsyncState(stateMachine, 'my first state', false);
    const state2: AsyncState = new AsyncState(stateMachine, 'my first state', false);

    stateMachine.addState(state1);
    expect(() => {
      stateMachine.addState(state2);
    }).toThrow('State Machine (my first state machine) - State exists: my-first-state.');
  });

  it('should have a default start state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);

    await stateMachine.start();
    expect(state1).toEqual(stateMachine.currentState);
  });

  it('should start with an explicit start state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    const state2: AsyncState = stateMachine.createState('my second state', false);

    await stateMachine.start(state2);
    expect(state2).toEqual(stateMachine.currentState);
  });

  it('should transition from current state to previous state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);
    const state2: AsyncState = stateMachine.createState('my second state', false);

    state1.entryAction = async (state: AsyncState): Promise<void> => {
      await state.trigger('next', false);
    };
    state1.addTransition('next', state2);

    await stateMachine.start(state1);
    expect(stateMachine.currentState).toEqual(state2);
    expect(stateMachine.previousState).toEqual(state1);
  });

  it('should return the state machine name', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    expect(stateMachine.name).toEqual('my first state machine');
  });

  it('should return the state machine id', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    expect(stateMachine.id).toEqual('my-first-state-machine');
  });

  it('should start with the first state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);

    await stateMachine.start(state1);
    expect(stateMachine.started).toEqual(true);
    expect(stateMachine.currentState).toEqual(state1);
  });

  it('Should reset the state then restart it', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);

    await stateMachine.start(state1);
    await stateMachine.reset(true);

    expect(stateMachine.currentState).toEqual(state1);
    expect(stateMachine.previousState).toEqual(undefined);
  });

  it('Should reset the state but not restart it', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);
    const state2: AsyncState = stateMachine.createState('my second state', false);

    state1.entryAction = async (state: AsyncState): Promise<void> => {
      await state.trigger('next');
    };
    state1.addTransition('next', state2);

    await stateMachine.start(state1);
    await stateMachine.reset();

    expect(stateMachine.currentState).toEqual(undefined);
    expect(stateMachine.previousState).toEqual(undefined);
  });

  it('Should block exit from the current state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);
    const state2: AsyncState = stateMachine.createState('my second state', false);

    state1.exitAction = async (): Promise<boolean> => {
      await _timeout();
      return false;
    };
    state1.addTransition('next', state2);

    await stateMachine.start(state1);

    const p = state1.trigger('next');
    await vi.advanceTimersByTimeAsync(100);
    await p;

    expect(stateMachine.currentState).toEqual(state1);
  });

  it('Should attach entry and exit actions from the constructor', async () => {
    let counter = 0;
    const entryAction = async (): Promise<void> => {
      counter++;
    };
    const exitAction = async (): Promise<boolean> => {
      counter++;
      return true;
    };

    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState(
      'my first state',
      false,
      entryAction,
      exitAction
    );
    const state2: AsyncState = stateMachine.createState('my second state', false);

    state1.addTransition('next', state2);

    await stateMachine.start(state1);
    await state1.trigger('next');

    expect(stateMachine.currentState).toEqual(state2);
    expect(counter).toEqual(2);
  });
});

describe('test global state transition', () => {
  it('should transition to a global state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', false);
    const state3: AsyncState = stateMachine.createState('my third state', false);

    stateMachine.addGlobalTransition('gotoThree', state3);

    await stateMachine.start();
    await stateMachine.trigger('gotoThree', true);

    expect(stateMachine.started).toEqual(true);
    expect(stateMachine.currentState).toEqual(state3);
  });
});

describe('test transition', () => {
  it('should create a new transition', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const state1: AsyncState = stateMachine.createState('my first state', false);
    const transition: AsyncTransition = new AsyncTransition('next', state1);

    expect(transition).toBeDefined();
    expect(transition.triggerId).toEqual('next');
    expect(transition.targetState).toEqual(state1);
  });
});

describe('test the state machine', () => {
  it('should be in completed state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const s1: AsyncState = stateMachine.createState('my first state', false);
    const s2: AsyncState = stateMachine.createState('my second state', true);

    s1.addTransition('next', s2);

    await stateMachine.start();
    await stateMachine.trigger('next');

    expect(stateMachine.isComplete).toEqual(true);
  });

  it('should provide context to all actions', async () => {
    interface ITestContext {
      testEntry: string;
      testExit: string;
    }
    const context: ITestContext = {
      testEntry: 'test123',
      testExit: 'test456'
    };

    const entryAction: TEntryActionFn<ITestContext> = async (state, ctx): Promise<void> => {
      await _timeout();
      expect(ctx).toBeDefined();
      expect(ctx?.testEntry).toEqual('test123');
    };

    const exitAction: TExitActionFn<ITestContext> = async (state, ctx): Promise<boolean> => {
      await _timeout();
      expect(ctx).toBeDefined();
      expect(ctx?.testExit).toEqual('test456');
      return true;
    };

    const stateMachine: AsyncStateMachine<ITestContext> = new AsyncStateMachine<ITestContext>(
      'my first state machine',
      context
    );
    const s1: AsyncState<ITestContext> = stateMachine.createState(
      'my first state',
      false,
      entryAction,
      exitAction
    );
    const s2: AsyncState<ITestContext> = stateMachine.createState('my second state', true);

    s1.addTransition('next', s2);

    await stateMachine.start();
    await stateMachine.trigger('next');
  });

  it('should get a state by its id', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', true);
    const s3: AsyncState = stateMachine.createState('my third state', true);
    stateMachine.createState('my fourth state', true);

    expect(stateMachine.getStateById(s3.id)).toEqual(s3);
  });

  it('should reject if the state machine is already in the requested state', async () => {
    const entryAction = async (state: AsyncState): Promise<void> => {
      await _timeout();
      await state.trigger('next');
    };

    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const s1: AsyncState = stateMachine.createState('my first state', false);
    s1.entryAction = entryAction;
    s1.addTransition('next', s1);

    await expect(stateMachine.start()).rejects.toThrow(
      'State Machine (my first state machine) - Already in state: currentState: my first state.'
    );
  });

  it('should reject when trying to transition from a state that is not the current state', async () => {
    const noOp = async (): Promise<void> => {
      // noop
    };

    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const s1: AsyncState = stateMachine.createState('my first state', false, noOp);
    const s2: AsyncState = stateMachine.createState('my second state', false, noOp);
    const s3: AsyncState = stateMachine.createState('my third state', false, noOp);

    s1.addTransition('next', s2);
    s2.addTransition('other', s3);

    await stateMachine.start(s1);
    await expect(s3.trigger('other')).rejects.toThrow(
      'State Machine (my first state machine) - Invalid Transition - triggerId: my-first-state:other.'
    );
  });

  it('should go to the previous state', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const s1: AsyncState = stateMachine.createState('my first state', false);
    const s2: AsyncState = stateMachine.createState('my second state', false);

    s1.addTransition('next', s2);

    await stateMachine.start();
    await stateMachine.trigger('next');

    expect(stateMachine.currentState).toEqual(s2);
    expect(stateMachine.previousState).toEqual(s1);

    await stateMachine.gotoPrevious();

    expect(stateMachine.currentState).toEqual(s1);
    expect(stateMachine.previousState).toEqual(s2);
  });

  it('should not error if you attempt to go to a previous state that does not exist', async () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    stateMachine.createState('my first state', false);

    await stateMachine.start();
    await expect(stateMachine.gotoPrevious()).resolves.toBeUndefined();
  });

  it('should reject on an invalid transition', async () => {
    const entryAction = async (state: AsyncState): Promise<void> => {
      await state.trigger('next');
    };

    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const s1: AsyncState = stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', false);

    s1.entryAction = entryAction;

    await expect(stateMachine.start()).rejects.toThrow(
      'State Machine (my first state machine) - Invalid Transition - triggerId: my-first-state:next.'
    );
  });

  it('should reject when transitioning while not started', async () => {
    const entryAction = async (state: AsyncState): Promise<void> => {
      await state.trigger('next');
    };

    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    const s1: AsyncState = stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', false);

    s1.entryAction = entryAction;

    await expect(s1.trigger('next', false)).rejects.toThrow(
      'State Machine (my first state machine) - Not started. Call start() before trigger().'
    );
  });

  it('should not be complete if the state machine has not started', () => {
    const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
    expect(stateMachine.isComplete).toEqual(false);
  });

  it('should run a simple state machine', async () => {
    await new Promise<void>((resolve, reject) => {
      let entryCount = 0;
      let exitCount = 0;

      const entryAction = async (state: AsyncState): Promise<void> => {
        try {
          entryCount++;
          expect(state).toBeInstanceOf(AsyncState);
          await state.trigger('next');
        } catch (err) {
          reject(err as Error);
        }
      };

      const exitAction = async (state: AsyncState): Promise<boolean> => {
        try {
          await _timeout();
          exitCount++;
          expect(state).toBeInstanceOf(AsyncState);
          return true;
        } catch (err) {
          reject(err as Error);
          return false;
        }
      };

      const decideAction = async (state: AsyncState): Promise<void> => {
        try {
          entryCount++;
          expect(state).toBeInstanceOf(AsyncState);
          const index = Math.floor(Math.random() * 2);
          if (index === 0) {
            await state.trigger('gotoThree');
          } else {
            await state.trigger('gotoThree'); // same outcome, could branch if needed
          }
        } catch (err) {
          reject(err as Error);
        }
      };

      const finalAction = async (state: AsyncState): Promise<void> => {
        try {
          await _timeout();
          entryCount++;
          expect(entryCount).toEqual(4);
          expect(exitCount).toEqual(3);
          expect(state).toBeInstanceOf(AsyncState);
          resolve();
        } catch (err) {
          reject(err as Error);
        }
      };

      const stateMachine: AsyncStateMachine = new AsyncStateMachine('my first state machine');
      const s1: AsyncState = stateMachine.createState('my first state', false);
      const s2: AsyncState = stateMachine.createState('my second state', false);
      const s3: AsyncState = stateMachine.createState('my third state', false);
      const s4: AsyncState = stateMachine.createState('my fourth state', false);
      const s5: AsyncState = stateMachine.createState('my final state', true);

      s1.entryAction = entryAction;
      s1.exitAction = exitAction;
      s2.entryAction = decideAction;
      s2.exitAction = exitAction;
      s3.entryAction = entryAction;
      s3.exitAction = exitAction;
      s4.entryAction = entryAction;
      s4.exitAction = exitAction;
      s5.entryAction = finalAction;

      s1.addTransition('next', s2);
      s2.addTransition('gotoThree', s3);
      s2.addTransition('gotoFour', s4);
      s3.addTransition('next', s5);
      s4.addTransition('next', s5);

      stateMachine.start(s1).catch(reject);
    });
  });

  it('should call state machine callbacks during transitions', async () => {
    let entryCount = 0;
    let exitCount = 0;
    const STATE1_NAME = 'state1';
    const STATE2_NAME = 'state2';

    const onEntry: TEntryActionFn = async (): Promise<void> => {
      entryCount += 1;
    };
    const onExit: TExitActionFn = async (): Promise<boolean> => {
      exitCount += 1;
      return true;
    };

    const stateMachine: AsyncStateMachine = new AsyncStateMachine(
      'my first state machine',
      undefined,
      onEntry,
      onExit
    );
    const s1: AsyncState = stateMachine.createState(STATE1_NAME, false);
    const s2: AsyncState = stateMachine.createState(STATE2_NAME, false);

    s1.addTransition('goTwo', s2);

    await stateMachine.start(s1);
    await stateMachine.trigger('goTwo');

    expect(entryCount).toEqual(2);
    expect(exitCount).toEqual(1);
  });
});
