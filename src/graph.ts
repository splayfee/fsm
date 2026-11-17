/**
 * @fileOverview Static analysis and diagram export helpers shared by the sync and async state machines.
 * These are pure reads of the state/transition graph; they never change machine behavior.
 */

/** The minimal shape of a state needed for graph analysis. Satisfied by both State and AsyncState. */
export interface IGraphState {
  readonly id: string;
  readonly name: string;
  readonly isComplete: boolean;
  readonly transitions: ReadonlyMap<string, { readonly targetState: IGraphState }>;
}

/** The minimal shape of a machine needed for graph analysis. */
export interface IGraph {
  readonly name: string;
  readonly states: ReadonlyMap<string, IGraphState>;
  readonly globalTransitions: ReadonlyMap<
    string,
    { readonly targetState: IGraphState; readonly reenter?: boolean }
  >;
}

/** The result of validating a state machine's structure. All lists contain state ids. */
export interface IValidationResult {
  /** True when no problems were found. */
  valid: boolean;
  /** Registered states that cannot be reached from the start state. */
  unreachable: string[];
  /** Registered states that are not complete but have no transition leading to another state. */
  deadEnds: string[];
  /** States that are the target of a transition but were never added to the machine. */
  unregisteredTargets: string[];
}

/** Returns every distinct state reachable in one step from `state`, including via global transitions. */
function _outgoing(graph: IGraph, state: IGraphState): IGraphState[] {
  const targets: IGraphState[] = [];
  for (const transition of state.transitions.values()) {
    targets.push(transition.targetState);
  }
  for (const transition of graph.globalTransitions.values()) {
    targets.push(transition.targetState);
  }
  return targets.filter((target: IGraphState): boolean => {
    return target !== state;
  });
}

/** Resolves the start state: the explicit one if given, otherwise the first registered state. */
function _resolveStart(graph: IGraph, startState?: IGraphState): IGraphState | undefined {
  return startState ?? graph.states.values().next().value;
}

/**
 * Checks a machine's structure for unreachable states, dead ends and transitions to unregistered states.
 * @param graph The machine to analyze.
 * @param startState The state analysis starts from. Defaults to the first registered state.
 */
export function validateGraph(graph: IGraph, startState?: IGraphState): IValidationResult {
  const registered = new Set<IGraphState>(graph.states.values());
  const unregistered = new Set<IGraphState>();
  const reachable = new Set<IGraphState>();

  const start = _resolveStart(graph, startState);
  const pending: IGraphState[] = start ? [start] : [];
  while (pending.length > 0) {
    const state = pending.pop()!;
    if (reachable.has(state)) {
      continue;
    }
    reachable.add(state);
    pending.push(..._outgoing(graph, state));
  }

  for (const state of [...registered, ...reachable]) {
    for (const target of _outgoing(graph, state)) {
      if (!registered.has(target)) {
        unregistered.add(target);
      }
    }
  }

  const unreachable: string[] = [];
  const deadEnds: string[] = [];
  for (const state of registered) {
    if (!reachable.has(state)) {
      unreachable.push(state.id);
    }
    if (!state.isComplete && _outgoing(graph, state).length === 0) {
      deadEnds.push(state.id);
    }
  }

  const unregisteredTargets = [...unregistered].map((state: IGraphState): string => {
    return state.id;
  });

  return {
    valid: unreachable.length === 0 && deadEnds.length === 0 && unregisteredTargets.length === 0,
    unreachable,
    deadEnds,
    unregisteredTargets
  };
}

/** A single drawable edge of the diagram. */
interface IEdge {
  from: IGraphState;
  to: IGraphState;
  label: string;
  global: boolean;
}

/** Collects the nodes (registered states first, then any unregistered targets) and edges to draw. */
function _collect(graph: IGraph): { nodes: IGraphState[]; edges: IEdge[] } {
  const nodes: IGraphState[] = [...graph.states.values()];
  const edges: IEdge[] = [];

  for (const state of graph.states.values()) {
    for (const [key, transition] of state.transitions) {
      // Local transition keys are "<state id>:<trigger id>"; show only the trigger part.
      const label = key.startsWith(`${state.id}:`) ? key.slice(state.id.length + 1) : key;
      edges.push({ from: state, to: transition.targetState, label, global: false });
    }
  }

  // Global transitions can fire from any state that is not complete.
  for (const [key, transition] of graph.globalTransitions) {
    for (const state of graph.states.values()) {
      // A re-entering global transition also loops from its own target state.
      if (!state.isComplete && (state !== transition.targetState || transition.reenter)) {
        edges.push({ from: state, to: transition.targetState, label: key, global: true });
      }
    }
  }

  for (const edge of edges) {
    if (!nodes.includes(edge.to)) {
      nodes.push(edge.to);
    }
  }
  return { nodes, edges };
}

/**
 * Renders the machine as a Mermaid `stateDiagram-v2`. Global transitions are drawn from every
 * non-complete state and labeled "(global)".
 * @param graph The machine to render.
 * @param startState The state to mark as the initial state. Defaults to the first registered state.
 */
export function toMermaid(graph: IGraph, startState?: IGraphState): string {
  const { nodes, edges } = _collect(graph);
  const alias = (state: IGraphState): string => {
    return `s${nodes.indexOf(state)}`;
  };
  const escape = (text: string): string => {
    return text.replace(/"/g, '#quot;');
  };

  const lines: string[] = ['stateDiagram-v2'];
  for (const state of nodes) {
    lines.push(`  state "${escape(state.name)}" as ${alias(state)}`);
  }
  const start = _resolveStart(graph, startState);
  if (start) {
    lines.push(`  [*] --> ${alias(start)}`);
  }
  for (const edge of edges) {
    const label = edge.global ? `${edge.label} (global)` : edge.label;
    lines.push(`  ${alias(edge.from)} --> ${alias(edge.to)} : ${escape(label)}`);
  }
  for (const state of nodes) {
    if (state.isComplete) {
      lines.push(`  ${alias(state)} --> [*]`);
    }
  }
  return lines.join('\n');
}

/**
 * Renders the machine as a Graphviz DOT digraph. Complete states are drawn as double circles and
 * global transitions as dashed edges from every non-complete state.
 * @param graph The machine to render.
 * @param startState The state to mark as the initial state. Defaults to the first registered state.
 */
export function toDot(graph: IGraph, startState?: IGraphState): string {
  const { nodes, edges } = _collect(graph);
  const alias = (state: IGraphState): string => {
    return `s${nodes.indexOf(state)}`;
  };
  const quote = (text: string): string => {
    return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  };

  const lines: string[] = [`digraph ${quote(graph.name)} {`, '  rankdir=LR;'];
  for (const state of nodes) {
    const shape = state.isComplete ? 'doublecircle' : 'ellipse';
    lines.push(`  ${alias(state)} [label=${quote(state.name)}, shape=${shape}];`);
  }
  const start = _resolveStart(graph, startState);
  if (start) {
    lines.push('  start [shape=point];');
    lines.push(`  start -> ${alias(start)};`);
  }
  for (const edge of edges) {
    const style = edge.global ? ', style=dashed' : '';
    lines.push(`  ${alias(edge.from)} -> ${alias(edge.to)} [label=${quote(edge.label)}${style}];`);
  }
  lines.push('}');
  return lines.join('\n');
}
