let sessionLog = {
  overrideAttempts: 0,
  wellbeingOverrides: 0,
  concedes: 0,
};

export function recordOverrideOutcome({ relevantAgentKey, outcome }: { relevantAgentKey: string; outcome: 'conceded' | 'overrode_anyway' }): void {
  sessionLog.overrideAttempts += 1;
  if (relevantAgentKey === 'wellbeing') sessionLog.wellbeingOverrides += 1;
  if (outcome === 'conceded') sessionLog.concedes += 1;
}

export function getPersonalizationNote(): string {
  if (sessionLog.wellbeingOverrides >= 1) {
    return "You've pushed back on wellbeing-driven calls twice this session — I'll weight health and relationship factors slightly higher in the next ruling.";
  }
  if (sessionLog.overrideAttempts === 0) {
    return "No overrides yet this session — rulings are being followed as given.";
  }
  if (sessionLog.concedes > sessionLog.overrideAttempts / 2) {
    return "You've conceded to the swarm's reasoning more often than not this session — it seems to be reading your priorities correctly.";
  }
  return "Noted your recent override pattern — factoring it into how strongly the next ruling is argued.";
}

export function resetSessionLog(): void {
  sessionLog = { overrideAttempts: 0, wellbeingOverrides: 0, concedes: 0 };
}