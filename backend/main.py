import os
import traceback
from pathlib import Path
from typing import Any
import numpy as np

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ocr.extractor import extract_text_from_file, parse_medical_parameters


# ── App setup ─────────────────────────────────────────────────────
app = FastAPI(
    title="MedAI Backend",
    description="Medical Report Analysis API",
    version="1.0.0",
)

# Allow requests from React dev server (change in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── ML model loader ───────────────────────────────────────────────
import joblib

MODELS_DIR = Path("ml_models/models")

def load_model(name: str):
    """Load a .joblib or .pkl model by name from ml_models/models/."""
    for ext in (".joblib", ".pkl"):
        path = MODELS_DIR / f"{name}{ext}"
        if path.exists():
            return joblib.load(path)
    raise FileNotFoundError(f"Model '{name}' not found in {MODELS_DIR}")

# Load all 4 models at startup — adjust names to match your saved files
try:
    model_anemia   = load_model("anemia/anemia_rf_model")
    model_diabetes = load_model("diabetes/diabetes_xgboost_model")
    model_heart    = load_model("heart/cardio_xgboost_calibrated")
    model_liver    = load_model("liver/liver_lgbm_calibrated")
    # model_infection  = load_model("infection")
    print("✅ All ML models loaded successfully")
except FileNotFoundError as e:
    print(f"⚠️  {e} — prediction for that model will return error")
    model_anemia = model_diabetes = model_heart = model_liver = model_infection = None


# ── Pydantic schemas ──────────────────────────────────────────────

class PredictRequest(BaseModel):
    text: str                        # raw OCR text

class SummarizeRequest(BaseModel):
    text: str                        # raw OCR text
    predictions: list[dict[str, Any]] # output from /predict

class ChatMessage(BaseModel):
    role: str                        # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]


# ── Helper: build feature vector from parsed params ───────────────

def build_feature_vector(params: dict, feature_names: list) -> list:
    """
    Build a feature vector from params.
    Missing features are filled with np.nan (or 0.0 if your model can't handle NaN).
    """
    return [params.get(name, np.nan) for name in feature_names]


# ── Routes ────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "ok", "message": "MedAI backend is running"}


# ── 1. OCR ────────────────────────────────────────────────────────
@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """
    Accepts a PDF or image file.
    Returns extracted text + parsed medical parameters.
    """
    # Validate content type
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

    # Read file bytes
    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded file.")

    # Run extraction
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

    # Also parse structured parameters
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
# ── 2. Predict ────────────────────────────────────────────────────
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
    # ── Feature lists must match EXACTLY what each model was trained on ──────────
    ANEMIA_FEATURES = [
        "Hemoglobin", "RBC", "MCV", "MCH", "MCHC", "Hematocrit",
        # Add the remaining 8 features your model was trained with, e.g.:
        "WBC", "Platelets", "RDW" , "Lymphocytes" , "Neutrophils" , "Neutrophils" , "PDW" ,"PCT"
        # ... until you have 14 total
    ]

    DIABETES_FEATURES = [
        "Fasting Glucose", "HbA1c", "BMI",
        # Add remaining 5 features to reach 8 total, e.g.:
        "Age", "gender", "hypertension", "heart_disease", "smoking_history"
    ]

    HEART_FEATURES = [
        "Total Cholesterol", "LDL", "HDL", "Triglycerides", "Systolic BP",
        "height", "weight", "ap_hi", "ap_lo", "glucose","smoke","alco","active" , "age" , "gender" ,"id" , "cardio" , "hypertension"
        # Add remaining 13 features to reach 18 total
    ]

    LIVER_FEATURES = [
        "ALT", "AST", "Bilirubin", "Albumin", "BMI",
        # Add remaining 17 features to reach 22 total
        "height", "weight", "ap_hi", "ap_lo", "glucose","smoke","alco","active" , "age" , "gender" ,"id" , "cardio" , "hypertension" , "TSH" , "CRP" , "BUN" , "creatinine"
    ]

    # INFECTION_FEATURES = [
    #     "WBC", "Neutrophils", "Lymphocytes", "CRP", "Platelets",
    #     # Add remaining features
    # ]

    def run_model(model, model_name, disease_name, feature_names, algo_name):
        """Helper to run a model with NaN-padded features."""
        try:
            if model is None:
                raise RuntimeError("Model not loaded")
            
            features = []
            for name in feature_names:
                val = params.get(name, 0.0)
                if val is None or (isinstance(val, float) and np.isnan(val)):
                    val = 0.0
                features.append(float(val))  # ← force cast to Python float
            
            # Reshape into proper 2D numpy array (1 sample, N features)
            feature_array = np.array(features, dtype=np.float64).reshape(1, -1)
            
            prob  = model.predict_proba(feature_array)[0][1]
            score = round(float(prob) * 100, 1)  # ← cast prob too
            return {"disease": disease_name, "score": score, "model": algo_name}
        except Exception as e:
            return {"disease": disease_name, "score": None, "error": str(e)}

    predictions.append(run_model(model_anemia,    "anemia",    "Anemia",       ANEMIA_FEATURES,    "Random Forest"))
    predictions.append(run_model(model_diabetes,  "diabetes",  "Diabetes",     DIABETES_FEATURES,  "XGBoost"))
    predictions.append(run_model(model_heart,     "heart",     "Heart Disease",HEART_FEATURES,     "XGBoost"))
    predictions.append(run_model(model_liver,     "liver",     "Liver Disease",LIVER_FEATURES,     "LightGBM"))
    # predictions.append(run_model(model_infection, "infection", "Infection Risk",INFECTION_FEATURES, "Random Forest"))

    return {"predictions": predictions, "parameters_used": params}


# ── 3. Summarize ──────────────────────────────────────────────────
@app.post("/summarize")
def summarize_endpoint(body: SummarizeRequest):
    """
    Takes OCR text + ML predictions and returns an LLM-generated summary.
    Wire up your Groq / Llama / Mixtral API here.
    """
    # ── TODO: replace this stub with your LLM call ──────────────
    # Example with Groq:
    #
    # from groq import Groq
    # client = Groq(api_key=os.environ["GROQ_API_KEY"])
    #
    # prompt = f"""
    # You are a medical assistant. Analyze this report and the ML predictions.
    # Report text:
    # {body.text}
    #
    # ML Predictions:
    # {body.predictions}
    #
    # Return a JSON with:
    # - overview: 2-3 sentence clinical summary
    # - abnormal: list of {{param, value, note}} for out-of-range values
    # - suggestions: list of 5-6 actionable recommendations
    # """
    #
    # response = client.chat.completions.create(
    #     model="llama3-8b-8192",
    #     messages=[{"role": "user", "content": prompt}],
    # )
    # return json.loads(response.choices[0].message.content)
    # ──────────────────────────────────────────────────────────────

    raise HTTPException(
        status_code=501,
        detail="Summarization not yet implemented. Wire up your LLM in main.py /summarize route."
    )


# ── 4. Chat (Mediee) ──────────────────────────────────────────────
@app.post("/chat")
def chat_endpoint(body: ChatRequest):
    """
    Mediee chatbot endpoint.
    Receives full conversation history, returns next assistant reply.
    Wire up your Groq / Llama / Mixtral API here.
    """
    # ── TODO: replace this stub with your LLM call ──────────────
    # Example with Groq:
    #
    # from groq import Groq
    # client = Groq(api_key=os.environ["GROQ_API_KEY"])
    #
    # messages = [
    #     {
    #         "role": "system",
    #         "content": (
    #             "You are Mediee, a friendly and knowledgeable medical assistant. "
    #             "Help users understand their medical reports and health concerns. "
    #             "Always recommend consulting a doctor for diagnosis."
    #         )
    #     },
    #     *[{"role": m.role, "content": m.content} for m in body.messages]
    # ]
    #
    # response = client.chat.completions.create(
    #     model="llama3-8b-8192",
    #     messages=messages,
    # )
    # return {"reply": response.choices[0].message.content}
    # ──────────────────────────────────────────────────────────────

    raise HTTPException(
        status_code=501,
        detail="Chat not yet implemented. Wire up your LLM in main.py /chat route."
    )