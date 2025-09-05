import React, { useState } from 'react';
import axios from 'axios';

export default function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!file) return alert('Choose a PDF or DOCX resume first.');
    if (!jd) {
      if (!confirm('No JD provided — continue and only extract resume text?')) return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('resume', file);

      // 1) upload and extract text
      const up = await axios.post('http://localhost:5000/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const resume_text = up.data.text || '';

      // 2) call analyze endpoint (which calls Python ML service)
      const analysis = await axios.post('http://localhost:5000/analyze', {
        resume_text,
        jd_text: jd,
      });

      setResult(analysis.data);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error || err.message;
      alert('Error: ' + msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '2rem auto', fontFamily: 'Inter, Arial, sans-serif' }}>
      <h1>AI Resume Analyzer (Prototype)</h1>

      <form onSubmit={handleAnalyze} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
        <div>
          <label><strong>Upload resume (PDF or DOCX)</strong></label><br />
          <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label><strong>Paste Job Description (JD)</strong></label>
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={8} style={{ width: '100%', marginTop: 6 }} placeholder="Paste the JD text here..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading}>{loading ? 'Analyzing...' : 'Analyze Resume vs JD'}</button>
        </div>
      </form>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h2>Result</h2>
          <p><strong>Match score:</strong> {result.score}%</p>

          <h3>Missing skills / keywords</h3>
          {result.missing_skills.length ? (
            <ul>{result.missing_skills.map((s, i) => <li key={i}>{s}</li>)}</ul>
          ) : <p>None — your resume contains most JD keywords.</p>}

          <h3>Top keywords (JD)</h3>
          <ul>{result.jd_keywords.map((k, i) => <li key={i}>{k}</li>)}</ul>

          <h3>Top keywords (Resume)</h3>
          <ul>{result.resume_keywords.map((k, i) => <li key={i}>{k}</li>)}</ul>

          <h3>Suggestions</h3>
          <ul>{result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
