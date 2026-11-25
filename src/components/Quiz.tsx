import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, RotateCcw, Trophy } from 'lucide-react';
import type { QuizQuestion } from '../types';
import { useProgress } from '../store/progress';

export function Quiz({ id, questions }: { id: string; questions: QuizQuestion[] }) {
  const { saveQuiz, quizzes } = useProgress();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAnswers(questions.map(() => null));
    setSaved(false);
  }, [id, questions]);

  const answered = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === questions[i].answer).length;
  const done = answered === questions.length;

  useEffect(() => {
    if (done && !saved) {
      saveQuiz(id, correct, questions.length);
      setSaved(true);
    }
  }, [done, saved, saveQuiz, id, correct, questions.length]);

  const best = quizzes[id];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-muted">
          {answered}/{questions.length} answered · {correct} correct
        </span>
        {best && (
          <span className="flex items-center gap-1 text-muted">
            <Trophy size={14} className="text-warn" /> Best: {best.score}/{best.total}
          </span>
        )}
      </div>
      {questions.map((q, qi) => {
        const a = answers[qi];
        const isAnswered = a !== null;
        return (
          <div key={qi} className="card p-4">
            <div className="text-[14px] font-medium">
              <span className="text-accent mono mr-2">Q{qi + 1}.</span>
              {q.q}
            </div>
            <div className="mt-3 grid gap-2">
              {q.options.map((opt, oi) => {
                const chosen = a === oi;
                const isRight = oi === q.answer;
                let cls = 'border-line hover:border-faint hover:bg-panel2';
                if (isAnswered) {
                  if (isRight) cls = 'border-ok/60 bg-ok/10';
                  else if (chosen) cls = 'border-bad/60 bg-bad/10';
                  else cls = 'border-line opacity-60';
                }
                return (
                  <button
                    key={oi}
                    disabled={isAnswered}
                    onClick={() => setAnswers((prev) => prev.map((x, i) => (i === qi ? oi : x)))}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${cls}`}
                  >
                    <span className="mono text-faint w-4 shrink-0">{String.fromCharCode(65 + oi)}</span>
                    <span className="flex-1">{opt}</span>
                    {isAnswered && isRight && <CircleCheck size={16} className="text-ok shrink-0" />}
                    {isAnswered && chosen && !isRight && <CircleX size={16} className="text-bad shrink-0" />}
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <div className={`mt-3 rounded-lg border p-3 text-[13px] leading-relaxed ${a === q.answer ? 'border-ok/30 bg-ok/5' : 'border-bad/30 bg-bad/5'}`}>
                <div className="font-semibold mb-1">{a === q.answer ? 'Correct!' : 'Not quite.'}</div>
                {a !== q.answer && q.why?.[a!] && (
                  <p className="text-muted mb-1">
                    <span className="text-ink">Why “{q.options[a!]}” is wrong:</span> {q.why[a!]}
                  </p>
                )}
                <p className="text-muted">
                  <span className="text-ink">Answer: {q.options[q.answer]}.</span> {q.explain}
                </p>
              </div>
            )}
          </div>
        );
      })}
      {done && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-lg font-bold">
              Score: {correct}/{questions.length}
            </div>
            <div className="text-[13px] text-muted">
              {correct === questions.length ? 'Perfect – you have mastered this module.' : correct / questions.length >= 0.7 ? 'Good job! Review the explanations for the ones you missed.' : 'Revisit the concepts and animations above, then try again.'}
            </div>
          </div>
          <button
            className="btn"
            onClick={() => {
              setAnswers(questions.map(() => null));
              setSaved(false);
            }}
          >
            <RotateCcw size={14} /> Retry quiz
          </button>
        </div>
      )}
    </div>
  );
}
