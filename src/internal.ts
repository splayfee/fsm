/**
 * @fileOverview Library-private keys. Not exported from the package entry point, so code outside
 * this library cannot reach the members keyed by these symbols.
 */

/** Keys the AsyncStateMachine method that queues a trigger raised from inside a state action. */
export const TRIGGER_INTERNAL: unique symbol = Symbol('triggerInternal');
