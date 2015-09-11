"use strict";

/**
 * @fileOverview This file holds the StateMachineError class definition.
 * @author <a href="mailto:david@edium.com">David LaTour</a>
 * @version 1.0.0
 */


module.exports = StateMachineError;

/**
 * @class This class defines all errors that are thrown by the state machine.<br/>
 * @param {String} name The error name.
 * @param {String} message The error message.
 */
function StateMachineError( name, message ) {

    this.name = "ERROR_SM_" + name;
    this.id = "ERROR_SM_" + name;
    this.message = message;
    this.stack = (new Error()).stack;
}
StateMachineError.prototype = Object.create(Error.prototype);
StateMachineError.prototype.constructor = StateMachineError;