/* eslint-disable @typescript-eslint/require-await */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AsyncState,
  AsyncStateMachine,
  IStateMachineSnapshot,
  State,
  StateMachine,
  StateMachineError
} from '../src/index';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('1. typed states and triggers', () => {
  type S = 'idle' | 'choosing-tile' | 'done';
  type T = 'pick' | 'back' | 'finish';
  interface ICtx {
    picks: number;
  }

  it('accepts the declared ids and rejects others at compile time', () => {
    const m = new StateMachine<ICtx, S, T>('composer', { picks: 0 });
    const idle = m.createState('idle');
    const choosing = m.createState('choosing-tile', {
      entryAction: (state, ctx): void => {
        ctx.picks += 1;
        const id: S = state.id;
        expect(id).toBe('choosing-tile');
      }
    });
    const done = m.createState('Done!', { id: 'done', isComplete: true });
    idle.addTransition('pick', choosing);
    choosing.addTransition('back', idle);
    choosing.addTransition('finish', done);

    // Compile-time checks only; never called.
    const typeChecks = (): void => {
      // @ts-expect-error 'pikc' is not a declared trigger
      idle.addTransition('pikc', choosing);
      // @ts-expect-error 'nope' is not a declared state id
      m.createState('nope');
      // @ts-expect-error 'nope' is not a declared state id
      m.getStateById('nope');
      // @ts-expect-error 'nope' is not a declared state id
      m.restore({ stateId: 'nope' });
    };
    void typeChecks;

    m.start(idle);
    expect(() => {
      // @ts-expect-error 'pikc' is not a declared trigger
      return m.trigger('pikc');
    }).toThrow(StateMachineError);
    m.trigger('pick');
    m.trigger('finish');
    expect(m.currentState).toBe(done);
    expect(m.getStateById('done')).toBe(done);
    const ids: S[] = [...m.states.keys()];
    expect(ids).toEqual(['idle', 'choosing-tile', 'done']);
  });

  it('types the async machine the same way', async () => {
    const m = new AsyncStateMachine<undefined, S, T>('composer');
    const idle = m.createState('idle', {
      entryAction: async (state): Promise<void> => {
        await state.triggerInternal('pick');
        // @ts-expect-error 'pikc' is not a declared trigger
        void state.triggerInternal.bind(state, 'pikc');
      }
    });
    const choosing = m.createState('choosing-tile', true);
    idle.addTransition('pick', choosing);
    await m.start();
    expect(m.currentState?.id).toBe('choosing-tile');
  });

  it('leaves untyped machines accepting any string', () => {
    const m = new StateMachine('loose');
    const a = m.createState('anything at all');
    a.addTransition('whatever', m.createState('b', true));
    m.start();
    m.trigger('whatever');
    expect(m.isComplete).toBe(true);
  });
});

describe('2a. explicit state ids', () => {
  it('uses the id as-is and keeps the name for display', () => {
    const m = new StateMachine('m', undefined, undefined, undefined, { warnOnIdChange: false });
    const s = m.createState('choosing tile', { id: 'choosingTile' });
    expect(s.id).toBe('choosingTile');
    expect(s.name).toBe('choosing tile');
    expect(m.getStateById('choosingTile')).toBe(s);
    expect(m.states.get('choosingTile')).toBe(s);
  });

  it('routes local triggers through the explicit id', () => {
    const m = new StateMachine('m');
    const a = m.createState('A', { id: 'stateA' });
    const b = m.createState('B', { id: 'stateB', isComplete: true });
    a.addTransition('go', b);
    expect([...a.transitions.keys()]).toEqual(['stateA:go']);
    m.start();
    m.trigger('go');
    expect(m.currentState).toBe(b);
  });

  it('still finds kebab-derived ids by name', () => {
    const m = new StateMachine('m', undefined, undefined, undefined, { warnOnIdChange: false });
    const s = m.createState('My State');
    expect(m.getStateById('My State')).toBe(s);
    expect(m.getStateById('my-state')).toBe(s);
  });

  it('rejects an empty or non-string id', () => {
    const m = new StateMachine('m');
    expect(() => {
      return m.createState('x', { id: '' });
    }).toThrow('State id must be a non-empty string');
    expect(() => {
      return new State(m, 'x', { id: 5 as unknown as string });
    }).toThrow(StateMachineError);
  });

  it('detects duplicate explicit ids', () => {
    const m = new StateMachine('m');
    m.createState('one', { id: 'same' });
    expect(() => {
      return m.createState('two', { id: 'same' });
    }).toThrow('State exists: same.');
  });

  it('accepts the options form in the State and AsyncState constructors', () => {
    const m = new AsyncStateMachine('m');
    const s = new AsyncState(m, 'Final', { id: 'final', isComplete: true });
    m.addState(s);
    expect(s.isComplete).toBe(true);
    expect(s.id).toBe('final');
  });
});

describe('2b. warning when a derived id differs from the name', () => {
  it('warns once per machine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return undefined;
    });
    const m = new StateMachine('m');
    m.createState('choosing tile');
    m.createState('Other State');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"choosing tile" has id "choosing-tile"');
  });

  it('does not warn when the id equals the name or was given explicitly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return undefined;
    });
    const m = new AsyncStateMachine('m');
    m.createState('already-kebab');
    m.createState('Explicit Name', { id: 'explicit-name' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('can be disabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return undefined;
    });
    new StateMachine('m', undefined, { warnOnIdChange: false }).createState('My State');
    new AsyncStateMachine('m', undefined, { warnOnIdChange: false }).createState('My State');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silent in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return undefined;
    });
    new StateMachine('m').createState('My State');
    new AsyncStateMachine('m').createState('My State');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns for the async machine too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      return undefined;
    });
    new AsyncStateMachine('m').createState('My State');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('3. clearer global transitions', () => {
  function build(globalFallback?: boolean): {
    m: StateMachine;
    idle: State;
    busy: State;
  } {
    const m = new StateMachine<unknown>('m', undefined, { globalFallback });
    const idle = m.createState('idle');
    const busy = m.createState('busy');
    idle.addTransition('work', busy);
    m.addGlobalTransition('done', idle);
    return { m, idle, busy };
  }

  it('accepts { global: true } alongside the boolean', () => {
    const { m, idle } = build();
    m.start();
    m.trigger('work');
    expect(m.canTrigger('done')).toBe(false);
    expect(m.canTrigger('done', { global: true })).toBe(true);
    expect(m.canTrigger('done', true)).toBe(true);
    expect(() => {
      return m.trigger('done');
    }).toThrow('Invalid Transition');
    m.trigger('done', { global: true });
    expect(m.currentState).toBe(idle);
  });

  it('accepts { global: true } from state.trigger()', () => {
    const { m, idle, busy } = build();
    busy.entryAction = (state): void => {
      state.trigger('done', { global: true });
    };
    m.start();
    m.trigger('work');
    expect(m.currentState).toBe(idle);
  });

  it('globalFallback makes a plain trigger fall back to the global transition', () => {
    const { m, idle } = build(true);
    m.start();
    m.trigger('work');
    expect(m.canTrigger('done')).toBe(true);
    m.trigger('done');
    expect(m.currentState).toBe(idle);
  });

  it('globalFallback prefers a local transition with the same id', () => {
    const m = new StateMachine('m', undefined, { globalFallback: true });
    const a = m.createState('a');
    const b = m.createState('b');
    const c = m.createState('c');
    a.addTransition('next', b);
    m.addGlobalTransition('next', c);
    m.start(a);
    m.trigger('next');
    expect(m.currentState).toBe(b);
  });

  it('globalFallback still throws when nothing matches', () => {
    const { m } = build(true);
    m.start();
    expect(() => {
      return m.trigger('missing');
    }).toThrow('Invalid Transition - triggerId: idle:missing.');
    expect(m.canTrigger('missing')).toBe(false);
  });

  it('works on the async machine', async () => {
    const m = new AsyncStateMachine('m', undefined, { globalFallback: true });
    const idle = m.createState('idle');
    const busy = m.createState('busy', {
      entryAction: async (state): Promise<void> => {
        await state.triggerInternal('done');
      }
    });
    idle.addTransition('work', busy);
    m.addGlobalTransition('done', idle);
    await m.start();
    await m.trigger('work');
    expect(m.currentState).toBe(idle);
    expect(m.previousState).toBe(busy);
    expect(m.canTrigger('done', { global: true })).toBe(false); // targets the current state
  });

  it('async machine accepts { global: true } without fallback', async () => {
    const m = new AsyncStateMachine('m');
    const a = m.createState('a');
    const b = m.createState('b', true);
    m.addGlobalTransition('end', b);
    await m.start(a);
    await expect(m.trigger('end')).rejects.toThrow('Invalid Transition');
    await m.trigger('end', { global: true });
    expect(m.currentState).toBe(b);
  });
});

describe('4. opt-in self-transitions', () => {
  it('re-enters the state, running exit then entry, and keeps previousState', () => {
    const log: string[] = [];
    const m = new StateMachine('m');
    const start = m.createState('start');
    const upkeep = m.createState('upkeep', {
      entryAction: (): void => {
        log.push('enter');
      },
      exitAction: (): boolean => {
        log.push('exit');
        return true;
      }
    });
    start.addTransition('go', upkeep);
    upkeep.addTransition('handled', upkeep, { reenter: true });
    const events: string[] = [];
    m.onTransition(({ from, to, trigger }) => {
      events.push(`${from?.id}->${to.id}:${trigger}`);
    });

    m.start(start);
    m.trigger('go');
    expect(m.canTrigger('handled')).toBe(true);
    m.trigger('handled');

    expect(log).toEqual(['enter', 'exit', 'enter']);
    expect(events).toEqual([
      'undefined->start:undefined',
      'start->upkeep:go',
      'upkeep->upkeep:handled'
    ]);
    expect(m.currentState).toBe(upkeep);
    expect(m.previousState).toBe(start);
  });

  it('can be blocked by an exit action', () => {
    const m = new StateMachine('m');
    let entries = 0;
    const s = m.createState('s', {
      entryAction: (): void => {
        entries += 1;
      },
      exitAction: (): boolean => {
        return false;
      }
    });
    s.addTransition('again', s, { reenter: true });
    m.start();
    m.trigger('again');
    expect(entries).toBe(1);
  });

  it('still throws without the option', () => {
    const m = new StateMachine('m');
    const s = m.createState('s');
    s.addTransition('again', s);
    m.start();
    expect(m.canTrigger('again')).toBe(false);
    expect(() => {
      return m.trigger('again');
    }).toThrow('Already in state');
  });

  it('supports re-entering global transitions and draws them', () => {
    const m = new StateMachine('m');
    const a = m.createState('a');
    const b = m.createState('b');
    a.addTransition('go', b);
    m.addGlobalTransition('refresh', b, { reenter: true });
    m.start(a);
    m.trigger('go');
    expect(m.canTrigger('refresh', { global: true })).toBe(true);
    m.trigger('refresh', { global: true });
    expect(m.currentState).toBe(b);
    expect(m.previousState).toBe(a);
    expect(m.toMermaid()).toContain('s1 --> s1 : refresh (global)');
  });

  it('works on the async machine', async () => {
    const m = new AsyncStateMachine('m');
    let count = 0;
    const s = m.createState('loop', {
      entryAction: async (state): Promise<void> => {
        count += 1;
        if (count < 3) {
          await state.triggerInternal('again');
        }
      }
    });
    s.addTransition('again', s, { reenter: true });
    expect(s.transitions.get('loop:again')?.reenter).toBe(true);
    await m.start();
    expect(count).toBe(3);
    expect(m.canTrigger('again')).toBe(true);
    expect(m.previousState).toBeUndefined();
  });
});

describe('5. typed, required context', () => {
  interface ICtx {
    count: number;
  }

  it('passes the context as a required parameter', () => {
    const ctx: ICtx = { count: 0 };
    const m = new StateMachine<ICtx>('m', ctx, {
      entryAction: (state, c): void => {
        c.count += 10; // no optional chaining needed
      }
    });
    m.createState('a', false, (state, c) => {
      c.count += 1;
    });
    m.start();
    expect(ctx.count).toBe(11);
  });

  it('still accepts handlers written with an optional context', () => {
    const m = new StateMachine<ICtx>('m', { count: 0 });
    const handler = (state: State<ICtx>, c?: ICtx): void => {
      c!.count += 1;
    };
    m.createState('a', false, handler);
    m.start();
  });

  it('passes the context to async actions', async () => {
    const ctx: ICtx = { count: 0 };
    const m = new AsyncStateMachine<ICtx>('m', ctx, {
      exitAction: async (state, c): Promise<boolean> => {
        c.count += 100;
        return true;
      }
    });
    const a = m.createState('a', {
      entryAction: async (state, c): Promise<void> => {
        c.count += 1;
      }
    });
    a.addTransition('go', m.createState('b', true));
    await m.start();
    await m.trigger('go');
    expect(ctx.count).toBe(101);
  });
});

describe('6. snapshot and restore', () => {
  function build(entries: string[]): StateMachine {
    const m = new StateMachine<unknown>('game', undefined, { warnOnIdChange: false });
    const record = (state: State): void => {
      entries.push(state.id);
    };
    const start = m.createState('turn-start', false, record);
    const deploy = m.createState('deploy', false, record);
    const end = m.createState('end', true, record);
    start.addTransition('deploy', deploy);
    deploy.addTransition('end', end);
    return m;
  }

  it('round-trips through JSON without re-running entry actions', () => {
    const first: string[] = [];
    const m1 = build(first);
    m1.start();
    m1.trigger('deploy');
    const saved = JSON.stringify(m1.snapshot());
    expect(JSON.parse(saved)).toEqual({
      stateId: 'deploy',
      previousStateId: 'turn-start',
      startStateId: 'turn-start'
    });

    const second: string[] = [];
    const m2 = build(second);
    m2.restore(JSON.parse(saved) as IStateMachineSnapshot);
    expect(second).toEqual([]);
    expect(m2.started).toBe(true);
    expect(m2.currentState?.id).toBe('deploy');
    expect(m2.previousState?.id).toBe('turn-start');
    m2.trigger('end');
    expect(m2.isComplete).toBe(true);
    m2.reset(true);
    expect(m2.currentState?.id).toBe('turn-start');
  });

  it('runs entry actions and notifies listeners with runEntry', () => {
    const entries: string[] = [];
    const m = build(entries);
    const events: string[] = [];
    m.onTransition(({ from, to }) => {
      return events.push(`${from?.id}->${to.id}`);
    });
    m.restore({ stateId: 'deploy', previousStateId: 'turn-start' }, { runEntry: true });
    expect(entries).toEqual(['deploy']);
    expect(events).toEqual(['undefined->deploy']);
    expect(m.previousState?.id).toBe('turn-start');
  });

  it('replaces the state of a started machine without running exit actions', () => {
    const m = new StateMachine('m');
    let exits = 0;
    const a = m.createState('a', false, undefined, () => {
      exits += 1;
      return true;
    });
    const b = m.createState('b');
    m.start(a);
    m.restore({ stateId: 'b' });
    expect(exits).toBe(0);
    expect(m.currentState).toBe(b);
    expect(m.previousState).toBeUndefined();
  });

  it('throws before changing anything for an unknown id', () => {
    const m = build([]);
    m.start();
    expect(() => {
      return m.restore({ stateId: 'deploy', previousStateId: 'ghost' });
    }).toThrow('Unknown state id: ghost.');
    expect(m.currentState?.id).toBe('turn-start');
  });

  it('throws when taking a snapshot of a machine that has not started', () => {
    expect(() => {
      return build([]).snapshot();
    }).toThrow('Cannot take a snapshot');
  });

  it('queues a restore requested from inside an action', () => {
    const m = new StateMachine('m');
    const a = m.createState('a', false, () => {
      m.restore({ stateId: 'c' });
      expect(m.currentState?.id).toBe('a');
    });
    m.createState('b');
    m.createState('c');
    m.start(a);
    expect(m.currentState?.id).toBe('c');
  });

  it('lets a restored entry action trigger onward', () => {
    const m = new StateMachine('m');
    const a = m.createState('a', false, (state) => {
      return state.trigger('next');
    });
    const b = m.createState('b', true);
    a.addTransition('next', b);
    m.restore({ stateId: 'a' }, { runEntry: true });
    expect(m.currentState).toBe(b);
    expect(m.previousState).toBe(a);
  });

  describe('async', () => {
    function buildAsync(entries: string[]): AsyncStateMachine {
      const m = new AsyncStateMachine('game');
      const record = async (state: AsyncState): Promise<void> => {
        entries.push(state.id);
      };
      const start = m.createState('turn-start', false, record);
      const deploy = m.createState('deploy', false, record);
      start.addTransition('deploy', deploy);
      return m;
    }

    it('round-trips without re-running entry actions', async () => {
      const m1 = buildAsync([]);
      await m1.start();
      await m1.trigger('deploy');
      const snap = m1.snapshot();

      const entries: string[] = [];
      const m2 = buildAsync(entries);
      await m2.restore(snap);
      expect(entries).toEqual([]);
      expect(m2.currentState?.id).toBe('deploy');
      expect(m2.previousState?.id).toBe('turn-start');
      await m2.reset(true);
      expect(m2.currentState?.id).toBe('turn-start');
    });

    it('runs entry actions under the busy flag with runEntry', async () => {
      const m = new AsyncStateMachine('m');
      let busyDuringEntry = false;
      const a = m.createState('a', {
        entryAction: async (state): Promise<void> => {
          busyDuringEntry = m.busy;
          await state.triggerInternal('next');
        }
      });
      const b = m.createState('b', true);
      a.addTransition('next', b);
      await m.restore({ stateId: 'a' }, { runEntry: true });
      expect(busyDuringEntry).toBe(true);
      expect(m.currentState).toBe(b);
      expect(m.previousState).toBe(a);
    });

    it('rejects while busy and for unknown ids', async () => {
      const m = new AsyncStateMachine('m');
      let restoreError: unknown;
      m.createState('a', {
        entryAction: async (): Promise<void> => {
          restoreError = await m.restore({ stateId: 'a' }).catch((e: unknown) => {
            return e;
          });
        }
      });
      await m.start();
      expect(String(restoreError)).toContain('busy. Cannot restore.');
      await expect(m.restore({ stateId: 'ghost' })).rejects.toThrow('Unknown state id: ghost.');
      expect(() => {
        return new AsyncStateMachine('x').snapshot();
      }).toThrow('Cannot take a snapshot');
    });
  });
});

describe('constructor forms', () => {
  it('accepts positional actions plus an options object', () => {
    const entered: string[] = [];
    const m = new StateMachine(
      'm',
      undefined,
      (s) => {
        return entered.push(s.id);
      },
      () => {
        return true;
      },
      { globalFallback: true }
    );
    const a = m.createState('a');
    const b = m.createState('b');
    a.addTransition('x', b);
    m.addGlobalTransition('home', a);
    m.start();
    m.trigger('x');
    m.trigger('home');
    expect(entered).toEqual(['a', 'b', 'a']);
  });

  it('accepts positional async actions plus an options object', async () => {
    const m = new AsyncStateMachine('m', undefined, undefined, undefined, { globalFallback: true });
    const a = m.createState('a');
    const b = m.createState('b');
    m.addGlobalTransition('go', b);
    await m.start(a);
    await m.trigger('go');
    expect(m.currentState).toBe(b);
  });
});
