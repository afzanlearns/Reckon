import { useState } from 'react';
import {
  buildTimeline, generateReminder, fireBrowserNotification,
  generateICS, downloadICS, analyzeChanges,
  buildFocusSession, generateSuggestedMessage,
  type TimedTask, type TaskItem,
} from '../assistant/automation';
import { getPersonalizationNote } from '../assistant/personalization';

interface FinalDecision {
  decision: string;
  taskList: TaskItem[];
  originalTaskList: TaskItem[];
  confidence: number;
  rationale: string;
}

interface Props {
  finalDecision: FinalDecision;
}

const STAGES = [
  'Optimizing today\'s schedule…',
  'Reordering priorities…',
  'Preparing reminder…',
  'Building timeline…',
  'Personalizing your plan…',
  'Ready.',
];

export default function AssistantPanel({ finalDecision }: Props) {
  const [timeline, setTimeline] = useState<TimedTask[] | null>(null);
  const [stageIndex, setStageIndex] = useState(-1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const handleActivate = () => {
    setStageIndex(0);
    setCompletedStages([]);

    const tasks: TimedTask[] = finalDecision.taskList.map(t => ({
      id: t.id, title: t.title, estTimeMin: t.estTimeMin,
      urgency: t.urgency, status: t.status,
      start: new Date(), end: new Date(),
    }));

    const built = buildTimeline(tasks);
    const reminder = generateReminder(built);

    const actions = [
      () => {},
      () => {},
      () => fireBrowserNotification(reminder),
      () => setTimeline(built),
      () => {},
    ];

    STAGES.forEach((_, i) => {
      setTimeout(() => {
        if (actions[i]) actions[i]();
        setCompletedStages(prev => [...prev, i]);
        setStageIndex(i + 1);
      }, i * 260);
    });
  };

  const handleDownload = () => {
    if (!timeline) return;
    downloadICS(generateICS(timeline));
  };

  const copyPlanToClipboard = (kept: TaskItem[]) => {
    const text = "Today's Plan\n" + kept.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const note = getPersonalizationNote();
  const isRunning = stageIndex >= 0 && stageIndex < STAGES.length;
  const isDone = stageIndex >= STAGES.length;

  const { changes, kept, deferred } = isDone && timeline
    ? analyzeChanges(finalDecision.originalTaskList, finalDecision.taskList)
    : { changes: [], kept: [], deferred: [] };

  const focusSession = isDone && timeline ? buildFocusSession(kept) : null;
  const suggestedMessage = isDone && timeline ? generateSuggestedMessage(deferred, kept) : null;

  const totalMinutes = kept.reduce((sum, t) => sum + t.estTimeMin, 0);
  const lastTask = timeline?.[timeline.length - 1];
  const estimatedCompletion = lastTask
    ? lastTask.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="bg-[#1D1F26] border border-[#2A2D38] px-6 py-5 mt-8">
      <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#5FA8A0] mb-3">
        Action Center
      </p>

      {stageIndex === -1 && (
        <>
          <p className="text-sm text-[#F5F3EE] italic mb-4">{note}</p>
          <button
            onClick={handleActivate}
            className="font-mono-label text-xs tracking-widest uppercase
                       bg-[#5FA8A0] text-[#14151A] px-5 py-2.5 hover:bg-[#7BC3BA] transition-colors"
          >
            Execute Ruling
          </button>
        </>
      )}

      {(isRunning || isDone) && (
        <div className="space-y-1.5 mb-4">
          {STAGES.map((label, i) => {
            const done = completedStages.includes(i);
            const active = i === stageIndex && !done;
            return (
              <div
                key={label}
                className={`text-sm font-mono-label flex items-center gap-2 transition-opacity duration-200
                  ${done ? 'text-[#5FA8A0] opacity-100' : active ? 'text-[#F5F3EE] opacity-100' : 'text-[#6B6E7A] opacity-0'}`}
              >
                <span>{done ? '✓' : active ? '…' : ''}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {isDone && timeline && (
        <>
          <div className="border-t border-[#2A2D38] pt-4 mb-5">
            <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE] mb-3">
              Actions Completed
            </p>
            <div className="space-y-1.5 text-sm text-[#F5F3EE]">
              {changes.map((c, i) => <p key={i}>✓ {c}</p>)}
              <p>✓ Reserved {totalMinutes} minutes for today's work</p>
              {estimatedCompletion && <p>✓ Estimated completion: {estimatedCompletion}</p>}
              <p>✓ Reminder prepared</p>
              <p>✓ Calendar schedule generated</p>
            </div>
          </div>

          <div className="border-t border-[#2A2D38] pt-4 mb-5">
            <div className="flex justify-between items-center mb-3">
              <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE]">
                Today's Plan
              </p>
              <button
                onClick={() => copyPlanToClipboard(kept)}
                className="font-mono-label text-[10px] tracking-widest uppercase text-[#5FA8A0] hover:text-[#7BC3BA]"
              >
                {copied ? 'Copied' : 'Copy Plan'}
              </button>
            </div>
            <ol className="space-y-1.5 text-sm text-[#F5F3EE] list-decimal list-inside">
              {kept.map(t => <li key={t.id}>{t.title}</li>)}
            </ol>
          </div>

          <div className="border-t border-[#2A2D38] pt-4 mb-5">
            <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE] mb-3">
              Today's Checklist
            </p>
            <div className="space-y-1.5 text-sm text-[#F5F3EE]">
              {kept.map(t => (
                <p key={t.id} className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-[#5FA8A0] inline-block shrink-0" /> {t.title}
                </p>
              ))}
            </div>
            {deferred.length > 0 && (
              <>
                <p className="font-mono-label text-[10px] tracking-widest uppercase text-[#6B6E7A] mt-4 mb-1">
                  Deferred
                </p>
                {deferred.map(t => (
                  <p key={t.id} className="text-sm text-[#6B6E7A] line-through">{t.title}</p>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-[#2A2D38] pt-4 mb-5">
            <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE] mb-3">
              Changes Made
            </p>
            <div className="space-y-1 text-sm text-[#F5F3EE]">
              {changes.map((c, i) => <p key={i}>• {c}</p>)}
              {changes.length === 0 && <p className="text-[#6B6E7A]">No changes — plan was already optimal.</p>}
            </div>
          </div>

          <div className="border-t border-[#2A2D38] pt-4 mb-5">
            <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE] mb-2">
              Reminder Ready
            </p>
            <p className="text-sm text-[#F5F3EE]">Next Task: {kept[0]?.title}</p>
            <p className="text-sm text-[#6B6E7A]">Starts now — estimated {kept[0]?.estTimeMin} minutes</p>
          </div>

          <div className="border-t border-[#2A2D38] pt-4">
            <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE] mb-2">
              Calendar Ready
            </p>
            <p className="text-sm text-[#6B6E7A] mb-3">Import into your preferred calendar.</p>
            <button
              onClick={handleDownload}
              className="font-mono-label text-xs tracking-widest uppercase
                         border border-[#5FA8A0] text-[#5FA8A0] px-5 py-2.5
                         hover:bg-[#5FA8A0] hover:text-[#14151A] transition-colors"
            >
              Download .ics
            </button>
          </div>

          {focusSession && (
            <div className="border-t border-[#2A2D38] pt-4 mb-5">
              <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#E8A33D] mb-3">
                Focus Session
              </p>
              <div className="bg-[#14151A] border border-[#2A2D38] px-4 py-3 space-y-2">
                <p className="text-sm text-[#F5F3EE] font-medium">{focusSession.task}</p>
                <p className="text-sm text-[#6B6E7A]">{focusSession.duration} minutes</p>
                <div className="pt-1 space-y-0.5">
                  {focusSession.recommendations.map((r, i) => (
                    <p key={i} className="text-xs text-[#6B6E7A]">• {r}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {suggestedMessage && (
            <div className="border-t border-[#2A2D38] pt-4 mb-5">
              <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#7C6FE0] mb-3">
                Suggested Message
              </p>
              <div className="bg-[#14151A] border border-[#2A2D38] px-4 py-3 mb-3">
                <p className="text-sm text-[#F5F3EE] whitespace-pre-wrap">{suggestedMessage.message}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(suggestedMessage.message);
                  setMessageCopied(true);
                  setTimeout(() => setMessageCopied(false), 1500);
                }}
                className="font-mono-label text-xs tracking-widest uppercase
                           border border-[#7C6FE0] text-[#7C6FE0] px-4 py-2
                           hover:bg-[#7C6FE0] hover:text-[#14151A] transition-colors"
              >
                {messageCopied ? 'Copied' : 'Copy Message'}
              </button>
            </div>
          )}

          <p className="border-t border-[#2A2D38] pt-5 text-sm text-[#6B6E7A] text-center italic">
            Your day has been reorganized. You're ready to start.
          </p>
        </>
      )}
    </div>
  );
}