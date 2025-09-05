// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// simple health route
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'server', port: process.env.PORT || 5000 }));

// upload resume (PDF or DOCX) and return extracted text
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      const buffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(buffer);
      text = data.text || '';
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value || '';
    } else {
      // cleanup
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF or DOCX.' });
    }

    // cleanup uploaded file
    fs.unlink(req.file.path, () => {});

    return res.json({ text });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Error extracting text from file' });
  }
});

// forward resume_text + jd_text to ML service (python) - update URL if your ML runs elsewhere
app.post('/analyze', async (req, res) => {
  const { resume_text, jd_text } = req.body;
  if (!resume_text || !jd_text) {
    return res.status(400).json({ error: 'resume_text and jd_text are required in body' });
  }

  try {
    const resp = await axios.post('http://localhost:8000/analyze', { resume_text, jd_text }, { timeout: 120000 });
    return res.json(resp.data);
  } catch (err) {
    console.error('Error calling ML service:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Error calling ML service', details: err?.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
