import { SYSTEM_PROMPTS } from './prompts';
import { FALLBACK_VERDICT, FALLBACK_AGENT_REASONING, SEED_HISTORY, type Task, type Verdict } from './fallbackData';
import { callAgent } from './apiClient';

export interface AgentPosition {
  agentName: string;
  reasoning: string;
}

export interface SwarmResult {
  positions: {
    efficiency: AgentPosition;
    wellbeing: AgentPosition;
    consequence: AgentPosition;
  };
  verdict: Verdict;
}

export async function runSwarm(dilemmaText: string, taskList: Task[]): Promise<SwarmResult> {
  const taskListStr = JSON.stringify(taskList);
  const userMessage = `User's dilemma: "${dilemmaText}"\n\nCurrent task list: ${taskListStr}`;

  const safeCall = async (prompt: string, msg: string, fallback: string): Promise<string> => {
    try {
      return await callAgent(prompt, msg);
    } catch (err) {
      console.error('Agent call failed, using fallback reasoning:', err);
      return fallback;
    }
  };

  const [efficiency, wellbeing, consequence] = await Promise.all([
    safeCall(SYSTEM_PROMPTS.efficiency, userMessage, FALLBACK_AGENT_REASONING.efficiency),
    safeCall(SYSTEM_PROMPTS.wellbeing, `${userMessage}\n\nRecent pattern log: ${JSON.stringify(SEED_HISTORY)}`, FALLBACK_AGENT_REASONING.wellbeing),
    safeCall(SYSTEM_PROMPTS.consequence, userMessage, FALLBACK_AGENT_REASONING.consequence),
  ]);

  const positions = {
    efficiency: { agentName: 'Efficiency', reasoning: efficiency },
    wellbeing: { agentName: 'Wellbeing', reasoning: wellbeing },
    consequence: { agentName: 'Consequence', reasoning: consequence },
  };

  const synthMessage = `Efficiency Agent said: "${efficiency}"\nWellbeing Agent said: "${wellbeing}"\nConsequence Agent said: "${consequence}"\n\nOriginal task list: ${taskListStr}`;
  let synthRaw: string;
  try {
    synthRaw = await callAgent(SYSTEM_PROMPTS.synthesizer, synthMessage);
  } catch (err) {
    console.error('Synthesizer API call failed, using fallback verdict:', err);
    return { positions, verdict: FALLBACK_VERDICT };
  }

  let verdict: Verdict;
  try {
    const cleaned = synthRaw.replace(/```json|```/g, '').trim();
    verdict = JSON.parse(cleaned);
    if (!verdict.chosenOption || !Array.isArray(verdict.updatedTaskList)) {
      throw new Error('Malformed verdict shape');
    }
  } catch (err) {
    console.error('Synthesizer JSON parse failed, using fallback verdict:', err);
    verdict = FALLBACK_VERDICT;
  }

  return { positions, verdict };
}

export async function runEnforcer(
  overriddenPoint: string,
  userReason: string,
  relevantAgentKey: 'efficiency' | 'wellbeing' | 'consequence'
): Promise<string> {
  const pattern = SEED_HISTORY.find(h => h.relevantAgent === relevantAgentKey)?.pattern || 'no strong pattern on record';
  const agentNameMap: Record<string, string> = { efficiency: 'Efficiency', wellbeing: 'Wellbeing', consequence: 'Consequence' };
  const filledPrompt = SYSTEM_PROMPTS.enforcer
    .replace('{AGENT_NAME}', agentNameMap[relevantAgentKey] || 'Wellbeing')
    .replace('{OVERRIDDEN_POINT}', overriddenPoint)
    .replace('{USER_REASON}', userReason)
    .replace('{PATTERN}', pattern);

  try {
    return await callAgent(filledPrompt, `The user wants to override: "${overriddenPoint}". Their reason: "${userReason}"`);
  } catch (err) {
    console.error('Enforcer API call failed:', err);
    return `Based on your pattern — ${pattern} — I stand by the original verdict on "${overriddenPoint}".`;
  }
}