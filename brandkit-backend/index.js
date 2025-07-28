const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = 5050;

app.use(cors());
app.use(express.json());

const strategyModel = require('./data/strategyModel');

// GET /api/strategy - returns all sections and steps
app.get('/api/strategy', (req, res) => {
  res.json(strategyModel);
});

// POST /api/answer - accepts stepId and answer, returns AI feedback and score
app.post('/api/answer', async (req, res) => {
  const { stepId, answer } = req.body;
  try {
    const prompt = `Act as a seasoned and creative brand strategist and advisor. Evaluate the following brand strategy answer. Give a score from 0-100 (as 'score') for clarity, distinctiveness, and relevance, and provide a short, actionable feedback message (as 'feedback'). Be concise and punchy and limit your answer to 2-3 sentences.\n\nAnswer: "${answer}"\n\nRespond in JSON: { "score": <number>, "feedback": <string> }`;
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a seasoned brand strategist and advisor giving feedback in inspiring, motivating and creative style.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });
    const data = await openaiRes.json();
    let score = null;
    let feedback = '';
    try {
      const json = JSON.parse(data.choices[0].message.content);
      score = json.score;
      feedback = json.feedback;
    } catch (e) {
      feedback = 'Could not parse AI feedback.';
      score = Math.floor(Math.random() * 41) + 60;
    }
    res.json({ feedback, score });
  } catch (err) {
    res.status(500).json({ feedback: 'AI feedback unavailable.', score: Math.floor(Math.random() * 41) + 60 });
  }
});

// POST /api/overview-feedback - takes all answers, returns section and overall AI conclusions
app.post('/api/overview-feedback', async (req, res) => {
  const { answers, sections } = req.body; // answers: { [stepId]: { answer, score } }, sections: [{ section, steps }]
  try {
    // Section conclusions
    const sectionConclusions = {};
    for (const section of sections) {
      const stepAnswers = section.steps.map((step) => answers[step.id]?.answer || '').filter(Boolean);
      const avgScore = section.steps
        .map((step) => answers[step.id]?.score)
        .filter((s) => typeof s === 'number');
      const avg = avgScore.length > 0 ? Math.round(avgScore.reduce((a, b) => a + b, 0) / avgScore.length) : null;
      const prompt = `Act as a seasoned andcreative brand strategist. Write a short, motivating, inspiring, and actionable summary for this brand strategy section. Be concise and punchy and limit your answer to 2-3 sentences Consider the answers and the average score (${avg ?? 'N/A'}). Never discourage—always inspire further work.\n\nSection: ${section.section}\nAnswers: ${JSON.stringify(stepAnswers)}\n\nSummary:`;
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a seasoned brand strategist and advisor giving feedback in inspiring, motivating and creative style.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 180,
          temperature: 0.7,
        }),
      });
      const data = await openaiRes.json();
      sectionConclusions[section.section] = data.choices?.[0]?.message?.content?.trim() || '';
    }
    // Overall conclusion
    const allAnswers = Object.values(answers).map((a) => a.answer).filter(Boolean);
    const allScores = Object.values(answers).map((a) => a.score).filter((s) => typeof s === 'number');
    const progress = allAnswers.length;
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
    const overallPrompt = `Act as a seasoned and creative brand strategist. Write a motivating, inspiring, and actionable overall summary for this brand strategy project. Be concise and punchy and limit your answer to 2-3 sentences Consider the user's progress (${progress} answers), average score (${avgScore ?? 'N/A'}), and the content of their answers. Highlight strengths, suggest next steps, and always encourage further work.\n\nAll Answers: ${JSON.stringify(allAnswers)}\n\nOverall Summary:`;
    const openaiRes2 = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a seasoned, inspiring and creative brand strategist giving feedback in inspiring, motivating and creative style.' },
          { role: 'user', content: overallPrompt },
        ],
        max_tokens: 220,
        temperature: 0.7,
      }),
    });
    const data2 = await openaiRes2.json();
    const overallConclusion = data2.choices?.[0]?.message?.content?.trim() || '';
    res.json({ sectionConclusions, overallConclusion });
  } catch (err) {
    res.status(500).json({ sectionConclusions: {}, overallConclusion: 'AI feedback unavailable.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Hello from BrandKit backend!');
});