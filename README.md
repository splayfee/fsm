# Fusium Finite State Machine
## Overview
**Fusium** is a simple finite state machine for gaming or workflow systems. It supports local and global triggers, entry and exit actions, and the ability to block state transitions before exit.

## Features
- Unlimited number of states
- Accepted state
- Go to the previous state
- Throws errors on invalid state transitions
- Supports entry actions
- Supports blocking exit actions
- Start on any state
- Reset the state machine

## Installation

    $ npm install fusium

## Examples

Begin by referencing the module:

```javascript
var fusium = require("fusium");
```

Then add in the classes:

```javascript
var State = fusium.classes.State;
var StateMachineError = fusium.classes.StateMachineError;
var StateMachine = fusium.classes.StateMachine;
var Transition = fusium.classes.Transition;
```

Finally, wire up your state machine and start it:

```Javascript
var entryAction = {
    execute: function( state ) {
        state.trigger( "next" );
    };
};

var exitAction = {
    execute: function( state ) {
        // Returning false will cancel the state transition
        return true;
    };
};

var decideAction = {
    execute: function( state ) {
        var index = Math.floor( Math.random() * 2 );
        if ( index === 0 ) {
            state.trigger( "goto3" );
        } else if ( index === 1 ) {
            state.trigger( "goto4" );
        }
    }
};

var finalAction = {
    execute: function( state ) {
        // Can perform some final actions, the state machine is finished running.
    };
};

var stateMachine = new StateMachine();
var s1 = stateMachine.createState( "My first state", false );
var s2 = stateMachine.createState( "My second state", false );
var s3 = stateMachine.createState( "My third state", false );
var s4 = stateMachine.createState( "My fourth state", false );
// Notice true indicates a final accept state.
var s5 = stateMachine.createState( "My final state", true ); 

// Wire up all entry and exit actions
s1.entryAction = entryAction;
s1.exitAction = exitAction;
s2.entryAction = decideAction;
s2.exitAction = exitAction;
s3.entryAction = entryAction;
s3.exitAction = exitAction;
s4.entryAction = entryAction;
s4.exitAction = exitAction;
s5.entryAction = finalAction;

// Define all state transitions
s1.addTransition( "next", s2 );
s2.addTransition( "goto3", s3 );
s2.addTransition( "goto4", s4 );
s3.addTransition( "next", s5 );
s4.addTransition( "next", s5 );

// Start the state machine
stateMachine.start( s1 );
```