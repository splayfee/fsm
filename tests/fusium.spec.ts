'use strict';
import { State, StateMachine, Transition } from '../src/index';
import { TEntryActionFn, TExitActionFn } from '../src/State';

describe('test states', (): void => {
  it('should throw an error when starting a machine with no states', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    expect((): void => {
      stateMachine.start();
    }).toThrow(
      'State Machine (my first state machine) - No states have been defined. The state machine cannot be started.'
    );
  });

  it('should throw an error when starting a machine that has already started', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state');
    expect(state1).toBeDefined();
    stateMachine.start();
    expect((): void => {
      stateMachine.start();
    }).toThrow('State Machine (my first state machine) - The state machine has already started.');
  });

  it('should create and add a state manually', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = new State(stateMachine, 'my first state');
    stateMachine.addState(state1);
    const foundState: State | undefined = stateMachine.getStateById(state1.id);
    expect(foundState).toEqual(state1);
  });

  it('should create and add a state automatically', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    stateMachine.createState('my first state', true);
    const foundState: State = stateMachine._states.values().next().value;
    expect(foundState).toBeDefined();
    expect(foundState.name === 'my first state');
    expect(foundState.isComplete).toEqual(true);
  });

  it('should throw a state exists error', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = new State(stateMachine, 'my first state', false);
    const state2: State = new State(stateMachine, 'my first state', false);
    stateMachine.addState(state1);
    expect((): void => {
      stateMachine.addState(state2);
    }).toThrow('State Machine (my first state machine) - State exists: my-first-state.');
  });

  it('should have a default start state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    stateMachine.start();
    expect(state1).toEqual(stateMachine.currentState);
  });

  it('should start with an explicit start state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    const state2: State = stateMachine.createState('my second state', false);
    stateMachine.start(state2);
    expect(state2).toEqual(stateMachine.currentState);
  });

  it('should transition from current state to previous state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    state1.entryAction = (state: State): void => {
      state.trigger('next', false);
    };
    const state2: State = stateMachine.createState('my second state', false);
    state1.addTransition('next', state2);
    stateMachine.start(state1);
    expect(stateMachine._currentState).toEqual(state2);
    expect(stateMachine._previousState).toEqual(state1);
  });

  it('should return the state machine name', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    expect(stateMachine.name).toEqual('my first state machine');
  });

  it('should return the state machine id', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    expect(stateMachine.id).toEqual('my-first-state-machine');
  });

  it('should start with the first state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    stateMachine.start(state1);
    expect(stateMachine.started).toEqual(true);
    expect(stateMachine._currentState).toEqual(state1);
  });

  it('Should reset the state then restart it', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    stateMachine.start(state1);
    stateMachine.reset(true);
    expect(stateMachine._currentState).toEqual(state1);
    expect(stateMachine._previousState).toEqual(undefined);
  });

  it('Should reset the state but not restart it', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    state1.entryAction = (state: State): void => {
      state.trigger('next');
    };
    const state2: State = stateMachine.createState('my second state', false);
    state1.addTransition('next', state2);
    stateMachine.start(state1);
    stateMachine.reset();
    expect(stateMachine._currentState).toEqual(undefined);
    expect(stateMachine._previousState).toEqual(undefined);
  });

  it('Should block exit from the current state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    state1.exitAction = (): boolean => {
      return false;
    };
    const state2: State = stateMachine.createState('my second state', false);
    state1.addTransition('next', state2);
    stateMachine.start(state1);
    state1.trigger('next');
    expect(stateMachine._currentState).toEqual(state1);
  });

  it('Should attach entry and exit actions from the constructor', (): void => {
    let counter = 0;
    const entryAction = (): void => {
      counter++;
    };
    const exitAction = (): boolean => {
      counter++;
      return true;
    };

    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState(
      'my first state',
      false,
      entryAction,
      exitAction
    );
    const state2: State = stateMachine.createState('my second state', false);
    state1.addTransition('next', state2);
    stateMachine.start(state1);

    state1.trigger('next');
    expect(stateMachine._currentState).toEqual(state2);
    expect(counter).toEqual(2);
  });
});

describe('test global state transition', (): void => {
  it('should transition to a global state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', false);
    const state3: State = stateMachine.createState('my third state', false);
    stateMachine.addGlobalTransition('gotoThree', state3);
    stateMachine.start();
    stateMachine.trigger('gotoThree', true);
    expect(stateMachine.started).toEqual(true);
    expect(stateMachine._currentState).toEqual(state3);
  });
});

describe('test transition', (): void => {
  it('should create a new transition', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const state1: State = stateMachine.createState('my first state', false);
    const transition: Transition = new Transition('next', state1);
    expect(transition).toBeDefined();
    expect(transition.triggerId).toEqual('next');
    expect(transition.targetState).toEqual(state1);
  });
});

describe('test the state machine', (): void => {
  it('should be in completed state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false);
    const s2: State = stateMachine.createState('my second state', true);
    s1.addTransition('next', s2);
    stateMachine.start();
    stateMachine.trigger('next');
    expect(stateMachine.isComplete).toEqual(true);
  });

  it('should provide context to all actions', (): void => {
    interface ContextType {
      testEntry: string;
      testExit: string;
    }
    const context = {
      testEntry: 'test123',
      testExit: 'test456'
    };

    const entryAction: TEntryActionFn<ContextType> = (state, context): void => {
      expect(context).toBeDefined();
      expect(context?.testEntry).toEqual('test123');
    };

    const exitAction: TExitActionFn<ContextType> = (state, context): boolean => {
      expect(context).toBeDefined();
      expect(context?.testExit).toEqual('test456');
      return true;
    };

    const stateMachine: StateMachine = new StateMachine<ContextType>(
      'my first state machine',
      context
    );
    const s1: State = stateMachine.createState('my first state', false, entryAction, exitAction);
    const s2: State = stateMachine.createState('my second state', true);
    s1.addTransition('next', s2);
    stateMachine.start();
    stateMachine.trigger('next');
  });

  it('should get a state by its id', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', true);
    const s3: State = stateMachine.createState('my third state', true);
    stateMachine.createState('my fourth state', true);
    expect(stateMachine.getStateById('my third state')).toEqual(s3);
  });
  it('should throw an error if the state machine is already in the requested state', (): void => {
    const entryAction = (state: State): void => {
      state.trigger('next');
    };

    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false);
    s1.entryAction = entryAction;
    s1.addTransition('next', s1);
    expect((): void => {
      stateMachine.start();
    }).toThrow(
      'State Machine (my first state machine) - Already in state: currentState: my first state.'
    );
  });

  it('should throw an error when trying to transition from a state that is not the current state', (): void => {
    const entryAction = (): void => {
      // noop
    };

    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false, entryAction);
    const s2: State = stateMachine.createState('my second state', false, entryAction);
    const s3: State = stateMachine.createState('my third state', false, entryAction);
    s1.addTransition('next', s2);
    s2.addTransition('other', s3);
    expect((): void => {
      stateMachine.start(s1);
      s3.trigger('other');
    }).toThrow(
      'State Machine (my first state machine) - Invalid Transition - triggerId: my-first-state:other.'
    );
  });

  it('should go to the previous state', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false);
    const s2: State = stateMachine.createState('my second state', false);
    s1.addTransition('next', s2);
    stateMachine.start();
    stateMachine.trigger('next');
    expect(stateMachine._currentState).toEqual(s2);
    expect(stateMachine._previousState).toEqual(s1);
    stateMachine.gotoPrevious();
    expect(stateMachine._currentState).toEqual(s1);
    expect(stateMachine._previousState).toEqual(s2);
  });

  it('should not error if you attempt to go to a previous state that does bot exist', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    stateMachine.createState('my first state', false);
    stateMachine.start();

    expect((): void => {
      stateMachine.gotoPrevious();
    }).not.toThrow();
  });

  it('should throw an error on an invalid transition', (): void => {
    const entryAction = (state: State): void => {
      state.trigger('next');
    };

    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', false);
    s1.entryAction = entryAction;
    expect((): void => {
      stateMachine.start();
    }).toThrow(
      'State Machine (my first state machine) - Invalid Transition - triggerId: my-first-state:next.'
    );
  });

  it('should throw an error when transitioning on not started', (): void => {
    const entryAction = (state: State): void => {
      state.trigger('next');
    };

    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false);
    stateMachine.createState('my second state', false);
    s1.entryAction = entryAction;
    expect((): void => {
      s1.trigger('next', false);
    }).toThrow('State Machine (my first state machine) - not started.');
  });

  it('should not be complete if the state machine has not started', (): void => {
    const stateMachine: StateMachine = new StateMachine('my first state machine');
    expect(stateMachine.isComplete).toEqual(false);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  it('should run a simple state machine', (done: Function): void => {
    let entryCount = 0;
    let exitCount = 0;

    const entryAction = (state: State): void => {
      entryCount++;
      expect(state).toBeInstanceOf(State);
      state.trigger('next');
    };

    const exitAction = (state: State): boolean => {
      exitCount++;
      expect(state).toBeInstanceOf(State);
      return true;
    };

    const decideAction = (state: State): void => {
      entryCount++;
      expect(state).toBeInstanceOf(State);
      const index = Math.floor(Math.random() * 2);
      if (index === 0) {
        state.trigger('gotoThree');
      } else if (index === 1) {
        state.trigger('gotoThree');
      }
    };

    const finalAction = (state: State): void => {
      entryCount++;
      expect(entryCount).toEqual(4);
      expect(exitCount).toEqual(3);
      expect(state).toBeInstanceOf(State);
      done();
    };

    const stateMachine: StateMachine = new StateMachine('my first state machine');
    const s1: State = stateMachine.createState('my first state', false);
    const s2: State = stateMachine.createState('my second state', false);
    const s3: State = stateMachine.createState('my third state', false);
    const s4: State = stateMachine.createState('my fourth state', false);
    const s5: State = stateMachine.createState('my final state', true);

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

    stateMachine.start(s1);
  });

  it('should call state machine callbacks during transitions', (): void => {
    let entryCount = 0;
    let exitCount = 0;
    const STATE1_NAME = 'state1';
    const STATE2_NAME = 'state2';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onEntry: TEntryActionFn = (state) => {
      entryCount += 1;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onExit: TExitActionFn = (state): boolean => {
      exitCount += 1;
      return true;
    };

    const stateMachine: StateMachine = new StateMachine(
      'my first state machine',
      undefined,
      onEntry,
      onExit
    );
    const s1: State = stateMachine.createState(STATE1_NAME, false);
    const s2: State = stateMachine.createState(STATE2_NAME, false);
    s1.addTransition('goTwo', s2);

    stateMachine.start(s1);
    stateMachine.trigger('goTwo');

    expect(entryCount).toEqual(2);
    expect(exitCount).toEqual(1);
  });
});
