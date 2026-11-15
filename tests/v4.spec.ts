/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it } from 'vitest';

import * as fsm from '../src/index';
import { AsyncState, AsyncStateMachine, State, StateMachine } from '../src/index';

function _tick(ms = 5): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('sync machine: run-to-completion queue', () => {
  it('finishes the current transition before running a trigger raised in an entry action', () => {
    const seen: string[] = [];
    const machine = new StateMachine('m', undefined, (state: State) => {
      // Machine-level entry must see the state just entered, never a stale one.
      seen.push(`machine entry ${state.id}, current ${machine.currentState!.id}`);
    });
    const a = machine.createState('a', false, (state: State) => {
      state.trigger('next');
      seen.push(`after trigger, current ${machine.currentState!.id}`);
    });
    const b = machine.createState('b', true);
    a.addTransition('next', b);

    machine.start(a);

    expect(seen).toEqual([
      'after trigger, current a',
      'machine entry a, current a',
      'machine entry b, current b'
    ]);
    expect(machine.currentState).toBe(b);
    expect(machine.previousState).toBe(a);
    expect(machine.busy).toBe(false);
  });

  it('handles a trigger raised from an exit action consistently', () => {
    const machine = new StateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    const c = machine.createState('c');
    a.addTransition('go', b);
    b.addTransition('next', c);
    a.exitAction = (state: State): boolean => {
      state.trigger('next'); // queued; resolved against b once a -> b completes
      return true;
    };

    machine.start(a);
    machine.trigger('go');

    expect(machine.currentState).toBe(c);
    expect(machine.previousState).toBe(b);
  });

  it('runs a long chain of entry-action triggers without growing the call stack', () => {
    const machine = new StateMachine('m');
    const count = 50000;
    const states: State[] = [];
    for (let i = 0; i < count; i++) {
      states.push(machine.createState(`s${i}`, i === count - 1));
    }
    for (let i = 0; i < count - 1; i++) {
      states[i].addTransition('next', states[i + 1]);
      states[i].entryAction = (state: State): void => {
        state.trigger('next');
      };
    }
    machine.start(states[0]);
    expect(machine.currentState).toBe(states[count - 1]);
  });

  it('queues gotoPrevious and reset called from inside an action', () => {
    const machine = new StateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    a.addTransition('next', b);
    let bounced = false;
    b.entryAction = (): void => {
      if (!bounced) {
        bounced = true;
        machine.gotoPrevious();
      }
    };
    machine.start(a);
    machine.trigger('next');
    expect(machine.currentState).toBe(a);
    expect(machine.previousState).toBe(b);

    // reset(true) from the final state's entry restarts cleanly once the transition completes.
    const loop = new StateMachine('loop');
    const start = loop.createState('start');
    const end = loop.createState('end', true);
    start.addTransition('finish', end);
    let restarts = 0;
    end.entryAction = (): void => {
      if (restarts++ === 0) {
        loop.reset(true);
      }
    };
    loop.start(start);
    loop.trigger('finish');
    expect(loop.currentState).toBe(start);
    expect(loop.previousState).toBeUndefined();
  });

  it('rejects a queued trigger when an earlier queued trigger completed the machine', () => {
    const machine = new StateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    const done = machine.createState('done', true);
    a.addTransition('go', b);
    b.addTransition('finish', done);
    b.addTransition('again', a);
    b.entryAction = (state: State): void => {
      state.trigger('finish');
      state.trigger('again');
    };
    machine.start(a);
    expect(() => {
      machine.trigger('go');
    }).toThrow('Cannot trigger if the machine has completed.');
    expect(machine.currentState).toBe(done);
    expect(machine.busy).toBe(false);
  });

  it('recovers after an action throws: not busy, queue cleared', () => {
    const machine = new StateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    const c = machine.createState('c');
    a.addTransition('go', b);
    b.addTransition('go', c);
    let fail = true;
    b.entryAction = (state: State): void => {
      state.trigger('go');
      if (fail) {
        throw new Error('boom');
      }
    };
    machine.start(a);
    expect(() => {
      machine.trigger('go');
    }).toThrow('boom');
    expect(machine.currentState).toBe(b);
    expect(machine.busy).toBe(false);

    // The trigger queued before the throw was dropped, and the machine still works.
    fail = false;
    machine.trigger('go');
    expect(machine.currentState).toBe(c);
  });
});

describe('async machine: busy flag covers start() and gotoPrevious()', () => {
  it('rejects an external machine.trigger() while start() is still running', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    a.addTransition('go', b);
    a.entryAction = async (): Promise<void> => {
      await _tick();
    };

    const started = machine.start(a);
    await expect(machine.trigger('go')).rejects.toThrow('State Machine is busy.');
    await started;
    expect(machine.currentState).toBe(a);
  });

  it('rejects an external gotoPrevious() while a transition is running', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    a.addTransition('go', b);
    b.entryAction = async (): Promise<void> => {
      await _tick();
    };
    await machine.start(a);

    const running = machine.trigger('go');
    await expect(machine.gotoPrevious()).rejects.toThrow('State Machine is busy.');
    await running;
    expect(machine.currentState).toBe(b);
    expect(machine.previousState).toBe(a);
  });

  it('queues state.trigger() from inside an action, even during start()', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b', true);
    a.addTransition('go', b);
    const seen: string[] = [];
    a.entryAction = async (state: AsyncState): Promise<void> => {
      await state.trigger('go');
      seen.push(`after trigger: ${machine.currentState!.id}`);
    };
    await machine.start(a);
    expect(seen).toEqual(['after trigger: a']);
    expect(machine.currentState).toBe(b);
  });

  it('does not lose a trigger that an action fires without awaiting', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b', true);
    a.addTransition('go', b);
    a.entryAction = async (state: AsyncState): Promise<void> => {
      void state.triggerInternal('go');
    };
    await machine.start(a);
    expect(machine.currentState).toBe(b);
  });

  it('rejects a queued trigger when an earlier queued trigger completed the machine', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const done = machine.createState('done', true);
    a.addTransition('finish', done);
    a.addTransition('other', done);
    a.entryAction = async (state: AsyncState): Promise<void> => {
      await state.triggerInternal('finish');
      await state.triggerInternal('other');
    };
    await expect(machine.start(a)).rejects.toThrow('Cannot trigger if the machine has completed.');
    expect(machine.currentState).toBe(done);
    expect(machine.busy).toBe(false);
  });

  it('recovers after an entry or exit action rejects', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    a.addTransition('go', b);
    b.addTransition('back', a);
    let failExit = true;
    b.exitAction = async (): Promise<boolean> => {
      if (failExit) {
        throw new Error('exit failed');
      }
      return true;
    };
    b.entryAction = async (): Promise<void> => {
      if (machine.previousState === a && failExit) {
        throw new Error('entry failed');
      }
    };
    await machine.start(a);
    await expect(machine.trigger('go')).rejects.toThrow('entry failed');
    expect(machine.currentState).toBe(b);
    expect(machine.busy).toBe(false);

    await expect(machine.trigger('back')).rejects.toThrow('exit failed');
    expect(machine.currentState).toBe(b);
    expect(machine.busy).toBe(false);

    failExit = false;
    await machine.trigger('back');
    expect(machine.currentState).toBe(a);
  });

  it('can be reset and restarted after use', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b', true);
    a.addTransition('go', b);
    await machine.start(a);
    await machine.trigger('go');
    await machine.reset(true);
    expect(machine.currentState).toBe(a);
    await machine.trigger('go');
    expect(machine.currentState).toBe(b);
  });
});

describe('async machine: the internal trigger path is private', () => {
  it('does not export the internal key from the package', () => {
    expect(Object.keys(fsm)).not.toContain('TRIGGER_INTERNAL');
    for (const value of Object.values(fsm)) {
      expect(typeof value).not.toBe('symbol');
    }
  });

  it('ignores an extra third argument to machine.trigger() (the 3.x internal flag)', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    a.addTransition('go', b);
    b.entryAction = async (): Promise<void> => {
      await _tick();
    };
    await machine.start(a);
    const running = machine.trigger('go');
    const legacy = machine as unknown as {
      trigger(id: string, global: boolean, internal: boolean): Promise<void>;
    };
    await expect(legacy.trigger('go', false, true)).rejects.toThrow('State Machine is busy.');
    await running;
  });
});

describe('transitions are frozen once a machine starts', () => {
  it('rejects state.addTransition() after start (sync)', () => {
    const machine = new StateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    machine.start(a);
    expect(() => {
      a.addTransition('go', b);
    }).toThrow('Cannot add a transition once the machine has started.');
  });

  it('rejects state.addTransition() after start, and allows it again after reset (async)', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    await machine.start(a);
    expect(() => {
      a.addTransition('go', b);
    }).toThrow('Cannot add a transition once the machine has started.');

    await machine.reset();
    a.addTransition('go', b);
    await machine.start(a);
    await machine.trigger('go');
    expect(machine.currentState).toBe(b);
  });
});
