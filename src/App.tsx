import { useState, useCallback, useRef } from 'react';
import DilemmaInput from './components/DilemmaInput';
import AgentCard from './components/AgentCard';
import VerdictCard from './components/VerdictCard';
import TaskListDiff from './components/TaskListDiff';
import OverrideModal from './components/OverrideModal';
import AssistantPanel from './components/AssistantPanel';
import { SEED_TASKS, FALLBACK_VERDICT } from './agents/fallbackData';
import { runSwarm, runEnforcer, type SwarmResult } from './agents/orchestrator';
import { buildFinalDecision, type FinalDecision } from './agents/finalDecision';
import { buildReasoningTrace } from './agents/reasoningTrace';
import type { Task } from './agents/fallbackData';
import { recordOverrideOutcome } from './assistant/personalization';

type OverrideState = {
  point: string;
  taskId: string;
  agentKey: 'efficiency' | 'wellbeing' | 'consequence';
};

export default function App() {
  const [taskList] = useState<Task[]>(SEED_TASKS);
  const originalTaskList = taskList;
  const [swarmResult, setSwarmResult] = useState<SwarmResult | null>(null);
  const [finalDecision, setFinalDecision] = useState<FinalDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [overrideModal, setOverrideModal] = useState<OverrideState | null>(null);
  const [enforcerResponse, setEnforcerResponse] = useState<string | null>(null);
  const [enforcerLoading, setEnforcerLoading] = useState(false);
  const swarmResultRef = useRef<SwarmResult | null>(null);

  const buildDecision = (swarm: SwarmResult, overriddenTaskId?: string): FinalDecision => {
    const rationale = swarm.verdict.rejectedOptions.map(r => r.reason).join(' ');
    const confidence = swarm.verdict.rejectedOptions.length <= 1 ? 0.85 : 0.6;
    let taskList = swarm.verdict.updatedTaskList;
    if (overriddenTaskId) {
      taskList = taskList.map(task =>
        task.id === overriddenTaskId ? { ...task, status: 'pending' as const } : task
      );
    }
    return buildFinalDecision({
      decision: swarm.verdict.chosenOption,
      taskList,
      originalTaskList,
      confidence,
      rationale,
    });
  };

  const handleSubmit = useCallback(async (text: string) => {
    setIsLoading(true);
    setSwarmResult(null);
    setFinalDecision(null);
    try {
      const result = await runSwarm(text, taskList);
      swarmResultRef.current = result;
      setSwarmResult(result);
      const fd = buildDecision(result);
      setFinalDecision(fd);
      const isFallback = result.verdict === FALLBACK_VERDICT;
      const trace = buildReasoningTrace(result, false, isFallback ? 'fallback' : 'synthesizer');
      console.log('[ReasoningTrace]', trace);
    } catch (err) {
      console.error('Swarm failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskList]);

  const handleOverrideClick = useCallback(() => {
    if (!swarmResult) return;
    setOverrideModal({ point: swarmResult.verdict.chosenOption, taskId: '', agentKey: 'wellbeing' });
    setEnforcerResponse(null);
  }, [swarmResult]);

  const handleOverrideSubmit = useCallback(async (reason: string) => {
    if (!overrideModal) return;
    setEnforcerLoading(true);
    try {
      const response = await runEnforcer(overrideModal.point, reason, overrideModal.agentKey);
      setEnforcerResponse(response);
    } catch (err) {
      console.error('Enforcer failed:', err);
      setEnforcerResponse("I can't process this override right now. Please try again later.");
    } finally {
      setEnforcerLoading(false);
    }
  }, [overrideModal]);

  const handleOverrideOutcome = useCallback((outcome: 'conceded' | 'overrode_anyway') => {
    if (!overrideModal || !swarmResultRef.current) return;
    recordOverrideOutcome({ relevantAgentKey: overrideModal.agentKey, outcome });

    const swarm = swarmResultRef.current;
    let finalTaskList = swarm.verdict.updatedTaskList;
    let rationale: string;

    if (outcome === 'overrode_anyway' && overrideModal.taskId) {
      finalTaskList = finalTaskList.map(task =>
        task.id === overrideModal.taskId ? { ...task, status: 'pending' as const } : task
      );
      rationale = `User overrode a wellbeing-driven point despite pushback — the specific contested task was restored. Original reasoning: ${swarm.verdict.rejectedOptions.map(r => r.reason).join(' ')}`;
    } else if (outcome === 'conceded') {
      rationale = `User contested a point but conceded to the enforcer's reasoning. The original verdict stands: ${swarm.verdict.chosenOption}`;
    } else {
      rationale = swarm.verdict.rejectedOptions.map(r => r.reason).join(' ');
    }

    const fd = buildFinalDecision({
      decision: swarm.verdict.chosenOption,
      taskList: finalTaskList,
      originalTaskList,
      confidence: outcome === 'conceded' ? 0.7 : 0.5,
      rationale,
    });
    setFinalDecision(fd);

    const source = outcome === 'conceded' ? 'override_concede' : 'override_anyway';
    const trace = buildReasoningTrace(swarm, true, source);
    console.log('[ReasoningTrace]', trace);
  }, [overrideModal]);

  const handleOverrideClose = useCallback(() => {
    setOverrideModal(null);
    setEnforcerResponse(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#14151A]">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        <header className="text-center">
          <p className="font-mono-label text-xs tracking-widest text-[#6B6E7A] uppercase mb-1">
            Tribunal of Three Minds
          </p>
          <h1 className="font-display text-4xl text-[#F5F3EE] font-semibold">
            Reckon
          </h1>
        </header>

        <DilemmaInput onSubmit={handleSubmit} isLoading={isLoading} />

        {isLoading && (
          <div className="text-center py-8">
            <p className="font-display text-lg text-[#6B6E7A] animate-pulse">
              The Swarm Is Deliberating…
            </p>
          </div>
        )}

        {swarmResult && (
          <>
            <section className="space-y-1">
              <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#6B6E7A] mb-3">
                Witness Testimony
              </p>
              <div className="flex flex-col md:flex-row gap-1">
                <AgentCard
                  agentName={swarmResult.positions.efficiency.agentName}
                  reasoning={swarmResult.positions.efficiency.reasoning}
                  colorTheme="blue"
                />
                <AgentCard
                  agentName={swarmResult.positions.wellbeing.agentName}
                  reasoning={swarmResult.positions.wellbeing.reasoning}
                  colorTheme="green"
                />
                <AgentCard
                  agentName={swarmResult.positions.consequence.agentName}
                  reasoning={swarmResult.positions.consequence.reasoning}
                  colorTheme="purple"
                />
              </div>
            </section>

            <VerdictCard
              chosenOption={swarmResult.verdict.chosenOption}
              rejectedOptions={swarmResult.verdict.rejectedOptions}
              onOverrideClick={handleOverrideClick}
            />

            <TaskListDiff
              originalTasks={taskList}
              updatedTasks={swarmResult.verdict.updatedTaskList}
            />

            {finalDecision && <AssistantPanel finalDecision={finalDecision} />}
          </>
        )}
      </div>

      <OverrideModal
        isOpen={overrideModal !== null}
        overriddenPoint={overrideModal?.point ?? ''}
        overriddenTaskId={overrideModal?.taskId ?? ''}
        relevantAgentKey={overrideModal?.agentKey ?? 'wellbeing'}
        onSubmitReason={handleOverrideSubmit}
        onClose={handleOverrideClose}
        enforcerResponse={enforcerResponse}
        isLoading={enforcerLoading}
        onOverrideOutcome={handleOverrideOutcome}
      />
    </div>
  );
}