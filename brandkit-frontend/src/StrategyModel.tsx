import React, { useEffect, useState, useRef } from 'react';
import Dashboard from './Dashboard';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

// --- Types ---
type Step = { id: string; name: string; prompt: string };
type Section = { section: string; steps: Step[] };
type Answers = { [stepId: string]: { answer: string; feedback: string; score: number } };
type Project = { id: string; name: string; answers: Answers };

const fontFamily = 'Inter, system-ui, Arial, sans-serif';

const palette = {
  bg: '#fff',
  text: '#181a1b',
  card: '#f7f7f8',
  border: '#e5e5e7',
  stepActive: '#222',
  stepInactive: '#bbb',
  stepCompleted: '#222',
  check: '#2ecc40',
  tabActive: '#222',
  tabInactive: '#bbb',
  progress: '#2ecc40',
  warning: '#ffb300',
  error: '#e74c3c',
  sidebar: '#23272e',
  sidebarText: '#fff',
  sidebarActive: '#2ecc40',
};

const PROJECTS_STORAGE_KEY = 'brandkit-projects';

const getSectionStatus = (section: Section, answers: Answers) => {
  const total = section.steps.length;
  const completed = section.steps.filter((s: Step) => answers[s.id]).length;
  const scores = section.steps.map((s: Step) => answers[s.id]?.score).filter((s: number | undefined) => typeof s === 'number') as number[];
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
  let status: 'ok' | 'incomplete' | 'attention' = 'ok';
  if (completed < total) status = 'incomplete';
  else if (avgScore !== null && avgScore < 70) status = 'attention';
  return { completed, total, avgScore, status };
};

const StarRating: React.FC<{ score: number; maxStars?: number }> = ({ score, maxStars = 5 }) => {
  const stars = [];
  const filledStars = Math.round((score / 100) * maxStars);
  
  for (let i = 0; i < maxStars; i++) {
    stars.push(
      <span key={i} style={{ 
        fontSize: '1.2rem', 
        color: i < filledStars ? '#FFD700' : '#E0E0E0',
        marginRight: 2
      }}>
        ★
      </span>
    );
  }
  
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{score}%</span>
    <div>{stars}</div>
  </div>;
};

const ProgressBar: React.FC<{ percent: number; color?: string; height?: number }> = ({ percent, color = palette.progress, height = 10 }) => (
  <div style={{ background: palette.border, borderRadius: 8, height, width: '100%' }}>
    <div style={{ width: `${percent}%`, background: color, height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
  </div>
);

const SIDEBAR_WIDTH = 260;

const StrategyModel: React.FC = () => {
  // Projects state
  const [projects, setProjects] = useState<Project[]>(() => {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);

  // BrandKit state
  const [data, setData] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [tab, setTab] = useState<'home' | 'overview' | 'editor'>('home');
  const [editingAnswers, setEditingAnswers] = useState<{ [stepId: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<{ [stepId: string]: string | null }>({});
  const sectionNavRef = useRef<HTMLDivElement | null>(null);

  // Feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Overview state
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [sectionConclusions, setSectionConclusions] = useState<{ [section: string]: string }>({});
  const [overallConclusion, setOverallConclusion] = useState('');

  // Load BrandKit model
  useEffect(() => {
            fetch('https://brandkit-production.up.railway.app/api/strategy')
      .then((res) => res.json())
      .then((sections: Section[]) => {
        setData(sections);
        setLoading(false);
      });
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  // Set first project as active on load if none is active
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  // Get active project and answers
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const answers: Answers = activeProject ? activeProject.answers : {};

  // Keep editingAnswers in sync with answers
  useEffect(() => {
    const newEditing: { [stepId: string]: string } = {};
    for (const section of data) {
      for (const step of section.steps) {
        newEditing[step.id] = answers[step.id]?.answer || '';
      }
    }
    setEditingAnswers(newEditing);
  }, [answers, data, activeProjectId]);

  // Progress calculations
  const totalSteps = data.reduce((sum, section) => sum + section.steps.length, 0);
  const completedSteps = Object.keys(answers).length;
  const percentComplete = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Tab styles
  const tabStyle = (active: boolean) => ({
    padding: '0.7rem 2rem',
    cursor: 'pointer',
    border: 'none',
    borderBottom: active ? `3px solid ${palette.tabActive}` : '3px solid transparent',
    background: 'none',
    color: active ? palette.tabActive : palette.tabInactive,
    fontWeight: active ? 'bold' : 'normal',
    fontSize: '1.1rem',
    outline: 'none',
    fontFamily,
    marginRight: '1rem',
    transition: 'color 0.2s',
    letterSpacing: 1,
  });

  // Section horizontal nav for Editor
  const sectionNav = (
    <div ref={sectionNavRef} style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', overflowX: 'auto' }}>
      {data.map((section, idx) => (
        <button
          key={section.section}
          onClick={() => setSelectedSectionIdx(idx)}
          style={{
            background: idx === selectedSectionIdx ? palette.stepActive : palette.card,
            color: idx === selectedSectionIdx ? palette.bg : palette.stepActive,
            border: idx === selectedSectionIdx ? `2px solid ${palette.progress}` : `1.5px solid ${palette.border}`,
            borderRadius: 10,
            fontWeight: idx === selectedSectionIdx ? 700 : 500,
            fontSize: '1.1rem',
            padding: '0.8rem 2.2rem',
            cursor: 'pointer',
            fontFamily,
            boxShadow: idx === selectedSectionIdx ? '0 2px 8px rgba(0,0,0,0.07)' : undefined,
            transition: 'all 0.2s',
            outline: 'none',
            minWidth: 160,
          }}
        >
          {section.section}
        </button>
      ))}
    </div>
  );

  // Editor: handle answer change
  const handleAnswerChange = (stepId: string, value: string) => {
    setEditingAnswers((prev) => ({ ...prev, [stepId]: value }));
  };

  // Editor: handle save
  const handleSave = async (step: Step) => {
    setSubmitting(true);
    setEditingFeedback((prev) => ({ ...prev, [step.id]: null }));
    try {
      const res = await fetch('https://brandkit-production.up.railway.app/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id, answer: editingAnswers[step.id] ?? '' }),
      });
      const dataRes = await res.json();
      // Update answers for active project
      setProjects((prev) =>
        prev.map((proj) =>
          proj.id === activeProjectId
            ? {
                ...proj,
                answers: {
                  ...proj.answers,
                  [step.id]: {
                    answer: editingAnswers[step.id] ?? '',
                    feedback: dataRes.feedback,
                    score: dataRes.score,
                  },
                },
              }
            : proj
        )
      );
      setEditingFeedback((prev) => ({ ...prev, [step.id]: `${dataRes.feedback} (Score: ${dataRes.score}%)` }));
    } catch (err) {
      setEditingFeedback((prev) => ({ ...prev, [step.id]: 'Error submitting answer.' }));
    }
    setSubmitting(false);
  };

  // Editor: handle cancel
  const handleCancel = (step: Step) => {
    setEditingAnswers((prev) => ({ ...prev, [step.id]: answers[step.id]?.answer || '' }));
    setEditingFeedback((prev) => ({ ...prev, [step.id]: null }));
  };

  // Project actions
  const handleNewProject = () => {
    setShowNewProjectModal(true);
    setNewProjectName('');
  };
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const newProj: Project = { id: uuidv4(), name: newProjectName.trim(), answers: {} };
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setShowNewProjectModal(false);
    setSelectedSectionIdx(0);
    setTab('editor'); // Jump directly to editor
  };
  const handleSwitchProject = (id: string) => {
    setActiveProjectId(id);
    setSelectedSectionIdx(0);
  };

  const handleDeleteProject = (id: string) => {
    if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      setProjects((prev) => prev.filter((proj) => proj.id !== id));
      if (activeProjectId === id) {
        // Switch to next available project or none
        const remaining = projects.filter((proj) => proj.id !== id);
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Overview: section status
  const sectionStatuses = data.map((section) => getSectionStatus(section, answers));

  // Fetch AI-powered overview feedback when answers or data change (debounced)
  useEffect(() => {
    let cancelled = false;
    async function fetchOverviewFeedback() {
      setOverviewLoading(true);
      setSectionConclusions({});
      setOverallConclusion('');
      try {
        const res = await fetch('https://brandkit-production.up.railway.app/api/overview-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, sections: data }),
        });
        const json = await res.json();
        if (!cancelled) {
          setSectionConclusions(json.sectionConclusions || {});
          setOverallConclusion(json.overallConclusion || '');
        }
      } catch (e) {
        if (!cancelled) {
          setSectionConclusions({});
          setOverallConclusion('AI feedback unavailable.');
        }
      }
      if (!cancelled) setOverviewLoading(false);
    }
    if (Object.keys(answers).length > 0 && data.length > 0) {
      fetchOverviewFeedback();
    } else {
      setSectionConclusions({});
      setOverallConclusion('');
    }
    return () => { cancelled = true; };
  }, [answers, data]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackSubmitting(true);
    // Replace the endpoint below with your Formspree endpoint after first test
    const endpoint = 'https://formspree.io/f/xwkgyyqg';
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: feedbackMessage,
        email: feedbackEmail,
      }),
    });
    setFeedbackSubmitting(false);
    setFeedbackSent(true);
    setFeedbackMessage('');
    setFeedbackEmail('');
    setTimeout(() => {
      setShowFeedbackModal(false);
      setFeedbackSent(false);
    }, 2000);
  };

  if (loading) return <div style={{ fontFamily }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: palette.bg, color: palette.text, fontFamily, display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: SIDEBAR_WIDTH,
        minHeight: '100vh',
        background: palette.sidebar,
        color: palette.sidebarText,
        padding: '2.5rem 1rem 2rem 1.5rem',
        borderRight: `1.5px solid ${palette.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        position: 'sticky',
        left: 0,
        top: 0,
        zIndex: 10,
      }}>
        <h2 style={{ color: palette.sidebarText, fontSize: '1.3rem', marginBottom: '2.5rem', letterSpacing: 1, fontWeight: 700 }}>Projects</h2>
        <button
          onClick={handleNewProject}
          style={{
            background: palette.progress,
            color: palette.bg,
            border: 'none',
            borderRadius: 10,
            padding: '0.8rem 1.5rem',
            fontWeight: 'bold',
            fontSize: '1.05rem',
            cursor: 'pointer',
            marginBottom: '2rem',
            fontFamily,
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            letterSpacing: 1,
            transition: 'background 0.2s',
            width: '100%',
          }}
        >
          + New Project
        </button>
        <div style={{ flex: 1, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: palette.sidebarText, opacity: 0.7, letterSpacing: 1, fontSize: '1.05rem' }}>My Projects</span>
            <button
              onClick={() => setProjectsCollapsed((c) => !c)}
              style={{
                background: 'none',
                border: 'none',
                color: palette.sidebarText,
                fontSize: '1.2rem',
                marginLeft: 8,
                cursor: 'pointer',
                opacity: 0.7,
              }}
              aria-label={projectsCollapsed ? 'Expand projects' : 'Collapse projects'}
            >
              {projectsCollapsed ? '▶' : '▼'}
            </button>
          </div>
          {!projectsCollapsed && (
            <>
              {projects.length === 0 && <div style={{ color: palette.sidebarText, opacity: 0.7 }}>No projects yet.</div>}
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}
                >
                  <div
                    onClick={() => handleSwitchProject(proj.id)}
                    style={{
                      background: 'transparent',
                      color: palette.sidebarText,
                      fontWeight: proj.id === activeProjectId ? 700 : 400,
                      fontSize: '1.05rem',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      border: 'none',
                      outline: 'none',
                      width: '100%',
                      textAlign: 'left',
                      paddingLeft: 18,
                    }}
                  >
                    {proj.name}
                  </div>
                  <button
                    onClick={() => handleDeleteProject(proj.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: palette.sidebarText,
                      fontSize: '1.1rem',
                      marginLeft: 4,
                      cursor: 'pointer',
                      opacity: 0.7,
                    }}
                    aria-label="Delete project"
                    title="Delete project"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
      {/* Main content area */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem', flex: 1 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '1.5rem 2rem 0.5rem 2rem', borderBottom: `1px solid ${palette.border}` }}>
          <button style={tabStyle(tab === 'home')} onClick={() => setTab('home')}>Home</button>
          <button style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
          <button style={tabStyle(tab === 'editor')} onClick={() => setTab('editor')}>Editor</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: palette.sidebar,
              color: palette.sidebarText,
              border: 'none',
              borderRadius: 10,
              padding: '0.8rem 1.7rem',
              fontWeight: 'bold',
              fontSize: '1.05rem',
              cursor: 'pointer',
              marginLeft: '2rem',
              fontFamily,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              letterSpacing: 1,
              transition: 'background 0.2s',
            }}
          >
            Send Feedback
          </button>
          <img 
            src="/logo.png" 
            alt="Got Brand?" 
            style={{ 
              height: '2rem', 
              width: 'auto', 
              marginLeft: '1rem',
              cursor: 'pointer'
            }} 
            title="Got Brand?"
          />
        </div>
        {tab === 'home' && (
          <div style={{ maxWidth: 700, margin: '3rem auto 0 auto', background: palette.card, borderRadius: 18, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: `1.5px solid ${palette.border}`, padding: '2.5rem 2rem' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '1.2rem', letterSpacing: 1 }}>Welcome to Got Brand?</h1>
            <p style={{ fontSize: '1.15rem', color: palette.text, marginBottom: '1.5rem', lineHeight: 1.6 }}>
              your all-in-one workspace for building, refining, and managing winning brand strategy. Whether you’re a founder, marketer, or creative, BrandKit helps you structure your thinking and track progress when creating a brand that stands out.
            </p>
            <ul style={{ fontSize: '1.08rem', color: palette.text, marginBottom: '2rem', lineHeight: 1.7, paddingLeft: 24 }}>
              <li><strong>Create a project</strong> to start your structured brand strategy journey. Projects are saved automatically and can be revisited anytime.</li>
              <li><strong>Use the Editor</strong> to work through each section of your brand strategy, step by step. Get instant feedback and scoring as you go.</li>
              <li><strong>Check the Overview</strong> to track your progress, work quality, suggestions, and where to focus next.</li>
            </ul>
            <div style={{ fontSize: '1.08rem', color: palette.text, marginBottom: '2rem', background: '#f6f6f6', borderRadius: 10, padding: '1.2rem', border: `1.5px solid ${palette.border}` }}>
              <strong>Tip:</strong> The more thoughtfully you answer each step, the more valuable your brand strategy will become. Don’t rush—BrandKit is here to help you build something meaningful.
            </div>
            <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
              <button
                onClick={handleNewProject}
                style={{
                  background: palette.progress,
                  color: palette.bg,
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.9rem 2.5rem',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  letterSpacing: 1,
                  transition: 'background 0.2s',
                }}
              >
                + New Project
              </button>
            </div>
          </div>
        )}
        {tab === 'overview' && (
          <>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', letterSpacing: 1 }}>Got Brand? Overview</h2>
            {overviewLoading ? (
              <div style={{ marginBottom: '2rem', fontSize: '1.15rem', color: palette.stepInactive }}>Generating AI summary...</div>
            ) : overallConclusion ? (
              <div style={{ marginBottom: '2.5rem', background: palette.card, borderRadius: 16, padding: '2rem', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: `1.5px solid ${palette.border}`, fontSize: '1.15rem', color: palette.text }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <strong>AI Overall Conclusion:</strong>
                  {(() => {
                    const totalScore = sectionStatuses.reduce((sum, section) => sum + (section.avgScore || 0), 0);
                    const avgScore = sectionStatuses.length > 0 ? Math.round(totalScore / sectionStatuses.length) : 0;
                    return <StarRating score={avgScore} />;
                  })()}
                </div>
                <div style={{ fontStyle: 'italic', lineHeight: 1.7 }}>{overallConclusion}</div>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              {data.map((section, idx) => {
                const { completed, total, avgScore, status } = sectionStatuses[idx];
                let borderColor = palette.border;
                let highlight = '';
                if (status === 'incomplete') {
                  borderColor = palette.warning;
                  highlight = 'Needs completion';
                } else if (status === 'attention') {
                  borderColor = palette.error;
                  highlight = 'Needs improvement';
                }
                return (
                  <div key={section.section} style={{
                    flex: '1 1 350px',
                    background: palette.card,
                    borderRadius: 16,
                    padding: '2rem',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
                    border: `2px solid ${borderColor}`,
                    minWidth: 320,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: '1.15rem', flex: 1 }}>{section.section}</span>
                      {status === 'incomplete' && <span style={{ color: palette.warning, fontWeight: 700 }}>{highlight}</span>}
                      {status === 'attention' && <span style={{ color: palette.error, fontWeight: 700 }}>{highlight}</span>}
                      {status === 'ok' && <span style={{ color: palette.check, fontWeight: 700 }}>✔</span>}
                    </div>
                    <div style={{ marginBottom: 10, fontWeight: 500, color: palette.text }}>
                      {completed} / {total} steps completed
                    </div>
                    <ProgressBar percent={Math.round((completed / total) * 100)} color={palette.progress} height={8} />
                    <div style={{ marginTop: 12 }}>
                      {avgScore !== null ? <StarRating score={avgScore} /> : <span style={{ fontWeight: 600, fontSize: '1.1rem', color: palette.stepInactive }}>No score yet</span>}
                    </div>
                    {overviewLoading ? (
                      <div style={{ marginTop: 18, color: palette.stepInactive, fontStyle: 'italic' }}>Generating AI summary...</div>
                    ) : sectionConclusions[section.section] ? (
                      <div style={{ marginTop: 18, color: palette.text, background: '#f6f6f6', borderRadius: 10, padding: '1.1rem', border: `1.5px solid ${palette.border}`, fontStyle: 'italic', lineHeight: 1.6 }}>
                        <strong>AI Conclusion:</strong>
                        <div style={{ marginTop: 6 }}>{sectionConclusions[section.section]}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === 'editor' && (
          <>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', letterSpacing: 1 }}>Got Brand? Editor</h2>
            {sectionNav}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {data[selectedSectionIdx].steps.map((step: Step, stepIdx: number) => {
                const answered = answers[step.id];
                return (
                  <div key={step.id} style={{
                    background: palette.card,
                    borderRadius: 16,
                    padding: '2rem',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
                    border: `1.5px solid ${palette.border}`,
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: '1.15rem', flex: 1 }}>{step.name}</span>
                      {answered && <span style={{ color: palette.check, fontWeight: 700, marginLeft: 10 }}>✔</span>}
                    </div>
                    <div style={{ marginBottom: 18, color: palette.stepInactive, fontWeight: 500 }}>{step.prompt}</div>
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        handleSave(step);
                      }}
                    >
                      <textarea
                        value={editingAnswers[step.id] ?? ''}
                        onChange={e => handleAnswerChange(step.id, e.target.value)}
                        rows={4}
                        style={{
                          width: '100%',
                          marginBottom: '1.2rem',
                          fontSize: '1.1rem',
                          padding: '1.2rem',
                          borderRadius: 10,
                          border: `1.5px solid ${palette.border}`,
                          background: '#fafbfc',
                          color: palette.text,
                          fontFamily,
                          outline: 'none',
                          resize: 'vertical',
                        }}
                        placeholder="Type your answer here..."
                        required
                      />
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button
                          type="submit"
                          disabled={submitting}
                          style={{
                            background: palette.stepActive,
                            color: palette.bg,
                            border: 'none',
                            borderRadius: 10,
                            padding: '0.8rem 2.2rem',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                            letterSpacing: 1,
                            transition: 'background 0.2s',
                          }}
                        >
                          {submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(step)}
                          style={{
                            background: palette.border,
                            color: palette.text,
                            border: 'none',
                            borderRadius: 10,
                            padding: '0.8rem 2.2rem',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                            letterSpacing: 1,
                            transition: 'background 0.2s',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      {editingFeedback[step.id] && (
                        <div style={{
                          marginTop: '1.2rem',
                          background: '#f6f6f6',
                          padding: '1.2rem',
                          borderRadius: '10px',
                          color: palette.text,
                          fontSize: '1.1rem',
                          border: `1.5px solid ${palette.border}`,
                        }}>
                          <strong>Feedback:</strong> {editingFeedback[step.id]}
                        </div>
                      )}
                    </form>
                    {/* Next Section button after the last step */}
                    {stepIdx === data[selectedSectionIdx].steps.length - 1 && selectedSectionIdx < data.length - 1 && (
                      <div style={{ textAlign: 'right', marginTop: '2rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSectionIdx(selectedSectionIdx + 1);
                            setTimeout(() => {
                              sectionNavRef.current?.scrollIntoView({ behavior: 'smooth' });
                            }, 0);
                          }}
                          style={{
                            background: palette.progress,
                            color: palette.bg,
                            border: 'none',
                            borderRadius: 10,
                            padding: '0.9rem 2.5rem',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                            letterSpacing: 1,
                            transition: 'background 0.2s',
                          }}
                        >
                          Next Section →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {/* New Project Modal */}
      {showNewProjectModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: palette.bg, color: palette.text, borderRadius: 16, padding: '2.5rem 2rem', minWidth: 320, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', border: `1.5px solid ${palette.border}` }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 18 }}>Create New Project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="Project name"
              style={{
                width: '100%',
                padding: '0.8rem',
                fontSize: '1.1rem',
                borderRadius: 8,
                border: `1.5px solid ${palette.border}`,
                marginBottom: 18,
                fontFamily,
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewProjectModal(false)}
                style={{
                  background: palette.border,
                  color: palette.text,
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.7rem 1.5rem',
                  fontWeight: 'bold',
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                style={{
                  background: palette.progress,
                  color: palette.bg,
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.7rem 1.5rem',
                  fontWeight: 'bold',
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                }}
                disabled={!newProjectName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {showFeedbackModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: palette.bg, color: palette.text, borderRadius: 16, padding: '2.5rem 2rem', minWidth: 340, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', border: `1.5px solid ${palette.border}` }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 18 }}>Send Feedback</h3>
            {feedbackSent ? (
              <div style={{ color: palette.progress, fontWeight: 600, fontSize: '1.1rem', textAlign: 'center' }}>Thank you for your feedback!</div>
            ) : (
              <form onSubmit={handleFeedbackSubmit}>
                <textarea
                  value={feedbackMessage}
                  onChange={e => setFeedbackMessage(e.target.value)}
                  placeholder="Your feedback..."
                  required
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.08rem',
                    borderRadius: 8,
                    border: `1.5px solid ${palette.border}`,
                    marginBottom: 14,
                    fontFamily,
                    resize: 'vertical',
                  }}
                />
                <input
                  type="email"
                  value={feedbackEmail}
                  onChange={e => setFeedbackEmail(e.target.value)}
                  placeholder="Your email (optional)"
                  style={{
                    width: '100%',
                    padding: '0.7rem',
                    fontSize: '1.05rem',
                    borderRadius: 8,
                    border: `1.5px solid ${palette.border}`,
                    marginBottom: 18,
                    fontFamily,
                  }}
                />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    style={{
                      background: palette.border,
                      color: palette.text,
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.7rem 1.5rem',
                      fontWeight: 'bold',
                      fontSize: '1.05rem',
                      cursor: 'pointer',
                    }}
                    disabled={feedbackSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: palette.progress,
                      color: palette.bg,
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.7rem 1.5rem',
                      fontWeight: 'bold',
                      fontSize: '1.05rem',
                      cursor: 'pointer',
                    }}
                    disabled={feedbackSubmitting || !feedbackMessage.trim()}
                  >
                    {feedbackSubmitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyModel;
