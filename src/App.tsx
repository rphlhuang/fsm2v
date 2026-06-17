import { ReactFlowProvider } from '@xyflow/react';
import { FSMCanvas } from './components/canvas/FSMCanvas';
import { Toolbar } from './components/panels/Toolbar';
import { ChecklistPanel } from './components/panels/ChecklistPanel';
import { InspectorPanel } from './components/panels/InspectorPanel';
import { CodePanel } from './components/panels/CodePanel';
import { LossyConvertDialog } from './components/dialogs/LossyConvertDialog';
import { SetupDialog } from './components/dialogs/SetupDialog';

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ReactFlowProvider>
          <div className="relative min-w-0 flex-1">
            <FSMCanvas />
            <ChecklistPanel />
            <InspectorPanel />
          </div>
        </ReactFlowProvider>
        <CodePanel />
      </div>
      <LossyConvertDialog />
      <SetupDialog />
    </div>
  );
}
