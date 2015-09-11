"use strict";

/**
 * @fileOverview This file holds the Transition class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 1.0.0
 */

module.exports = Transition;

/**
 * @class This class defines a new transition for the state machine.<br/>
 * @param {String} triggerId A unique id that identifies this transition.
 * @param {State} targetState The new state that will be entered if the transition is allowed and successful.
 */
function Transition( triggerId, targetState ) {

    /**
     * A unique identifier for the trigger.
     * @type String
     */
    this.triggerId = triggerId;

    /**
     * The new state that will be entered if the transition is allowed and successful.
     * @type State
     */
    this.targetState = targetState;

}