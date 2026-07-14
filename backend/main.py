import os
from pathlib import Path
from typing import Any
import numpy as np
import json
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ocr.extractor import extract_text_from_file, parse_medical_parameters
from dotenv import load_dotenv
load_dotenv()

try:
    from rag.retriever import retrieve_for_diseases, format_context
    RAG_READY = True
except Exception as e:
    print(f"[Warning] RAG not loaded: {e}")
    RAG_READY = False
    def retrieve_for_diseases(q, d, top_k=5): return []
    def format_context(chunks): return "No knowledge base available."

app = FastAPI(
    title="MedAI Backend",
    description="Medical AI Assistant API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import joblib

MODELS_DIR = Path(__file__).parent / "ml_models" / "models"

def load_model(name: str):
    """Load a .joblib or .pkl model by name from ml_models/models/."""
    for ext in (".joblib", ".pkl"):
        path = MODELS_DIR / f"{name}{ext}"
        if path.exists():
            return joblib.load(path)
    raise FileNotFoundError(f"Model '{name}' not found in {MODELS_DIR}")

try:
    model_anemia   = load_model("anemia/anemia_rf_model")
    model_diabetes = load_model("diabetes/diabetes_xgboost_model")
    model_heart    = load_model("heart/cardio_xgboost_calibrated")
    model_liver    = load_model("liver/liver_lgbm_calibrated")
    print("[OK] All ML models loaded successfully")
except FileNotFoundError as e:
    print(f"[Warning] {e} — prediction for that model will return error")
    model_anemia = model_diabetes = model_heart = model_liver = None


class PredictRequest(BaseModel):
    text: str                        
class SummarizeRequest(BaseModel):
    text: str                        
    predictions: list[dict[str, Any]] 

class ChatMessage(BaseModel):
    role: str                  
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

def build_feature_vector(params: dict, feature_names: list) -> list:
    """
    Build a feature vector from params.
    Missing features are filled with np.nan (or 0.0 if your model can't handle NaN).
    """
    return [params.get(name, np.nan) for name in feature_names]

# Routes
@app.get("/")
def health_check():
    return {"status": "ok", "message": "MedAI backend is running"}


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """
    Accepts a PDF or image file.
    Returns extracted text + parsed medical parameters.
    """
    allowed = {
        "application/pdf",
        "image/png", "image/jpeg", "image/jpg",
        "image/tiff", "image/webp", "image/bmp",
    }
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Upload a PDF or image."
        )

    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded file.")

    try:
        text = extract_text_from_file(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Internal OCR error. Please try again with a clearer image."
        )

    params = parse_medical_parameters(text)

    return {
        "text":       text,
        "parameters": params,      # e.g. {"Hemoglobin": 11.2, "WBC": 9200}
        "char_count": len(text),
    }

@app.post("/ocr/debug")
async def ocr_debug(file: UploadFile = File(...)):
    """Returns raw OCR text so you can inspect what Tesseract sees."""
    file_bytes = await file.read()
    text = extract_text_from_file(file_bytes, file.filename)
    params = parse_medical_parameters(text)
    return {
        "raw_text": text,         # See exactly what Tesseract extracted
        "parsed_params": params,  # See what the regex matched
        "lines": text.splitlines() # Line-by-line view
    }

def debias_probability(prob: float) -> float:
    if prob < 15:
        debiased = 20 + (prob / 15) * 5
    elif prob > 70:
        debiased = 65 + ((prob - 70) / 30) * 10
    else:
        debiased = prob
    return round(debiased, 1)

@app.post("/predict")
def predict_endpoint(body: PredictRequest):
    """
    Parses medical parameters from OCR text and runs all ML models.
    Returns risk scores for each disease.
    """
    params = parse_medical_parameters(body.text)

    if not params:
        raise HTTPException(
            status_code=422,
            detail="Could not extract any medical parameters from the text. "
                   "Ensure the report contains standard lab values."
        )

    predictions = []
    ANEMIA_FEATURES = [
    "Hemoglobin", "RBC", "WBC", "Platelets",
    "Hematocrit", "MCV", "MCH", "MCHC",
    "Neutrophils", "Lymphocytes",
    "RDW", "PDW", "PCT" , "BMI"
    ]

    DIABETES_FEATURES = [
        "HbA1c",           
        "Fasting Glucose",  
        "BMI",
        "Gender", "Age", "Hypertension", "heart_disease", "smoking_history"
    ]

    HEART_FEATURES = [
        "Total Cholesterol", "LDL", "HDL",
        "Triglycerides", "Systolic BP",
        "Diastolic BP" , "Glucose" , "Height" , "Weight" , "Gender" , "Hypertension"
    ]

    LIVER_FEATURES = [
        "ALT", "AST", "Bilirubin", "Albumin",
        "BMI", "CRP", "BUN", "Creatinine", "TSH",
        "Total Protein", "AG Ratio", "ALP",
        "Height", "Weight", "Systolic BP", "Diastolic BP", "Smoke", "alco", "active", "id",
        "cardio", "hypertension"
    ]

    print("PARAMS KEYS:", list(params.keys()))
    print("LIVER FEATURES:", LIVER_FEATURES)
    def run_model(model, model_name, disease_name, feature_names, algo_name):
        """Helper to run a model with NaN-padded features."""
        try:
            if model is None:
                raise RuntimeError("Model not loaded")

            features = []
            found_count = 0  
            for name in feature_names:
                val = params.get(name)
                if val is not None and not (isinstance(val, float) and np.isnan(val)):
                    found_count += 1
                    features.append(float(val))
                else:
                    features.append(0.0)

            if found_count == 0:
                return {"disease": disease_name, "score": None, "skip": True}

            feature_array = np.array(features, dtype=np.float64).reshape(1, -1)

            prob  = model.predict_proba(feature_array)[0][1]
            score = round(float(prob) * 100, 1)
            score = debias_probability(score)
            return {"disease": disease_name, "score": score, "model": algo_name}
        except Exception as e:
            print(f"❌ MODEL ERROR [{disease_name}]: {str(e)}")  # ← ADD THIS
            return {"disease": disease_name, "score": None, "error": str(e)}

    predictions.append(run_model(model_anemia,    "anemia",    "Anemia",       ANEMIA_FEATURES,    "Random Forest"))
    predictions.append(run_model(model_diabetes,  "diabetes",  "Diabetes",     DIABETES_FEATURES,  "XGBoost"))
    predictions.append(run_model(model_heart,     "heart",     "Heart Disease",HEART_FEATURES,     "XGBoost"))
    predictions.append(run_model(model_liver,     "liver",     "Liver Disease",LIVER_FEATURES,     "LightGBM"))

    return {"predictions": predictions, "parameters_used": params}


@app.post("/summarize")
def summarize_endpoint(body: SummarizeRequest):
    from groq import Groq
    import re

    client = Groq(api_key=os.environ["GROQ_API_KEY"])

    prompt = f"""
    You are a medical assistant. Analyze this report and the ML predictions.
    Report text:
    {body.text}

    ML Predictions:
    {body.predictions}

    Return a JSON with:
    - overview: 2-3 sentence clinical summary
    - abnormal: list of {{param, value, note}} for out-of-range values
    - suggestions: list of 5-6 actionable recommendations

    Respond ONLY with a valid JSON object. No explanation, no markdown, no code fences.
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content

    if not raw or not raw.strip():
        raise HTTPException(status_code=500, detail="Model returned an empty response")

    raw = re.sub(r"```json\s*|\s*```", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"summary": raw}

@app.post("/chat")
def chat_endpoint(body: ChatRequest):
    """
    Mediee RAG chatbot.
    Pipeline:
      1. Extract last user message
      2. Pull ML predictions from conversation context (if sent)
      3. Retrieve relevant chunks from FAISS
      4. Build grounded prompt → Groq LLM
      5. Return reply
    """
    from groq import Groq
 
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
 
    user_messages = [m for m in body.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message found.")
 
    latest_query = user_messages[-1].content

    ml_context_str = ""
    active_diseases = []
 
    for m in body.messages:
        if m.role == "system" and m.content.strip().startswith("{"):
            try:
                ctx = json.loads(m.content)

                preds = ctx.get("ml_predictions", [])
                if preds:
                    lines = []
                    for p in preds:
                        if p.get("score") is not None:
                            lines.append(
                                f"  - {p['disease']}: {p['score']}% risk "
                                f"(model: {p.get('model', 'ML')})"
                            )
                            active_diseases.append(p["disease"])
                    if lines:
                        ml_context_str += "ML Risk Predictions:\n" + "\n".join(lines)
 
                summary = ctx.get("report_summary", "")
                if summary:
                    ml_context_str += f"\n\nReport Summary:\n{summary}"
 
                params = ctx.get("parameters", {})
                if params:
                    if isinstance(params, dict):
                        param_lines = [f"  {k}: {v}" for k, v in list(params.items())[:15]]
                    elif isinstance(params, list):
                        param_lines = [f"  {item.get('param','')}: {item.get('value','')}" for item in params[:15]]
                    else:
                        param_lines = []
                    ml_context_str += "\n\nKey Lab Parameters:\n" + "\n".join(param_lines)
 
            except (json.JSONDecodeError, KeyError):
                pass
            break
 
    rag_chunks  = retrieve_for_diseases(latest_query, active_diseases, top_k=5)
    print(f"🔍 RAG chunks retrieved: {len(rag_chunks)}")  # ← ADD THIS
    for c in rag_chunks:
        print(f"   [{c['source']}] score={c['score']} | {c['text'][:80]}")
    rag_context = format_context(rag_chunks)
 
    system_prompt = f"""You are Mediee, an intelligent medical assistant built to help users understand their medical reports.
 
You have access to three knowledge sources — use ALL of them when relevant:
 
────────────────────────────────────────
PATIENT DATA (from their uploaded report)
────────────────────────────────────────
{ml_context_str if ml_context_str else "No report data available for this session."}
 
────────────────────────────────────────
MEDICAL KNOWLEDGE BASE (retrieved for this question)
────────────────────────────────────────
{rag_context}
 
────────────────────────────────────────
INSTRUCTIONS
────────────────────────────────────────
- Take reference patient data (ML scores, lab values) when the user explicitly asks about their report, health, or specific parameters And if you can't access data then answer from your knowledge.
- If the user asks a general or casual question (e.g. "how are you", "what is diabetes"), respond naturally without mentioning their personal data.
- Keep answers to 2-3 sentences maximum. Be direct and to the point.
- Only add "Always consult your doctor before making any health decisions." when giving medical advice, not on every message.
- Never diagnose. Never prescribe. Explain and guide only.
"""

    history = [
        {"role": m.role, "content": m.content}
        for m in body.messages
        if not (m.role == "system" and m.content.strip().startswith("{"))
    ]
 
    groq_messages = [
        {"role": "system", "content": system_prompt},
        *history,
    ]

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            temperature=0.4,    
            max_tokens=200,
        )
        reply = response.choices[0].message.content
 
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"LLM call failed: {str(e)}"
        )

    return {
        "reply": reply,
        "rag_sources": [
            {"source": c["source"], "score": c["score"]}
            for c in rag_chunks
        ],
    }