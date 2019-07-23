# Edium Finite State Machine
## Overview
**Edium FSM** is a simple finite state machine written in TypeScript used for gaming or workflow systems. It supports local and global transitions/triggers, entry and exit actions, and the ability to block state transitions before exit. it works both on the client and the server in plain JavaScript or with TypeScript.

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

## Installation

```bash
    $ npm install @edium/fsm
```

## Tests/Coverage
```bash
  $ npm run test
  $ npm run coverage
```

## Examples

Begin by referencing the module (browser):

```javascript
import { State, StateMachine, Transition } from '@edium/fsm';
```

or through Node.js:

```javascript
const { State, StateMachine, Transition } = require('@edium/fsm');
```

Finally, wire up your state machine and start it:

```Javascript
const entryAction = ( state ) => {
  state.trigger( "next" );
};

const exitAction = ( state ) => {
  // Returning false will cancel the state transition
  return true;
};

const decideAction = ( state ) => {
  const index = Math.floor( Math.random() * 2 );
  if ( index === 0 ) {
      state.trigger( "goto3" );
  } else if ( index === 1 ) {
      state.trigger( "goto4" );
  }
};

const finalAction = ( state ) => {
  // Can perform some final actions, the state machine is finished running.
};

const stateMachine = new StateMachine('My first state machine');
const s1 = stateMachine.createState( "My first state", false, entryAction);
const s2 = stateMachine.createState( "My second state", false, decideAction, exitAction); // Trivial use of exit action as an example.
const s3 = stateMachine.createState( "My third state", false, entryAction);
const s4 = stateMachine.createState( "My fourth state", false, entryAction);

// Notice true indicates completed state.
var s5 = stateMachine.createState( "My fifth and final state", true, finalAction); 

// Define all state transitions
s1.addTransition( "next", s2 );
s2.addTransition( "goto3", s3 );
s2.addTransition( "goto4", s4 );
s3.addTransition( "next", s5 );
s4.addTransition( "next", s5 );

// Start the state machine
stateMachine.start( s1 );
```