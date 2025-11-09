/**
 * Defines a custom error thrown by the state machine.
 */
export default class StateMachineError extends Error {
  /**
   * Instantiate a new state machine error.
   * @param machine The affected state machine name.
   * @param message Detailed error message.
   * @param state The affected state name. Optional.
   * @param trigger The affected trigger. Optional.
   */
  public constructor(
    public machine: string,
    message: string,
    public state?: string,
    public trigger?: string
  ) {
    super(`State Machine (${machine}) - ${message}`);
    this.name = 'StateMachineError';
  }
}
