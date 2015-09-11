"use strict";

/**
 * @fileOverview This file holds the State class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 1.0.0
 */


/* REQUIRED MODULES AND OBJECTS */
var Transition = require( "./Transition" );
module.exports = State;

/**
 *  @class This class defines a new state for the state machine.<br/>
 * @param {StateMachine} stateMachine The state machine that this state is associated with.
 * @param {Number} id A unique identifier for the state; may be used to retrieve the state from the state machine.
 * @param {String} name A friendly name for the state; used as a convenience so it's easier to determine the current state while debugging.
 * @param {Boolean} [isAccept] Boolean that indicates whether the state is an accepted state.
 * @returns {State}
 */
function State( stateMachine, id, name, isAccept ) {

    isAccept = (isAccept !== undefined && isAccept !== null) ? isAccept: false;

    /**
     * The state machine this state is associated with.
     * @type StateMachine
     * @private
     */
    this._stateMachine = stateMachine;

    /**
     * A unique identifier for the state; may be used to retrieve the state from the state machine.
     * @type Number
     */
    this.id = id;

    /**
     * A friendly name for the state; used as a convenience so it's easier to determine the current state while debugging.
     * @type String
     */
    this.name = name;

    /**
     * Boolean that indicates whether the state is an accepted state.
     * @type Boolean
     */
    this.isAccept = isAccept;

    /**
     * A collection of transitions that are allowed for this state.
     * @type Array
     * @private
     */
    this._transitions = [];

    /**
     * An optional action that fires whenever the state machine enters this state.
     * @type Object
     */
    this.entryAction = null;

    /**
     * An optional action that fires whenever the state machine exits this state.
     * @type Object
     */
    this.exitAction = null;
}

/**
 * Adds a local transition from this state to some a new target state. You can optionally provide a transition action.
 * @param {String} triggerId A unique identifier for the trigger.
 * @param {State} targetState The new target state to enter when the transition is triggered.
 */
State.prototype.addTransition = function( triggerId, targetState ) {
    var localTriggerId = triggerId + "_state_" + this.id.toString();
    this._transitions[localTriggerId] = new Transition( localTriggerId, targetState );
};


/**
 * Test if this state has a given transition
 * @param {String} triggerId A unique identifier for the trigger.
 * @returns {Boolean}
 */
State.prototype.hasTransition = function( triggerId ) {
    var localTriggerId = triggerId + "_state_" + this.id.toString();
    return (this._transitions[localTriggerId] !== undefined && this._transitions[localTriggerId] !== null);
};

/**
 * Returns the transition relating to the trigger specified.
 * @param {String} triggerId A unique identifier for the trigger.
 * @returns {*}
 */
State.prototype.getTransition = function( triggerId ) {
    return this._transitions[triggerId];
};

/**
 * Emits a new trigger message which causes the state machine to transition to a new state. This method delegates to the state machine.
 * @param {String} triggerId A unique identifier for the trigger.
 * @param {Boolean} [sendGlobal] Optionally tells the system to send a global transition rather than a state-specific transition.
 */
State.prototype.trigger = function( triggerId, sendGlobal ) {
    sendGlobal = (sendGlobal !== undefined && sendGlobal !== null) ? sendGlobal: false;
    this._stateMachine.trigger( triggerId, sendGlobal );
};