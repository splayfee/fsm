"use strict";

/**
 * @fileOverview This file holds the StateMachine class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 1.0.0
 */

/* REQUIRED MODULES AND OBJECTS */
var State = require( "./State" );
var StateMachineError = require( "./StateMachineError" );
var Transition = require( "./Transition" );
module.exports = StateMachine;

/**
 *  @class This class defines a new state machine which manages state for an application. The state machine is an event emitter therefore
 *  you can optionally listen for state changes using the StateMachine.STATE_CHANGED constant.<br/>
 */
function StateMachine() {

    /**
     * A collection of all possible global machine transitions between states.
     * @type Array
     */
    this._transitions = [];

    /**
     * A collection of all possible states for this state machine.
     * @type Array
     */
    this.states = [];

    /**
     * The state that should be entered when the machine is first started.
     * @type State
     */
    this.startState = null;

    /**
     * The current state of the machine.
     * @type State
     */
    this.currentState = null;

    /**
     * The previous state of the machine; null if there is no previous state.
     */
    this.previousState = null;
}


/**
 * Boolean that indicates whether the state machine is in an accepted or completed state.
 * @type Boolean
 */
StateMachine.prototype.isAccept = false;
Object.defineProperty( StateMachine.prototype, "isAccept", {get: function() {
    var isAccept = false;
    if ( this.currentState ) {
        isAccept = this.currentState.isAccept;
    }
    return isAccept;
} } );

/**
 * Boolean value that indicates whether the state machine has been started.
 * @type Boolean
 */
StateMachine.prototype.started = false;
Object.defineProperty( StateMachine.prototype, "started", {get: function() {
    return ( this.currentState !== null && this.currentState !== undefined );
} } );

/**
 * This method returns the state machine to the previous state if there is one.
 */
StateMachine.prototype.gotoPrevious = function() {
    if ( this.previousState ) {
        this._changeState( this.previousState );
    }
};

/**
 * This method handles all transitions from state to state. It receives in a message used to determine which transition to execute.
 * @param {String} triggerId A unique identifier for the trigger.
 */
StateMachine.prototype.transitionHandler = function( triggerId ) {

    /* @type Transition */
    var transition;

    // Look for a local state transition
    transition = this.currentState.getTransition( triggerId );

    // Look for a global state transition
    if ( !transition ) {
        transition = this._transitions[triggerId];
    }

    if ( !transition || !transition.targetState ) {
        throw new StateMachineError( "INVALID_TRANSITION", "Invalid transition: triggerId:" + triggerId + ", currentStateId:" + this.currentState.id + ", currentStateName:" + this.currentState.name);
    }

    this._changeState( transition.targetState );
};

/**
 * This method changes the state of the state machine.
 * @param {State} newState The new state of the machine.
 * @private
 */
StateMachine.prototype._changeState = function( newState ) {

    var allowExit = true;

    // Throw an error if the machine is already in the requested state.
    if ( newState === this.currentState ) {
        throw new StateMachineError("ALREADY_IN_STATE", "Already in state: currentStateId:" + this.currentState.id + ", currentStateName:" + this.currentState.name);
    }

    // Perform an exit action if it exists
    if ( this.currentState && this.currentState.exitAction ) {
        if ( this.currentState.exitAction.execute ) {
            allowExit = this.currentState.exitAction.execute( this.currentState );
        } else {
            throw new StateMachineError("NOT_IMPLEMENTED", "Not implemented - 'execute' method of an exit action" );
        }
    }

    // The current state can cancel the change request if necessary
    if ( allowExit ) {
        this.previousState = this.currentState;
        this.currentState = newState;

        // Perform any entrance action if it exists
        if ( this.currentState && this.currentState.entryAction ) {
            if ( this.currentState.entryAction.execute ) {
                this.currentState.entryAction.execute( newState );
            } else {
                throw new StateMachineError("NOT_IMPLEMENTED", "Not implemented - 'execute' method of an entry action" );
            }
        }

    }
};


/**
 * Returns the state corresponding to the requested unique identifier.
 * Every state must have a unique identifier.
 * @param {Number} id A unique identifier for the state.
 * @returns {State} The state corresponding to the id, or null if one is not found.
 */
StateMachine.prototype.getStateById = function( id ) {
    return this.states[id];
};

/**
 * Returns the state corresponding to the requested state name.
 * Every state must have a name.
 * @param {String} name The name of the state.
 * @returns {State} The state corresponding to the name, or null if one is not found.
 */
StateMachine.prototype.getStateByName = function( name ) {
    var result = null;
    this.states.some( function( /*State*/ state ) {
        if ( state.name === name ) {
            result = state;
            return true;
        }
        return false;
    }, this );
    return result;
};

/**
 * Adds a global transition from the current state to some new state. Global transitions can bypass local state transition restrictions and eliminate the need to register a transition with each local state.
 * @param {String} triggerId A unique identifier for the trigger.
 * @param {State} targetState The target state.
 */
StateMachine.prototype.addTransition = function( triggerId, targetState ) {
    this._transitions[triggerId] = new Transition( triggerId, targetState );
};

/**
 * Adds a new state to the state machine.
 * @param {State} state A new state instance.
 */
StateMachine.prototype.addState = function( state ) {
    if ( this.states[state.id] ) {
        throw new StateMachineError( "STATE_EXISTS", "State exists:" + state.id);
    }
    this.states[state.id] = state;
};

/**
 * This method provides a convenient way to create a new state and automatically add it to this state machine. States can be created and added manually as well.
 * @param {String} name A friendly name for the state; used as a convenience so it's easier to determine the current state while debugging.
 * @param {Boolean} [isAccept] Boolean that indicates whether the state is an accepted state.
 * @param {Object} [entryAction] An optional action that fires whenever the state machine enters this state.
 * @param {Object} [exitAction] An optional action that fires whenever the state machine exits this state.
 * @returns {State}
 */
StateMachine.prototype.createState = function( name, isAccept, entryAction, exitAction ) {

    isAccept = (isAccept !== undefined && isAccept !== null) ? isAccept : false;

    var id = this.states.length;
    var state = new State( this, id, name, isAccept );
    state.entryAction = entryAction;
    state.exitAction = exitAction;
    this.addState( state );
    return state;
};

/**
 * Starts the state machine, throwing it into its starting state.
 * @param {State} [startState] An optional start state, the default is the first state that was added to the machine.
 */
StateMachine.prototype.start = function( startState ) {

    // Don't restart the machine is already started
    if ( this.currentState ) {
        throw new StateMachineError("ALREADY_STARTED", "The state machine has already started." );
    }

    // If a start state is not specified then default to the first state.
    if ( !startState && this.states[0] ) {
        startState = this.states[0];
    }

    this.startState = startState;

    // Don't start the machine if there are no states defined
    if ( !this.states || this.states.length === 0 ) {
        throw new StateMachineError("NO_STATES_DEFINED", "No states have been defined. The state machine cannot be started." );
    }

    this._changeState( this.startState );
};

/**
 * Resets the state machine.
 * @param {Boolean} [restart] An optional flag that indicates the state machine should be restarted after reset.
 */
StateMachine.prototype.reset = function( restart ) {

    restart = (restart !== undefined && restart !== null) ? restart : false;

    this.previousState = null;
    this.currentState = null;
    if ( restart ) {
        this.start( this.startState );
    }
};

/**
 * Emits a new trigger message which causes the state machine to transition to a new state.
 * @param {String} triggerId A unique identifier for the trigger.
 * @param {Boolean} [sendGlobal] Tells the system to send a global transition rather than a state-specific transition.
 */
StateMachine.prototype.trigger = function( triggerId, sendGlobal ) {

    sendGlobal = (sendGlobal !== undefined && sendGlobal !== null) ? sendGlobal : false;

    if ( !sendGlobal ) {
        triggerId += "_state_" + this.currentState.id.toString();
    }

    this.transitionHandler( triggerId );
};