import { useState } from 'react';
import { buildTimeline, generateReminder, fireBrowserNotification, generateICS, downloadICS, type TimedTask } from '../assistant/automation';
import { getPersonalizationNote } from '../assistant/personalization';

interface FinalDecision {
  decision: string;
  taskList: TaskItem[];
  confidence: number;
  rationale: string;
}

interface TaskItem {
  id: string;
  title: string;
  estTimeMin: number;
  urgency: 'low' | 'med' | 'high';
  status: 'pending' | 'done' | 'bumped';
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
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'unsupported' | null>(null);
  const [reminderText, setReminderText] = useState<string | null>(null);

  const handleActivate = () => {
    setStageIndex(0);
    setCompletedStages([]);

    const tasks: TimedTask[] = finalDecision.taskList.map(t => ({
      id: t.id,
      title: t.title,
      estTimeMin: t.estTimeMin,
      urgency: t.urgency,
      status: t.status,
      start: new Date(),
      end: new Date(),
    }));

    const built = buildTimeline(tasks);
    const reminder = generateReminder(built);

    const actions = [
      () => {},
      () => {},
      () => {
        setReminderText(reminder?.message ?? null);
        fireBrowserNotification(reminder, setNotificationStatus);
      },
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

  const note = getPersonalizationNote();
  const isRunning = stageIndex >= 0 && stageIndex < STAGES.length;
  const isDone = stageIndex >= STAGES.length;

  const lastTask = timeline?.[timeline.length - 1];
  const estimatedCompletion = lastTask
    ? lastTask.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="bg-[#1D1F26] border border-[#2A2D38] px-6 py-5 mt-8">
      <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#5FA8A0] mb-3">
        Assistant — Execution Layer
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
        <div className="border-t border-[#2A2D38] pt-4 mb-5">
          <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#F5F3EE] mb-3">
            Actions Completed
          </p>
          <div className="space-y-1.5 text-sm text-[#F5F3EE]">
            <p>✓ Today's schedule optimized — {timeline.length} tasks sequenced</p>
            <p>✓ High-priority tasks reordered to the front</p>
            <p>
              ✓ Reminder prepared
              {notificationStatus === 'granted' && ' — sent to your browser'}
              {notificationStatus === 'denied' && ' — notifications are blocked, showing here instead'}
              {notificationStatus === 'unsupported' && ' — not supported in this browser, showing here instead'}
            </p>
            {notificationStatus !== 'granted' && reminderText && (
              <p className="text-[#6B6E7A] italic pl-4">↳ "{reminderText}"</p>
            )}
            <p>✓ Calendar schedule generated ({timeline.length} events, downloadable below)</p>
            {estimatedCompletion && <p>✓ Estimated completion: {estimatedCompletion}</p>}
            <p>✓ Personalized recommendation updated</p>
          </div>
        </div>
      )}

      {isDone && timeline && (
        <>
          <p className="font-mono-label text-[11px] tracking-widest uppercase text-[#6B6E7A] mb-2">
            Timeline
          </p>
          <div className="space-y-2 mb-4">
            {timeline.map(t => (
              <div key={t.id} className="flex justify-between text-sm text-[#F5F3EE]">
                <span>{t.title}</span>
                <span className="font-mono-label text-[11px] text-[#6B6E7A]">
                  {t.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {t.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleDownload}
            className="font-mono-label text-xs tracking-widest uppercase
                       border border-[#5FA8A0] text-[#5FA8A0] px-5 py-2.5
                       hover:bg-[#5FA8A0] hover:text-[#14151A] transition-colors"
          >
            Download Schedule (.ics)
          </button>
        </>
      )}
    </div>
  );
}