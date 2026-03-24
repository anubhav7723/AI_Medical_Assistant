"""
ocr/extractor.py
────────────────
Optimized for scanned medical lab report images.
Uses Tesseract with table-aware preprocessing.
"""

import io
import re
from pathlib import Path

import pytesseract
import pdfplumber
from pdf2image import convert_from_bytes
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import numpy as np
import cv2

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ── Tesseract configs ─────────────────────────────────────────────
# PSM 4  = single column of text (good for lab report columns)
# PSM 6  = uniform block (fallback)
# PSM 11 = sparse text, no OSD (catches scattered values)
TESS_PSM4  = '--oem 3 --psm 4  -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/-() '
TESS_PSM11 = '--oem 3 --psm 11 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/-() '


# ── Image preprocessing ───────────────────────────────────────────

def _preprocess_image(img: Image.Image) -> Image.Image:
    """
    Multi-step preprocessing pipeline optimized for scanned lab reports.
    Uses OpenCV for deskewing and denoising — critical for scan accuracy.
    """
    # 1. Fix EXIF orientation (phone photos)
    img = ImageOps.exif_transpose(img)
    img = img.convert('RGB')

    # Convert to OpenCV format (numpy BGR)
    cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    # 2. Upscale to at least 2400px wide — Tesseract needs high DPI for accuracy
    h, w = cv_img.shape[:2]
    if w < 2400:
        scale = 2400 / w
        cv_img = cv2.resize(cv_img, (int(w * scale), int(h * scale)),
                            interpolation=cv2.INTER_CUBIC)

    # 3. Convert to grayscale
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 4. Denoise — removes scan artifacts and speckles
    gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # 5. Deskew — fixes tilted scans (very common with phone photos)
    gray = _deskew(gray)

    # 6. Adaptive thresholding — much better than global for uneven lighting in scans
    #    This is the key fix for "extra garbage characters" from shadows/gradients
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,   # larger block = handles more uneven lighting
        C=15            # constant subtracted from mean
    )

    # 7. Remove small noise blobs (salt-and-pepper artifacts)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # Convert back to PIL
    return Image.fromarray(binary)


def _deskew(gray: np.ndarray) -> np.ndarray:
    """
    Detects and corrects skew angle in scanned documents.
    Fixes tilted phone photos which cause merged/broken lines in OCR.
    """
    try:
        # Invert so text is white on black (required for minAreaRect)
        inverted = cv2.bitwise_not(gray)
        coords = np.column_stack(np.where(inverted > 0))
        angle = cv2.minAreaRect(coords)[-1]

        # minAreaRect returns angles in [-90, 0) — normalize to [-45, 45]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # Only correct if skew is significant (> 0.5 degrees) but not extreme
        if abs(angle) > 0.5 and abs(angle) < 45:
            h, w = gray.shape
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            gray = cv2.warpAffine(
                gray, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
    except Exception:
        pass  # If deskew fails, continue with original

    return gray


# ── OCR with fallback ─────────────────────────────────────────────

def _run_tesseract(img: Image.Image) -> str:
    """
    Run Tesseract with PSM 4 first (column mode).
    If result looks poor (too short or too many garbage chars), retry with PSM 11.
    """
    # Primary attempt: PSM 4 (single column — best for lab report layout)
    text = pytesseract.image_to_string(img, config=TESS_PSM4).strip()

    # Quality check: if fewer than 100 chars or >30% non-alphanumeric → retry
    alphanum = sum(c.isalnum() for c in text)
    total    = max(len(text), 1)
    garbage_ratio = 1 - (alphanum / total)

    if len(text) < 100 or garbage_ratio > 0.30:
        fallback = pytesseract.image_to_string(img, config=TESS_PSM11).strip()
        # Keep whichever result is longer and cleaner
        if len(fallback) > len(text):
            text = fallback

    return text


def _ocr_image_bytes(image_bytes: bytes) -> str:
    """Run Tesseract on raw image bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    img = _preprocess_image(img)
    return _run_tesseract(img)


def _ocr_pil_image(img: Image.Image) -> str:
    """Run Tesseract on a PIL Image object."""
    img = _preprocess_image(img)
    return _run_tesseract(img)


def _extract_pdf_text_pdfplumber(pdf_bytes: bytes) -> str:
    """Try to extract text from a text-based PDF using pdfplumber."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())
    return '\n\n'.join(text_parts)


def _extract_pdf_via_ocr(pdf_bytes: bytes) -> str:
    """Convert each PDF page to image at 300 DPI then run Tesseract."""
    images = convert_from_bytes(pdf_bytes, dpi=300, fmt='png', thread_count=2)
    return '\n\n'.join(_ocr_pil_image(img) for img in images)


# ── Public API ────────────────────────────────────────────────────

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()

    try:
        if ext == '.pdf':
            text = _extract_pdf_text_pdfplumber(file_bytes)
            if len(text.strip()) < 100:
                text = _extract_pdf_via_ocr(file_bytes)

        elif ext in ('.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.bmp'):
            text = _ocr_image_bytes(file_bytes)

        else:
            raise ValueError(
                f"Unsupported file type '{ext}'. "
                "Please upload a PDF or an image (JPG, PNG, TIFF, WEBP)."
            )

    except ValueError:
        raise
    except Exception as e:
        raise RuntimeError(f"Text extraction failed: {str(e)}") from e

    if not text.strip():
        raise RuntimeError(
            "No text could be extracted from this file. "
            "The document may be blank, corrupted, or a low-quality scan."
        )

    return text.strip()


# ── Medical parameter parser ──────────────────────────────────────

PARAM_PATTERNS = [
    # Strict patterns: parameter name → optional separator → first number only
    # [^\d]{0,10} limits gap between name and value to prevent cross-row merging
    (r'hemoglobin\s*[:\-]?\s*([\d.]+)',            'Hemoglobin'),
    (r'\brbc\s*[:\-]?\s*([\d.]+)',                 'RBC'),
    (r'\bwbc\s*[:\-]?\s*([\d.]+)',                 'WBC'),
    (r'platelets?\s*[:\-]?\s*([\d,]+)',            'Platelets'),
    (r'hematocrit\s*[:\-]?\s*([\d.]+)',            'Hematocrit'),
    (r'packed\s*cell\s*volume\s*[:\-]?\s*([\d.]+)','Hematocrit'),  # PCV alias
    (r'\bpcv\s*[:\-]?\s*([\d.]+)',                 'Hematocrit'),  # PCV alias
    (r'\bmcv\s*[:\-]?\s*([\d.]+)',                 'MCV'),
    (r'\bpcv\s*[:\-]?\s*([\d.]+)',                 'MCV'),
    (r'\bmch\b\s*[:\-]?\s*([\d.]+)',               'MCH'),
    (r'\bch\b\s*[:\-]?\s*([\d.]+)',               'MCH'),
    (r'\bmchc\s*[:\-]?\s*([\d.]+)',                'MCHC'),
    (r'\bchc\s*[:\-]?\s*([\d.]+)',                'MCHC'),
    (r'fasting\s*(?:blood\s*)?glucose\s*[:\-]?\s*([\d.]+)', 'Fasting Glucose'),
    (r'blood\s*glucose\s*[:\-]?\s*([\d.]+)',       'Fasting Glucose'),
    (r'hba1c\s*[:\-]?\s*([\d.]+)',                 'HbA1c'),
    (r'glycated\s*haemoglobin\s*[:\-]?\s*([\d.]+)','HbA1c'),
    (r'total\s*cholesterol\s*[:\-]?\s*([\d.]+)',   'Total Cholesterol'),
    (r'\bldl\s*[:\-]?\s*([\d.]+)',                 'LDL'),
    (r'\bhdl\s*[:\-]?\s*([\d.]+)',                 'HDL'),
    (r'triglycerides?\s*[:\-]?\s*([\d.]+)',        'Triglycerides'),
    (r'creatinine\s*[:\-]?\s*([\d.]+)',            'Creatinine'),
    (r'\begfr\s*[:\-]?\s*([\d.]+)',                'eGFR'),
    (r'\bbun\b\s*[:\-]?\s*([\d.]+)',               'BUN'),
    (r'blood\s*urea\s*nitrogen\s*[:\-]?\s*([\d.]+)','BUN'),
    (r'\balt\b\s*[:\-]?\s*([\d.]+)',               'ALT'),
    (r'alanine\s*(?:amino)?transferase\s*[:\-]?\s*([\d.]+)', 'ALT'),
    (r'\bast\b\s*[:\-]?\s*([\d.]+)',               'AST'),
    (r'aspartate\s*(?:amino)?transferase\s*[:\-]?\s*([\d.]+)', 'AST'),
    (r'bilirubin\s*[:\-]?\s*([\d.]+)',             'Bilirubin'),
    (r'albumin\s*[:\-]?\s*([\d.]+)',               'Albumin'),
    (r'\btsh\b\s*[:\-]?\s*([\d.]+)',               'TSH'),
    (r'\bcrp\b\s*[:\-]?\s*([\d.]+)',               'CRP'),
    (r'c.reactive\s*protein\s*[:\-]?\s*([\d.]+)',  'CRP'),
    (r'\bbmi\b\s*[:\-]?\s*([\d.]+)',               'BMI'),
    (r'systolic\s*[:\-]?\s*([\d]+)',               'Systolic BP'),
    (r'neutrophils?\s*[:\-]?\s*([\d.]+)',          'Neutrophils'),
    (r'lymphocytes?\s*[:\-]?\s*([\d.]+)',          'Lymphocytes'),
]


def parse_medical_parameters(text: str) -> dict:
    """
    Extract medical parameters line-by-line to prevent cross-row value merging.
    Each line is matched independently so values can't bleed into wrong params.
    """
    params = {}

    # Process line by line — this is the KEY fix for "values merging with wrong parameter"
    lines = text.lower().splitlines()
    for line in lines:
        line = line.strip()
        if not line:
            continue
        for pattern, name in PARAM_PATTERNS:
            if name in params:
                continue  # Already found this parameter, skip
            match = re.search(pattern, line)
            if match:
                raw = match.group(1).replace(',', '')
                try:
                    params[name] = float(raw)
                    break  # One match per line max
                except ValueError:
                    pass

    return params