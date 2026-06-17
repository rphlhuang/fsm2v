import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type Node,
  useReactFlow,
} from '@xyflow/react';
import { useFSMStore } from '../../store/fsmStore';
import { StateNode } from './StateNode';
import { TransitionEdge } from './TransitionEdge';

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };

export function FSMCanvas() {
  const states = useFSMStore((s) => s.states);
  const transitions = useFSMStore((s) => s.transitions);
  const config = useFSMStore((s) => s.config);
  const moveState = useFSMStore((s) => s.moveState);
  const addState = useFSMStore((s) => s.addState);
  const addTransition = useFSMStore((s) => s.addTransition);
  const removeState = useFSMStore((s) => s.removeState);
  const removeTransition = useFSMStore((s) => s.removeTransition);
  const updateTransition = useFSMStore((s) => s.updateTransition);
  const setResetState = useFSMStore((s) => s.setResetState);
  const select = useFSMStore((s) => s.select);
  const selectedId = useFSMStore((s) => s.selectedId);
  const { screenToFlowPosition } = useReactFlow();

  const nodes: Node[] = useMemo(
    () =>
      states.map((s) => ({
        id: s.id,
        type: 'state',
        position: s.position,
        selected: selectedId === s.id,
        data: {
          label: s.label,
          outputs: s.outputs,
          outputNames: config.outputs,
          isMoore: config.type === 'moore',
          isReset: config.resetStateId === s.id,
        },
      })),
    [states, config, selectedId],
  );

  const edges: Edge[] = useMemo(() => {
    // Fan apart only arcs that would actually overlap: same unordered node pair
    // *and* same handles. Arcs leaving/arriving on different handles already
    // route apart on their own, so they must not nudge each other.
    const pairKey = (t: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) =>
      [`${t.source}:${t.sourceHandle ?? ''}`, `${t.target}:${t.targetHandle ?? ''}`]
        .sort()
        .join('::');
    const groupCount = new Map<string, number>();
    const groupIndex = new Map<string, number>();
    for (const t of transitions) {
      const key = pairKey(t);
      groupCount.set(key, (groupCount.get(key) ?? 0) + 1);
    }
    return transitions.map((t) => {
      const key = pairKey(t);
      const idx = groupIndex.get(key) ?? 0;
      groupIndex.set(key, idx + 1);
      return {
        id: t.id,
        source: t.source,
        target: t.target,
        sourceHandle: t.sourceHandle ?? undefined,
        targetHandle: t.targetHandle ?? undefined,
        type: 'transition',
        selected: selectedId === t.id,
        data: {
          guard: t.guard,
          outputs: t.outputs,
          inputNames: config.inputs,
          outputNames: config.outputs,
          isMealy: config.type === 'mealy',
          siblingIndex: idx,
          siblingCount: groupCount.get(key) ?? 1,
          sourceHandleId: t.sourceHandle ?? null,
          targetHandleId: t.targetHandle ?? null,
        },
      };
    });
  }, [transitions, config, selectedId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) moveState(c.id, c.position);
      }
    },
    [moveState],
  );

  // Edge changes are derived from the store; nothing to persist here.
  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {}, []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target)
        addTransition(c.source, c.target, c.sourceHandle, c.targetHandle);
    },
    [addTransition],
  );

  // Dragging an endpoint of an existing arc re-attaches it (re-using the same
  // transition) instead of spawning a new one.
  const onReconnect = useCallback(
    (oldEdge: Edge, c: Connection) => {
      if (!c.source || !c.target) return;
      updateTransition(oldEdge.id, {
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
      });
    },
    [updateTransition],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only the empty canvas should spawn a state — never a double-click that
      // lands on a node, edge, handle, or the controls. (The bare pane and the
      // background grid count as "empty".)
      const target = e.target as HTMLElement;
      if (
        target.closest(
          '.react-flow__node, .react-flow__edge, .react-flow__handle, .react-flow__controls, .react-flow__panel',
        )
      )
        return;
      if (!target.closest('.react-flow')) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addState({ x: pos.x - 40, y: pos.y - 40 });
    },
    [screenToFlowPosition, addState],
  );

  // Backspace / Delete removes the selected state or transition, unless the
  // user is typing in a field (e.g. the inspector).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (!selectedId) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      if (selectedId === 'reset') {
        setResetState(null);
        select(null);
      } else if (states.some((s) => s.id === selectedId)) removeState(selectedId);
      else if (transitions.some((t) => t.id === selectedId)) removeTransition(selectedId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, states, transitions, removeState, removeTransition, setResetState, select]);

  return (
    <div className="relative h-full w-full" onDoubleClick={onDoubleClick}>
      {/* Arrowhead marker referenced by custom edges. */}
      <svg className="absolute" style={{ width: 0, height: 0 }}>
        <defs>
          <marker
            id="fsm-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
          <marker
            id="fsm-arrow-sel"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeClick={(_, n) => select(n.id)}
        onEdgeClick={(_, ed) => select(ed.id)}
        onPaneClick={() => select(null)}
        onNodesDelete={(deleted) => deleted.forEach((n) => removeState(n.id))}
        onEdgesDelete={(deleted) => deleted.forEach((ed) => removeTransition(ed.id))}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {/* Quiet hint in the corner instead of a toolbar caption. */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 select-none text-xs text-slate-400">
        double-click the canvas to add a state
      </div>
    </div>
  );
}
