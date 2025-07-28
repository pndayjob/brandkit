import React from 'react';

// Types for props
export type Step = {
  id: string;
  name: string;
  prompt: string;
};

export type Section = {
  section: string;
  steps: Step[];
};

export type Answers = {
  [stepId: string]: { answer: string; feedback: string; score: number };
};

type DashboardProps = {
  data: Section[];
  answers: Answers;
};

const Dashboard: React.FC<DashboardProps> = ({ data, answers }) => {
  // Progress
  const totalSteps = data.reduce((sum, section) => sum + section.steps.length, 0);
  const completedSteps = Object.keys(answers).length;
  const percentComplete = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Section scores
  const sectionScores = data.map((section) => {
    const stepScores = section.steps
      .map((step) => answers[step.id]?.score)
      .filter((score) => typeof score === 'number');
    const avgScore =
      stepScores.length > 0
        ? Math.round(stepScores.reduce((sum, s) => sum + (s || 0), 0) / stepScores.length)
        : null;
    return { section: section.section, avgScore };
  });

  // Total score
  const allScores = Object.values(answers).map((a) => a.score);
  const totalScore = allScores.length > 0 ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length) : null;

  // Placeholder feedback (motivational)
  const feedback = totalScore
    ? totalScore > 80
      ? "Awesome work! Your brand strategy is shaping up to be truly distinctive. Keep refining those details for even more impact!"
      : totalScore > 60
      ? "Great progress! You're building a solid foundation. Review your answers for clarity and keep pushing for that extra edge."
      : "You're off to a good start! Take another look at your answers and aim for more specificity and boldness."
    : "Start filling out your strategy steps to see feedback and guidance here!";

  // Placeholder improvement guidance
  const guidance =
    percentComplete < 100
      ? "Complete all sections to unlock your full brand potential! Each step brings you closer to a compelling, investor-ready story."
      : "Review your section scores and feedback to polish your strategy. You're almost ready to shine!";

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '2rem', marginBottom: '2rem', background: '#fafbfc' }}>
      <h2>BrandKit Dashboard</h2>
      <div style={{ marginBottom: '1rem' }}>
        <strong>Progress:</strong> {completedSteps} / {totalSteps} steps completed ({percentComplete}%)
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <strong>Total Score:</strong> {totalScore !== null ? `${totalScore}%` : 'N/A'}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <strong>Section Scores:</strong>
        <ul>
          {sectionScores.map((s) => (
            <li key={s.section}>
              {s.section}: {s.avgScore !== null ? `${s.avgScore}%` : 'N/A'}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <strong>General Feedback:</strong> <span>{feedback}</span>
      </div>
      <div>
        <strong>Guidance for Improvement:</strong> <span>{guidance}</span>
      </div>
    </div>
  );
};

export default Dashboard; 