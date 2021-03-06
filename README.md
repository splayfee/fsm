# Edium Finite State Machine
## Overview
**Edium FSM** is a simple finite state machine written in TypeScript used for gaming or workflow systems. It supports local and global transitions/triggers, entry and exit actions, and the ability to block state transitions before exit. It works both on the client and the server in plain JavaScript or with TypeScript.

## Features
- Unlimited number of states
- One or more completed states
- Go to the previous state
- Throws errors on invalid state transitions
- Supports entry actions
- Supports blocking exit actions
- Start on any state
- Reset the state machine with optional restart
- Unlimited local transitions
- Unlimited global transtions/triggers that bypass the current state's transition rules
- State changes occur via triggers
- When creating the machine, optionally send in a context which is sent to all state actions.
## Installation

```bash
    $ npm install @edium/fsm
```

## Tests/Coverage

The code is fully unit tested with near 100 test percent coverage. Additonally, all code has been vetted using Sonar Scanner (TypeScript) and Code Metrics.

```bash
  $ npm run test
  $ npm run coverage
```

## Examples

Begin by referencing the module (browser):

```javascript
import { State, StateMachine } from '@edium/fsm';
```

or through Node.js:

```javascript
const { State, StateMachine } = require('@edium/fsm');
```

Finally, wire up your state machine and start it:

```Javascript
const entryAction = ( state, context ) => {
  state.trigger( "next" );
};

const exitAction = ( state, context ) => {
  // Returning false will cancel the state transition
  return true;
};

const decideAction = ( state, context ) => {
  const index = context.randomize();
  if ( index === 0 ) {
      state.trigger( "gotoThree" );
  } else if ( index === 1 ) {
      state.trigger( "gotoFour" );
  }
};

const finalAction = ( state ) => {
  // Can perform some final actions, the state machine is finished running.
};

const context = {
  randomize: () => {
    return Math.floor( Math.random() * 2 );
  }
};

const stateMachine = new StateMachine('My first state machine', context);
const s1 = stateMachine.createState( "My first state", false, entryAction);
const s2 = stateMachine.createState( "My second state", false, decideAction, exitAction); // Trivial use of exit action as an example.
const s3 = stateMachine.createState( "My third state", false, entryAction);
const s4 = stateMachine.createState( "My fourth state", false, entryAction);

// Notice true indicates completed state.
var s5 = stateMachine.createState( "My fifth and final state", true, finalAction); 

// Define all state transitions
s1.addTransition( "next", s2 );
s2.addTransition( "gotoThree", s3 );
s2.addTransition( "gotoFour", s4 );
s3.addTransition( "next", s5 );
s4.addTransition( "next", s5 );

// Start the state machine
stateMachine.start( s1 );
```