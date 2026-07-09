import type { Task } from './fallbackData';

export type FinalDecision = {
  decision: string;
  taskList: Task[];
  originalTaskList: Task[];
  confidence: number;
  rationale: string;
};

export function buildFinalDecision({
  decision,
  taskList,
  originalTaskList,
  confidence,
  rationale,
}: {
  decision: string;
  taskList: Task[];
  originalTaskList: Task[];
  confidence: number;
  rationale: string;
}): FinalDecision {
  return { decision, taskList, originalTaskList, confidence, rationale };
}