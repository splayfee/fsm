/* eslint-disable @typescript-eslint/require-await */
/** Keeps the README examples honest: these mirror the code shown there. */
import { describe, expect, it } from 'vitest';

import { AsyncState, AsyncStateMachine, State, StateMachine } from '../src/index';

interface IContext {
  randomize: () => number;
}

describe('README examples', () => {
  it.each([0, 1])('runs the synchronous example (branch %i)', (branch: number) => {
    const entryAction = (state: State<IContext>): void => {
      state.trigger('next');
    };
    const exitAction = (): boolean => {
      return true;
    };
    const decideAction = (state: State<IContext>, context?: IContext): void => {
      const index = context!.randomize();
      if (index === 0) {
        state.trigger('gotoThree');
      } else if (index === 1) {
        state.trigger('gotoFour');
      }
    };
    const finalAction = (): void => {
      // done
    };
    const context: IContext = {
      randomize: (): number => {
        return branch;
      }
    };

    const stateMachine = new StateMachine<IContext>('My first state machine', context);
    const s1 = stateMachine.createState('My first state', false, entryAction);
    const s2 = stateMachine.createState('My second state', false, decideAction, exitAction);
    const s3 = stateMachine.createState('My third state', false, entryAction);
    const s4 = stateMachine.createState('My fourth state', false, entryAction);
    const s5 = stateMachine.createState('My fifth and final state', true, finalAction);
    s1.addTransition('next', s2);
    s2.addTransition('gotoThree', s3);
    s2.addTransition('gotoFour', s4);
    s3.addTransition('next', s5);
    s4.addTransition('next', s5);

    stateMachine.start(s1);

    expect(stateMachine.currentState).toBe(s5);
    expect(stateMachine.previousState).toBe(branch === 0 ? s3 : s4);
    expect(stateMachine.validate().valid).toBe(true);
  });

  it.each([0, 1])('runs the asynchronous example (branch %i)', async (branch: number) => {
    const entryAction = async (state: AsyncState<IContext>): Promise<void> => {
      await state.triggerInternal('next');
    };
    const exitAction = async (): Promise<boolean> => {
      return true;
    };
    const decideAction = async (state: AsyncState<IContext>, context?: IContext): Promise<void> => {
      const index = context!.randomize();
      if (index === 0) {
        await state.triggerInternal('gotoThree');
      } else if (index === 1) {
        await state.triggerInternal('gotoFour');
      }
    };
    const finalAction = async (): Promise<void> => {
      // done
    };
    const context: IContext = {
      randomize: (): number => {
        return branch;
      }
    };

    const machine = new AsyncStateMachine<IContext>('My first async state machine', context);
    const s1 = machine.createState('My first state', false, entryAction);
    const s2 = machine.createState('My second state', false, decideAction, exitAction);
    const s3 = machine.createState('My third state', false, entryAction);
    const s4 = machine.createState('My fourth state', false, entryAction);
    const s5 = machine.createState('My fifth and final state', true, finalAction);
    s1.addTransition('next', s2);
    s2.addTransition('gotoThree', s3);
    s2.addTransition('gotoFour', s4);
    s3.addTransition('next', s5);
    s4.addTransition('next', s5);

    await machine.start(s1);

    expect(machine.currentState).toBe(s5);
    expect(machine.previousState).toBe(branch === 0 ? s3 : s4);
  });

  it('runs the global transition pattern', () => {
    const machine = new StateMachine('m');
    const startState = machine.createState('start');
    const other = machine.createState('other');
    startState.addTransition('next', other);
    machine.addGlobalTransition('reset', startState);
    machine.start(startState);
    machine.trigger('next');
    machine.trigger('reset', true);
    expect(machine.currentState).toBe(startState);
  });

  it('rejects the removed 3.x internal overload at compile time', async () => {
    const machine = new AsyncStateMachine('m');
    machine.createState('a');
    await machine.start();
    // @ts-expect-error -- the third "internal" argument was removed in 4.0.
    await expect(machine.trigger('missing', false, true)).rejects.toThrow('Invalid Transition');
  });
});
