/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it } from 'vitest';

import {
  AsyncState,
  AsyncStateMachine,
  IAsyncTransitionEvent,
  ITransitionEvent,
  State,
  StateMachine
} from '../src/index';

describe('exit actions are combined (sync)', () => {
  it('blocks when the state exit action blocks but the machine exit action allows', () => {
    const machine = new StateMachine('m', undefined, undefined, () => {
      return true;
    });
    const s1 = machine.createState('one', false, undefined, () => {
      return false;
    });
    const s2 = machine.createState('two');
    s1.addTransition('next', s2);
    machine.start(s1);
    machine.trigger('next');
    expect(machine.currentState).toBe(s1);
  });

  it('blocks when the machine exit action blocks but the state exit action allows', () => {
    const machine = new StateMachine('m', undefined, undefined, () => {
      return false;
    });
    const s1 = machine.createState('one', false, undefined, () => {
      return true;
    });
    const s2 = machine.createState('two');
    s1.addTransition('next', s2);
    machine.start(s1);
    machine.trigger('next');
    expect(machine.currentState).toBe(s1);
  });

  it('still runs both exit actions when the first one blocks', () => {
    let machineExitCalls = 0;
    const machine = new StateMachine('m', undefined, undefined, () => {
      machineExitCalls++;
      return true;
    });
    const s1 = machine.createState('one', false, undefined, () => {
      return false;
    });
    s1.addTransition('next', machine.createState('two'));
    machine.start(s1);
    machine.trigger('next');
    expect(machineExitCalls).toBe(1);
  });
});

describe('exit actions are combined (async)', () => {
  it('blocks when the state exit action blocks but the machine exit action allows', async () => {
    const machine = new AsyncStateMachine('m', undefined, undefined, async () => {
      return true;
    });
    const s1 = machine.createState('one', false, undefined, async () => {
      return false;
    });
    const s2 = machine.createState('two');
    s1.addTransition('next', s2);
    await machine.start(s1);
    await machine.trigger('next');
    expect(machine.currentState).toBe(s1);
  });

  it('allows when both exit actions allow', async () => {
    const machine = new AsyncStateMachine('m', undefined, undefined, async () => {
      return true;
    });
    const s1 = machine.createState('one', false, undefined, async () => {
      return true;
    });
    const s2 = machine.createState('two');
    s1.addTransition('next', s2);
    await machine.start(s1);
    await machine.trigger('next');
    expect(machine.currentState).toBe(s2);
  });
});

describe('cross-machine transitions are rejected', () => {
  it('rejects a local transition to another sync machine', () => {
    const a = new StateMachine('machine a');
    const b = new StateMachine('machine b');
    const s1 = a.createState('one');
    const foreign = b.createState('foreign');
    expect(() => {
      s1.addTransition('next', foreign);
    }).toThrow(
      'State Machine (machine a) - Target state (foreign) belongs to a different state machine (machine b).'
    );
  });

  it('rejects a global transition to another sync machine', () => {
    const a = new StateMachine('machine a');
    const b = new StateMachine('machine b');
    a.createState('one');
    expect(() => {
      a.addGlobalTransition('go', b.createState('foreign'));
    }).toThrow('belongs to a different state machine (machine b)');
  });

  it('rejects a local transition to another async machine', () => {
    const a = new AsyncStateMachine('machine a');
    const b = new AsyncStateMachine('machine b');
    const s1 = a.createState('one');
    expect(() => {
      s1.addTransition('next', b.createState('foreign'));
    }).toThrow('belongs to a different state machine (machine b)');
  });

  it('rejects a global transition to another async machine', () => {
    const a = new AsyncStateMachine('machine a');
    const b = new AsyncStateMachine('machine b');
    a.createState('one');
    expect(() => {
      a.addGlobalTransition('go', b.createState('foreign'));
    }).toThrow('belongs to a different state machine (machine b)');
  });
});

describe('async trigger queue', () => {
  it('settles the outer promise only after internally queued transitions have run', async () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    const s3 = machine.createState('three', true);
    const order: string[] = [];
    s1.addTransition('next', s2);
    s2.addTransition('next', s3);
    s2.entryAction = async (state: AsyncState): Promise<void> => {
      // Queued while busy: runs after this action returns, so we are still in s2 here.
      await state.triggerInternal('next');
      order.push(`after triggerInternal: ${machine.currentState!.id}`);
    };
    s3.entryAction = async (): Promise<void> => {
      order.push('entered three');
    };

    await machine.start(s1);
    await machine.trigger('next');

    expect(order).toEqual(['after triggerInternal: two', 'entered three']);
    expect(machine.currentState).toBe(s3);
  });

  it('resolves a trigger queued from an exit action against the state being entered', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    const c = machine.createState('c');
    a.addTransition('go', b);
    b.addTransition('next', c);
    a.exitAction = async (state: AsyncState): Promise<boolean> => {
      await state.triggerInternal('next');
      return true;
    };

    await machine.start(a);
    await machine.trigger('go');
    expect(machine.currentState).toBe(c);
    expect(machine.previousState).toBe(b);
  });

  it('resolves each queued trigger against the state current when it runs', async () => {
    const machine = new AsyncStateMachine('m');
    const a = machine.createState('a');
    const b = machine.createState('b');
    const c = machine.createState('c');
    const d = machine.createState('d', true);
    a.addTransition('go', b);
    b.addTransition('step', c);
    c.addTransition('step', d);
    b.entryAction = async (state: AsyncState): Promise<void> => {
      await state.triggerInternal('step'); // b -> c
      await state.triggerInternal('step'); // c -> d
    };

    await machine.start(a);
    await machine.trigger('go');
    expect(machine.currentState).toBe(d);
  });

  it('rejects the outer promise and clears the queue when a queued trigger fails', async () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    const s3 = machine.createState('three');
    s1.addTransition('next', s2);
    s2.addTransition('next', s3);
    s3.addTransition('back', s2);
    s2.entryAction = async (state: AsyncState): Promise<void> => {
      if (machine.previousState === s1) {
        await state.triggerInternal('missing');
        await state.triggerInternal('next');
      }
    };

    await machine.start(s1);
    await expect(machine.trigger('next')).rejects.toThrow('Invalid Transition');
    expect(machine.currentState).toBe(s2);
    expect(machine.busy).toBe(false);

    // The stale queued 'next' must not fire on a later trigger.
    await machine.trigger('next');
    expect(machine.currentState).toBe(s3);
  });
});

describe('onTransition (sync)', () => {
  it('reports every transition in order with from, to and trigger', () => {
    const machine = new StateMachine('m');
    const s1 = machine.createState('one', false, (state: State) => {
      state.trigger('next');
    });
    const s2 = machine.createState('two');
    const s3 = machine.createState('three', true);
    s1.addTransition('next', s2);
    machine.addGlobalTransition('finish', s3);

    const events: ITransitionEvent[] = [];
    machine.onTransition((event: ITransitionEvent) => {
      events.push(event);
    });

    machine.start(s1);
    machine.trigger('finish', true);

    expect(events).toEqual([
      { from: undefined, to: s1, trigger: undefined },
      { from: s1, to: s2, trigger: 'next' },
      { from: s2, to: s3, trigger: 'finish' }
    ]);
  });

  it('does not fire for blocked transitions and stops after unsubscribing', () => {
    let blocked = true;
    const machine = new StateMachine('m');
    const s1 = machine.createState('one', false, undefined, () => {
      return !blocked;
    });
    const s2 = machine.createState('two');
    s1.addTransition('next', s2);
    s2.addTransition('back', s1);
    machine.start(s1);

    let count = 0;
    const unsubscribe = machine.onTransition(() => {
      count++;
    });
    machine.trigger('next');
    expect(count).toBe(0);

    blocked = false;
    machine.trigger('next');
    expect(count).toBe(1);

    unsubscribe();
    machine.trigger('back');
    expect(count).toBe(1);
  });

  it('supports offTransition and gotoPrevious', () => {
    const machine = new StateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    s1.addTransition('next', s2);
    machine.start(s1);
    machine.trigger('next');

    const events: ITransitionEvent[] = [];
    const listener = (event: ITransitionEvent): void => {
      events.push(event);
    };
    machine.onTransition(listener);
    machine.gotoPrevious();
    machine.offTransition(listener);
    expect(events).toEqual([{ from: s2, to: s1, trigger: undefined }]);
  });
});

describe('onTransition (async)', () => {
  it('reports internally queued transitions in order', async () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    const s3 = machine.createState('three', true);
    s1.addTransition('next', s2);
    s2.addTransition('done', s3);
    s2.entryAction = async (state: AsyncState): Promise<void> => {
      await state.triggerInternal('done');
    };

    const events: IAsyncTransitionEvent[] = [];
    const unsubscribe = machine.onTransition((event: IAsyncTransitionEvent) => {
      events.push(event);
    });

    await machine.start(s1);
    await machine.trigger('next');
    unsubscribe();

    expect(events).toEqual([
      { from: undefined, to: s1, trigger: undefined },
      { from: s1, to: s2, trigger: 'next' },
      { from: s2, to: s3, trigger: 'done' }
    ]);
  });

  it('supports offTransition', async () => {
    const machine = new AsyncStateMachine('m');
    machine.createState('one');
    let count = 0;
    const listener = (): void => {
      count++;
    };
    machine.onTransition(listener);
    machine.offTransition(listener);
    await machine.start();
    expect(count).toBe(0);
  });
});

describe('introspection', () => {
  it('exposes local and global transitions (sync)', () => {
    const machine = new StateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    s1.addTransition('goTwo', s2);
    machine.addGlobalTransition('Reset All', s1);

    expect([...s1.transitions.keys()]).toEqual(['one:go-two']);
    expect(s1.transitions.get('one:go-two')!.targetState).toBe(s2);
    expect([...machine.globalTransitions.keys()]).toEqual(['reset-all']);
    expect(s1.stateMachine).toBe(machine);
  });

  it('exposes local and global transitions (async)', () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    s1.addTransition('goTwo', s2);
    machine.addGlobalTransition('reset', s1);

    expect([...s1.transitions.keys()]).toEqual(['one:go-two']);
    expect([...machine.globalTransitions.keys()]).toEqual(['reset']);
    expect(s1.stateMachine).toBe(machine);
  });

  it('canTrigger mirrors trigger without throwing (sync)', () => {
    const machine = new StateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two');
    const s3 = machine.createState('three', true);
    s1.addTransition('next', s2);
    machine.addGlobalTransition('finish', s3);
    machine.addGlobalTransition('restart', s1);

    expect(machine.canTrigger('next')).toBe(false); // not started

    machine.start(s1);
    expect(machine.canTrigger('next')).toBe(true);
    expect(machine.canTrigger('NEXT')).toBe(true);
    expect(machine.canTrigger('missing')).toBe(false);
    expect(machine.canTrigger('finish', true)).toBe(true);
    expect(machine.canTrigger('finish')).toBe(false); // globals need sendGlobal
    expect(machine.canTrigger('restart', true)).toBe(false); // already in s1

    machine.trigger('finish', true);
    expect(machine.canTrigger('restart', true)).toBe(false); // complete
  });

  it('canTrigger mirrors trigger without throwing (async)', async () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two', true);
    s1.addTransition('next', s2);

    expect(machine.canTrigger('next')).toBe(false);
    await machine.start(s1);
    expect(machine.canTrigger('next')).toBe(true);
    expect(machine.canTrigger('other')).toBe(false);
    await machine.trigger('next');
    expect(machine.canTrigger('next')).toBe(false);
  });
});

describe('validate', () => {
  it('reports a well-formed machine as valid', () => {
    const machine = new StateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two', true);
    s1.addTransition('next', s2);
    expect(machine.validate()).toEqual({
      valid: true,
      unreachable: [],
      deadEnds: [],
      unregisteredTargets: []
    });
  });

  it('finds unreachable states, dead ends and unregistered targets', () => {
    const machine = new StateMachine('m');
    const s1 = machine.createState('start');
    const stuck = machine.createState('stuck');
    machine.createState('orphan', true);
    const unregistered = new State(machine, 'ghost');
    s1.addTransition('next', stuck);
    s1.addTransition('haunt', unregistered);

    expect(machine.validate()).toEqual({
      valid: false,
      unreachable: ['orphan'],
      deadEnds: ['stuck'],
      unregisteredTargets: ['ghost']
    });
  });

  it('treats global transitions as reachable from every state', () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('start');
    const s2 = machine.createState('middle');
    machine.createState('end', true);
    s1.addTransition('next', s2);
    machine.addGlobalTransition('finish', machine.getStateById('end')!);
    expect(machine.validate().valid).toBe(true);
  });

  it('analyzes from an explicit start state or the started state', async () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    const s2 = machine.createState('two', true);
    s1.addTransition('next', s2);
    expect(machine.validate(s2).unreachable).toEqual(['one']);

    await machine.start(s2);
    expect(machine.validate().unreachable).toEqual(['one']);
  });

  it('handles a machine with no states', () => {
    expect(new StateMachine('empty').validate()).toEqual({
      valid: true,
      unreachable: [],
      deadEnds: [],
      unregisteredTargets: []
    });
  });
});

describe('diagram export', () => {
  function _build(): StateMachine {
    const machine = new StateMachine('Order "flow"');
    const s1 = machine.createState('Pending');
    const s2 = machine.createState('Paid');
    const s3 = machine.createState('Shipped "fast"', true);
    s1.addTransition('pay', s2);
    s2.addTransition('ship', s3);
    machine.addGlobalTransition('cancel', s1);
    return machine;
  }

  it('renders Mermaid', () => {
    expect(_build().toMermaid()).toBe(
      [
        'stateDiagram-v2',
        '  state "Pending" as s0',
        '  state "Paid" as s1',
        '  state "Shipped #quot;fast#quot;" as s2',
        '  [*] --> s0',
        '  s0 --> s1 : pay',
        '  s1 --> s2 : ship',
        '  s1 --> s0 : cancel (global)',
        '  s2 --> [*]'
      ].join('\n')
    );
  });

  it('renders DOT', () => {
    expect(_build().toDot()).toBe(
      [
        'digraph "Order \\"flow\\"" {',
        '  rankdir=LR;',
        '  s0 [label="Pending", shape=ellipse];',
        '  s1 [label="Paid", shape=ellipse];',
        '  s2 [label="Shipped \\"fast\\"", shape=doublecircle];',
        '  start [shape=point];',
        '  start -> s0;',
        '  s0 -> s1 [label="pay"];',
        '  s1 -> s2 [label="ship"];',
        '  s1 -> s0 [label="cancel", style=dashed];',
        '}'
      ].join('\n')
    );
  });

  it('includes unregistered target states and works for async machines', () => {
    const machine = new AsyncStateMachine('m');
    const s1 = machine.createState('one');
    s1.addTransition('next', new AsyncState(machine, 'ghost'));
    expect(machine.toMermaid()).toContain('state "ghost" as s1');
    expect(machine.toMermaid(s1)).toContain('[*] --> s0');
    expect(machine.toDot()).toContain('s0 -> s1 [label="next"];');
  });

  it('renders an empty machine', () => {
    expect(new StateMachine('empty').toMermaid()).toBe('stateDiagram-v2');
    expect(new StateMachine('empty').toDot()).toBe('digraph "empty" {\n  rankdir=LR;\n}');
  });
});
