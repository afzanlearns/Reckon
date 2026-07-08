export interface Task {
  id: string;
  title: string;
  estTimeMin: number;
  urgency: 'low' | 'med' | 'high';
  status: 'pending' | 'done' | 'bumped';
}

export interface HistoryEntry {
  pattern: string;
  relevantAgent: 'efficiency' | 'wellbeing' | 'consequence';
}

export interface RejectedOption {
  option: string;
  reason: string;
}

export interface Verdict {
  chosenOption: string;
  rejectedOptions: RejectedOption[];
  updatedTaskList: Task[];
}

export const SEED_TASKS: Task[] = [
  { id: 't1', title: 'Finish assignment submission', estTimeMin: 90, urgency: 'high', status: 'pending' },
  { id: 't2', title: 'Gym session', estTimeMin: 60, urgency: 'med', status: 'pending' },
  { id: 't3', title: 'Call mom', estTimeMin: 20, urgency: 'low', status: 'pending' },
  { id: 't4', title: "Friend's birthday dinner", estTimeMin: 120, urgency: 'med', status: 'pending' },
  { id: 't5', title: "Prep for tomorrow's presentation", estTimeMin: 45, urgency: 'high', status: 'pending' },
];

export const SEED_HISTORY: HistoryEntry[] = [
  { pattern: 'skipped gym 4 of the last 6 stressful weeks', relevantAgent: 'wellbeing' },
  { pattern: 'missed 2 of the last 3 family calls during deadline weeks', relevantAgent: 'wellbeing' },
  { pattern: 'submitted work late 3 times after deprioritizing it for social plans', relevantAgent: 'consequence' },
];

export const FALLBACK_VERDICT: Verdict = {
  chosenOption: 'Prioritize the assignment and presentation prep tonight; move gym to tomorrow morning; keep the birthday dinner but shorten it.',
  rejectedOptions: [
    { option: 'Skip the assignment to attend the full birthday dinner', reason: 'High risk of a late submission given past pattern of missed deadlines when deprioritized for social plans.' },
    { option: 'Skip the birthday dinner entirely', reason: 'Relationship cost is avoidable — a shortened appearance preserves the deadline without full social withdrawal.' },
  ],
  updatedTaskList: [
    { id: 't1', title: 'Finish assignment submission', estTimeMin: 90, urgency: 'high', status: 'pending' },
    { id: 't5', title: "Prep for tomorrow's presentation", estTimeMin: 45, urgency: 'high', status: 'pending' },
    { id: 't4', title: "Friend's birthday dinner (shortened)", estTimeMin: 60, urgency: 'med', status: 'pending' },
    { id: 't2', title: 'Gym session', estTimeMin: 60, urgency: 'med', status: 'bumped' },
    { id: 't3', title: 'Call mom', estTimeMin: 20, urgency: 'low', status: 'pending' },
  ],
};