"use strict";

var chai = require("chai");
var expect = chai.expect;

var fusium = require( "../index" );
var State = fusium.classes.State;
var StateMachineError = fusium.classes.StateMachineError;
var StateMachine = fusium.classes.StateMachine;
var Transition = fusium.classes.Transition;


describe("test states", function () {

    it("should throw an error when starting a machine with no states", function () {
        var stateMachine = new StateMachine();
        expect(function() {
            stateMachine.start();
        }).to.throw( StateMachineError, "No states have been defined. The state machine cannot be started." );
    });

    it("should throw an error when starting a machine has already started", function () {
        var stateMachine = new StateMachine();
        var state1 = stateMachine.createState("my first state", 0, true );
        var entryAction = {};
        entryAction.execute = function( state ) {
            expect( state ).to.be.instanceof(State);
        };
        state1.entryAction = entryAction;
        stateMachine.start();
        expect(function() {
            stateMachine.start();
        }).to.throw( StateMachineError, "The state machine has already started." );
    });

    it("should create and add a state manually", function () {
        var stateMachine = new StateMachine();
        var state1 = new State( stateMachine, 0, "my first state", true );
        stateMachine.addState( state1 );
        expect( stateMachine.states.length).to.eql(1);
        expect( stateMachine.states[0]._stateMachine ).to.eql(stateMachine);
        expect( stateMachine.states[0].id).to.eql(0);
        expect( stateMachine.states[0].name ).to.eql("my first state");
        expect( stateMachine.states[0].isAccept ).to.eql(true);
    });

    it("should create and add a state automatically", function() {
        var stateMachine = new StateMachine();
        stateMachine.createState( "my first state", true );
        expect( stateMachine.states.length ).to.eql(1);
        expect( stateMachine.states[0]._stateMachine ).to.eql(stateMachine);
        expect( stateMachine.states[0].name ).to.eql("my first state");
        expect( stateMachine.states[0].isAccept ).to.eql(true);
    });

    it("should throw a state exists error", function() {
        var stateMachine = new StateMachine();
        var state1 = new State( stateMachine, 1, "my first state", false );
        var state2 = new State( stateMachine, 1, "my second state", false );
        stateMachine.addState( state1 );
        expect(function() {
            stateMachine.addState( state2 );
        }).to.throw( StateMachineError, "State exists" );

    });

    it("should have a default start state", function() {
        var stateMachine = new StateMachine();
        var state1 = stateMachine.createState( "my first state", false );
        stateMachine.start();
        expect(state1).to.deep.equal(stateMachine.currentState);
    });

    it("should start with an explicit start state", function() {
        var stateMachine = new StateMachine();
        stateMachine.createState( "my first state", false );
        var state2 = stateMachine.createState( "my second state", false );
        stateMachine.start( state2 );
        expect(state2).to.deep.equal(stateMachine.currentState);
    });

    it("should transition from previous state to current state", function() {
        var stateMachine = new StateMachine();
        var state1 = stateMachine.createState( "my first state", false );
        var entryAction = {};
        entryAction.execute = function( state ) {
            state.trigger( "next" );
        };
        state1.entryAction = entryAction;
        var state2 = stateMachine.createState( "my second state", false );
        state1.addTransition( "next", state2 );
        stateMachine.start( state1 );
        expect(stateMachine.currentState).to.deep.equal(state2);
        expect(stateMachine.previousState).to.deep.equal(state1);
    });

    it("should start with the first state", function() {
        var stateMachine = new StateMachine();
        var state1 = stateMachine.createState( "my first state", false );
        stateMachine.start( state1 );
        expect(stateMachine.started).to.equal(true);
        expect( stateMachine.currentState ).to.deep.equal(state1);
    });

    it("Should reset the state", function() {
        var stateMachine = new StateMachine();
        var state1 = stateMachine.createState( "my first state", false );
        var entryAction = {};
        entryAction.execute = function( state ) {
            state.trigger( "next" );
        };
        state1.entryAction = entryAction;
        var state2 = stateMachine.createState( "my second state", false );
        state1.addTransition( "next", state2 );
        stateMachine.start( state1 );
        stateMachine.reset( false );
        expect( stateMachine.currentState ).to.be.equal(null);
        expect( stateMachine.previousState ).to.be.equal(null);
    });

    it("should have a transition", function () {
        var stateMachine = new StateMachine();
        var state1 = new State( stateMachine, 0, "my first state" );
        var state2 = new State( stateMachine, 1, "my second state", true );
        state1.addTransition("next", state2);
        expect(state1.hasTransition("next")).to.equal(true);
        expect(state1.hasTransition("previous")).to.equal(false);
    });


});

describe("test global state transition", function () {

    it("should transition to a global state", function() {
        var stateMachine = new StateMachine();
        stateMachine.createState( "my first state", false );
        stateMachine.createState( "my second state", false );
        var state3 = stateMachine.createState( "my third state", false );
        stateMachine.addTransition( "goto3", state3 );
        stateMachine.start();
        stateMachine.trigger( "goto3", true );
        expect( stateMachine.started ).to.equal(true);
        expect( stateMachine.currentState ).to.deep.equal(state3);
    });

});

describe("test transition", function () {

    it("should create a new transition", function() {
        var stateMachine = new StateMachine();
        var state1 = stateMachine.createState( "my first state", false );
        var transition = new Transition("next", state1);
        expect(transition).to.exist;
        expect(transition.triggerId).to.equal("next");
        expect(transition.targetState).to.deep.equal(state1);
    });

});

describe("test the state machine", function () {

    it("should get a state by name", function () {
        var stateMachine = new StateMachine();
        stateMachine.createState( "my first state", false );
        var s2 = stateMachine.createState( "my second state", false );
        stateMachine.createState( "my third state", false );
        expect(stateMachine.getStateByName("my second state")).to.deep.equal(s2);
    });

    it("should be in accepted state", function () {
        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        var s2 = stateMachine.createState( "my second state", true );
        s1.addTransition("next", s2);
        stateMachine.start();
        stateMachine.trigger("next");
        expect(stateMachine.isAccept).to.equal(true);
    });

    it("should get a state by its id", function () {
        var stateMachine = new StateMachine();
        stateMachine.createState( "my first state", false );
        stateMachine.createState( "my second state", true );
        var s3 = stateMachine.createState( "my third state", true );
        stateMachine.createState( "my fourth state", true );
        expect(stateMachine.getStateById(2)).to.deep.equal(s3);
    });

    it("should throw an error if the entry action is missing 'execute' method", function () {
        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        s1.entryAction = {};
        expect(function() {
            stateMachine.start();
        }).to.throw(StateMachineError, "Not implemented - 'execute' method of an entry action" );
    });

    it("should throw an error if the exit action is missing 'execute' method", function () {
        var entryAction = {execute:function(state) {
            state.trigger("next");
        }};
        var exitAction = {};
        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        var s2 = stateMachine.createState( "my second state", false );
        s1.entryAction = entryAction;
        s1.exitAction = exitAction;
        s2.entryAction = entryAction;
        s2.exitAction = exitAction;
        s1.addTransition( "next", s2 );
        expect(function() {
            stateMachine.start();
        }).to.throw(StateMachineError, "Not implemented - 'execute' method of an exit action" );
    });

    it("should throw an error if the state machine is already in the requested state", function () {
        var entryAction = {execute:function(state) {
            state.trigger("next");
        }};
        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        s1.entryAction = entryAction;
        s1.addTransition( "next", s1 );
        expect(function() {
            stateMachine.start();
        }).to.throw(StateMachineError, "Already in state: currentStateId:0, currentStateName:my first state" );
    });

    it("should go to the previous state", function () {
        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        var s2 = stateMachine.createState( "my second state", false );
        s1.addTransition( "next", s2 );
        stateMachine.start();
        stateMachine.trigger("next");
        expect(stateMachine.currentState ).to.deep.equal(s2);
        expect(stateMachine.previousState ).to.deep.equal(s1);
        stateMachine.gotoPrevious();
        expect(stateMachine.currentState ).to.deep.equal(s1);
        expect(stateMachine.previousState ).to.deep.equal(s2);
    });

    it("should throw an error on an invalid transition", function () {
        var entryAction = {execute:function(state) {
            state.trigger("next");
        }};
        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        stateMachine.createState( "my second state", false );
        s1.entryAction = entryAction;
        expect(function() {
            stateMachine.start();
        }).to.throw(StateMachineError, "Invalid transition: triggerId:next_state_0, currentStateId:0, currentStateName:my first state" );
    });

    it("should run a simple state machine", function(done) {

        var entryCount = 0;
        var exitCount = 0;

        var entryAction = {};
        entryAction.execute = function( state ) {
            entryCount++;
            expect( state ).to.be.instanceof(State);
            state.trigger( "next" );
        };

        var exitAction = {};
        exitAction.execute = function( state ) {
            exitCount++;
            expect( state ).to.be.instanceof(State);
            return true;
        };

        var decideAction = {};
        decideAction.execute = function( state ) {
            entryCount++;
            expect( state ).to.be.instanceof(State);
            var index = Math.floor( Math.random() * 2 );
            if ( index === 0 ) {
                state.trigger( "goto3" );

            } else if ( index === 1 ) {
                state.trigger( "goto4" );
            }
        };

        var finalAction = {};
        finalAction.execute = function( state ) {
            entryCount++;
            expect( entryCount ).to.be.equal(4);
            expect( exitCount ).to.be.equal(3);
            expect( state ).to.be.instanceof(State);
            done();
        };

        var stateMachine = new StateMachine();
        var s1 = stateMachine.createState( "my first state", false );
        var s2 = stateMachine.createState( "my second state", false );
        var s3 = stateMachine.createState( "my third state", false );
        var s4 = stateMachine.createState( "my fourth state", false );
        var s5 = stateMachine.createState( "my final state", true );

        s1.entryAction = entryAction;
        s1.exitAction = exitAction;
        s2.entryAction = decideAction;
        s2.exitAction = exitAction;
        s3.entryAction = entryAction;
        s3.exitAction = exitAction;
        s4.entryAction = entryAction;
        s4.exitAction = exitAction;
        s5.entryAction = finalAction;

        s1.addTransition( "next", s2 );
        s2.addTransition( "goto3", s3 );
        s2.addTransition( "goto4", s4 );
        s3.addTransition( "next", s5 );
        s4.addTransition( "next", s5 );

        stateMachine.start( s1 );


    });
});
