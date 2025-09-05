# ml/api.py
from flask import Flask, request, jsonify
import re
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)

# Load spaCy model (make sure to run: python -m spacy download en_core_web_sm)
nlp = spacy.load("en_core_web_sm")

def clean_text(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r'[\r\n]+', ' ', s)
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def extract_keywords_and_score(resume_text: str, jd_text: str, top_n=20):
    resume = clean_text(resume_text)
    jd = clean_text(jd_text)

    # Build TF-IDF on both documents so feature space is consistent
    vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1,2))
    X = vectorizer.fit_transform([resume, jd])
    feature_names = vectorizer.get_feature_names_out()

    def top_terms(row_idx):
        vec = X[row_idx].toarray()[0]
        inds = vec.argsort()[::-1]
        terms = []
        for i in inds:
            if vec[i] > 0:
                terms.append(feature_names[i])
            if len(terms) >= top_n:
                break
        return terms

    resume_keywords = top_terms(0)
    jd_keywords = top_terms(1)

    missing = [k for k in jd_keywords if k not in resume_keywords]

    # similarity score between resume and JD (0..1)
    score = float(cosine_similarity(X[0], X[1])[0][0])

    # Basic suggestions
    suggestions = []
    if missing:
        suggestions.append("Consider adding/emphasizing these keywords from the JD: " + ", ".join(missing))
    else:
        suggestions.append("Your resume already contains many top JD keywords.")

    # Heuristics: length
    if len(resume.split()) < 150:
        suggestions.append("Resume appears short — ensure 1 strong page with 1–2 achievements per role.")
    elif len(resume.split()) > 900:
        suggestions.append("Resume seems very long — try to be concise and focus on relevant experiences.")

    return {
        "resume_keywords": resume_keywords,
        "jd_keywords": jd_keywords,
        "missing_skills": missing,
        "score": round(score * 100, 2),
        "suggestions": suggestions
    }

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    resume_text = data.get('resume_text', '')
    jd_text = data.get('jd_text', '')
    if not resume_text or not jd_text:
        return jsonify({"error": "Both resume_text and jd_text are required"}), 400
    result = extract_keywords_and_score(resume_text, jd_text, top_n=20)
    return jsonify(result)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # Runs on port 8000 by default
    app.run(host='0.0.0.0', port=8000, debug=True)
