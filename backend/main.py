import os
import re
import csv
import math
import json
import hashlib
import logging
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator, model_validator
from typing import Dict, List, Optional, Tuple

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("hea")

app = FastAPI(title="HEA Contour ML Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Element database (mirrors frontend alloyCalculator.js) ────────────────────
ELEM_DB: Dict[str, dict] = {
    "Al": {"r": 143, "VEC": 3,  "chi": 1.61, "Tm": 933,  "rho": 2.70},
    "Ni": {"r": 125, "VEC": 10, "chi": 1.91, "Tm": 1728, "rho": 8.90},
    "Fe": {"r": 126, "VEC": 8,  "chi": 1.83, "Tm": 1811, "rho": 7.87},
    "Cr": {"r": 128, "VEC": 6,  "chi": 1.66, "Tm": 2180, "rho": 7.19},
    "Co": {"r": 125, "VEC": 9,  "chi": 1.88, "Tm": 1768, "rho": 8.90},
    "Mn": {"r": 127, "VEC": 7,  "chi": 1.55, "Tm": 1519, "rho": 7.21},
    "Cu": {"r": 128, "VEC": 11, "chi": 1.90, "Tm": 1358, "rho": 8.96},
    "Li": {"r": 152, "VEC": 1,  "chi": 0.98, "Tm": 453,  "rho": 0.53},
    "Mg": {"r": 160, "VEC": 2,  "chi": 1.31, "Tm": 923,  "rho": 1.74},
    "Sc": {"r": 164, "VEC": 3,  "chi": 1.36, "Tm": 1814, "rho": 2.99},
    "Ti": {"r": 147, "VEC": 4,  "chi": 1.54, "Tm": 1941, "rho": 4.51},
    "Mo": {"r": 139, "VEC": 6,  "chi": 2.16, "Tm": 2896, "rho": 10.28},
    "Nb": {"r": 146, "VEC": 5,  "chi": 1.60, "Tm": 2750, "rho": 8.57},
    "Ta": {"r": 146, "VEC": 5,  "chi": 1.50, "Tm": 3290, "rho": 16.69},
    "W":  {"r": 139, "VEC": 6,  "chi": 2.36, "Tm": 3695, "rho": 19.25},
    "Zr": {"r": 160, "VEC": 4,  "chi": 1.33, "Tm": 2128, "rho": 6.52},
    "Hf": {"r": 156, "VEC": 4,  "chi": 1.30, "Tm": 2506, "rho": 13.31},
    "V":  {"r": 134, "VEC": 5,  "chi": 1.63, "Tm": 2183, "rho": 6.00},
    "Si": {"r": 111, "VEC": 4,  "chi": 1.90, "Tm": 1687, "rho": 2.33},
    "Sn": {"r": 141, "VEC": 4,  "chi": 1.96, "Tm": 505,  "rho": 7.29},
    "Zn": {"r": 134, "VEC": 12, "chi": 1.65, "Tm": 693,  "rho": 7.13},
    "C":  {"r": 77,  "VEC": 4,  "chi": 2.55, "Tm": 3823, "rho": 2.26},
    "B":  {"r": 85,  "VEC": 3,  "chi": 2.04, "Tm": 2349, "rho": 2.34},
    "Y":  {"r": 180, "VEC": 3,  "chi": 1.22, "Tm": 1795, "rho": 4.47},
}

BINARY_H: Dict[str, Dict[str, float]] = {
    "Al": {"Ni": -22, "Fe": -11, "Cr": -10, "Co": -19, "Ti": -17,
           "Mg": -2,  "Mn": -19, "Cu": -1,  "Li": -4,  "Sc": -18,
           "Mo": -5,  "Nb": -18, "Ta": -19, "W": -13,  "Si": -19,
           "Zr": -44, "Hf": -39, "V": -16},
    "Co": {"Cr": -4,  "Fe": -1,  "Ni": 0,   "Mn": -5,  "Cu": 6,
           "Ti": -28, "Mo": -5,  "Nb": -25, "Ta": -24, "W": -15},
    "Cr": {"Fe": -1,  "Ni": -7,  "Mn": 2,   "Cu": 12,  "Ti": -7,
           "Mo": 0,   "Nb": -7,  "Ta": -7,  "W": 0,    "Si": -37,
           "Zr": -12, "V": -2},
    "Fe": {"Ni": -2,  "Mn": 0,   "Cu": 13,  "Ti": -17, "Mo": -2,
           "Nb": -16, "Ta": -15, "W": -8,   "Si": -23, "Zr": -25,
           "V": -7,   "Hf": -23},
    "Ni": {"Mn": -8,  "Cu": 2,   "Ti": -35, "Mo": -7,  "Nb": -30,
           "Ta": -29, "W": -9,   "Si": -40, "Zr": -49, "V": -18,
           "Hf": -42},
    "Ti": {"Mg": 16,  "Li": 32,  "Sc": 0,   "Mo": -4,  "Nb": 2,
           "Ta": 1,   "W": 0,    "Cu": -9,  "Mn": -8,  "V": -2,
           "Zr": 0,   "Hf": 0,   "Si": -66},
    "Mo": {"Nb": 0,   "Ta": 0,   "W": 0,    "Cu": 19,  "Mn": 5,
           "Mg": 24,  "V": -5,   "Zr": -6,  "Hf": -4,  "Si": -19},
    "Nb": {"Ta": 0,   "W": 0,    "Cu": 3,   "Mn": -4,  "Mg": 31,
           "V": -1,   "Zr": 4,   "Hf": 4,   "Si": -56},
    "Ta": {"W": 0,    "Cu": 2,   "Mn": -3,  "Mg": 32,  "V": -1,
           "Zr": 3,   "Hf": 3},
    "W":  {"Cu": 23,  "Mn": 1,   "Mg": 36,  "V": -1,   "Zr": -3,
           "Hf": -3,  "Si": -35},
}

R_GAS = 8.3144  # J / (mol·K)

ELEMENT_PATTERN = re.compile(r"([A-Z][a-z]?)([0-9.]*)")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "kaggle_clean.csv")

# ── Global model state ────────────────────────────────────────────────────────
_model: dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# Physics feature extraction (server-side, mirrors alloyCalculator.js)
# ─────────────────────────────────────────────────────────────────────────────

def _binary_h(el1: str, el2: str) -> float:
    if el1 == el2:
        return 0.0
    for a, b in [(el1, el2), (el2, el1)]:
        if a in BINARY_H and b in BINARY_H[a]:
            return float(BINARY_H[a][b])
    # Fallback: Miedema-inspired electronegativity estimate
    chi1 = ELEM_DB.get(el1, {}).get("chi", 1.8)
    chi2 = ELEM_DB.get(el2, {}).get("chi", 1.8)
    r1   = ELEM_DB.get(el1, {}).get("r", 130)
    r2   = ELEM_DB.get(el2, {}).get("r", 130)
    dchi = chi1 - chi2
    dr   = (r1 - r2) / ((r1 + r2) / 2)
    return round(-96.5 * dchi ** 2 + 10 * dr ** 2, 2)


def extract_physics(comp_norm: Dict[str, float]) -> Dict[str, float]:
    """
    Return a dict of thermodynamic/structural descriptors for a normalised
    composition (values sum to 100.0).
    """
    elems = [(el, v / 100.0) for el, v in comp_norm.items()
             if v > 0 and el in ELEM_DB]
    if not elems:
        return {}

    # Weighted averages
    r_bar  = sum(c * ELEM_DB[el]["r"]   for el, c in elems)
    VEC    = sum(c * ELEM_DB[el]["VEC"] for el, c in elems)
    rho    = sum(c * ELEM_DB[el]["rho"] for el, c in elems)
    Tm     = sum(c * ELEM_DB[el]["Tm"]  for el, c in elems)
    chi_bar = sum(c * ELEM_DB[el]["chi"] for el, c in elems)

    # Atomic-size mismatch δ (%)
    delta = 100.0 * math.sqrt(
        sum(c * (1 - ELEM_DB[el]["r"] / r_bar) ** 2 for el, c in elems)
    )

    # Electronegativity difference Δχ
    dChi = math.sqrt(
        sum(c * (ELEM_DB[el]["chi"] - chi_bar) ** 2 for el, c in elems)
    )

    # Mixing entropy ΔS_mix  (J mol⁻¹ K⁻¹)
    dS = -R_GAS * sum(c * math.log(c) for _, c in elems)

    # Mixing enthalpy ΔH_mix  (kJ mol⁻¹)
    dH = sum(
        4 * _binary_h(elems[i][0], elems[j][0]) * elems[i][1] * elems[j][1]
        for i in range(len(elems))
        for j in range(i + 1, len(elems))
    )

    # Ω stability parameter
    omega = (Tm * dS) / (abs(dH) * 1000) if abs(dH) > 1e-4 else 999.0

    return {
        "VEC":   round(VEC,   3),
        "delta": round(delta, 3),
        "dChi":  round(dChi,  4),
        "omega": round(min(omega, 999.0), 3),
        "Tm":    round(Tm,    1),
        "rho":   round(rho,   3),
        "dS":    round(dS,    4),
        "dH":    round(dH,    4),
        "n_elements": len(elems),
    }


# ─────────────────────────────────────────────────────────────────────────────
# CSV formula parser
# ─────────────────────────────────────────────────────────────────────────────

def parse_formula(formula: str) -> Optional[Dict[str, float]]:
    """Parse a chemical formula string → normalised {El: pct} dict."""
    formula = formula.strip().replace(" ", "")
    if not formula:
        return None
    comp: Dict[str, float] = {}

    # Parenthetical form: (CuMnNi)90Al10
    pm = re.match(r"^\((.*?)\)([0-9.]+)(.*)$", formula)
    if pm:
        inside, mult, rest = pm.group(1), float(pm.group(2)), pm.group(3)
        sub_els = [m[0] for m in ELEMENT_PATTERN.findall(inside)]
        if sub_els:
            share = mult / len(sub_els)
            for el in sub_els:
                comp[el] = comp.get(el, 0.0) + share
        for el, coeff in ELEMENT_PATTERN.findall(rest):
            comp[el] = comp.get(el, 0.0) + (float(coeff) if coeff else 1.0)
    else:
        for el, coeff in ELEMENT_PATTERN.findall(formula):
            if not el:
                continue
            comp[el] = comp.get(el, 0.0) + (float(coeff) if coeff else 1.0)

    total = sum(comp.values())
    if total <= 0:
        return None
    return {el: (v / total) * 100.0 for el, v in comp.items()}


def _safe_float(s: str) -> Optional[float]:
    if not s or s.strip().lower() in ("", "nan", "none", "<1", ">450", "o1"):
        return None
    try:
        return float(s.strip())
    except ValueError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Feature vector builder
# ─────────────────────────────────────────────────────────────────────────────

def build_feature_vector(
    comp_norm: Dict[str, float],
    feature_cols: List[str],
    physics_cols: List[str],
) -> List[float]:
    """
    Concatenate:
      1. composition fractions for every known element
      2. physics descriptors (VEC, delta, dChi, omega, Tm, rho, dS, dH, n_el)
    """
    phys = extract_physics(comp_norm)
    comp_feats = [comp_norm.get(el, 0.0) for el in feature_cols]
    phys_feats = [phys.get(col, 0.0) for col in physics_cols]
    return comp_feats + phys_feats


PHYSICS_COLS = ["VEC", "delta", "dChi", "omega", "Tm", "rho", "dS", "dH", "n_elements"]


# ─────────────────────────────────────────────────────────────────────────────
# KNN regressor with uncertainty (standard deviation of neighbour targets)
# ─────────────────────────────────────────────────────────────────────────────

def knn_predict_with_uncertainty(
    X_train: List[List[float]],
    y_train: List[float],
    target: List[float],
    k: int = 5,
) -> Tuple[float, float]:
    """
    Distance-weighted KNN.
    Returns (prediction, uncertainty) where uncertainty = weighted std of
    neighbour target values — a simple proxy for model confidence.
    """
    if not X_train:
        raise ValueError("Empty training set.")

    dists = []
    for xi, yi in zip(X_train, y_train):
        d = math.sqrt(sum((a - b) ** 2 for a, b in zip(target, xi)))
        dists.append((d, yi))

    dists.sort(key=lambda x: x[0])
    neighbors = dists[:k]

    # Exact match
    if neighbors[0][0] == 0.0:
        return neighbors[0][1], 0.0

    total_w = sum(1.0 / d for d, _ in neighbors)
    pred = sum((1.0 / d) * y for d, y in neighbors) / total_w

    # Weighted variance → uncertainty
    var = sum((1.0 / d) * (y - pred) ** 2 for d, y in neighbors) / total_w
    uncertainty = math.sqrt(max(0.0, var))

    return pred, uncertainty


# ─────────────────────────────────────────────────────────────────────────────
# Model training
# ─────────────────────────────────────────────────────────────────────────────

def train_models() -> bool:
    global _model

    if not os.path.exists(CSV_PATH):
        log.error("CSV not found: %s", CSV_PATH)
        return False

    dataset: List[dict] = []
    unique_elements: set = set()

    try:
        with open(CSV_PATH, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                formula = (row.get("composition") or "").strip()
                if not formula or formula.lower() == "nan":
                    continue
                comp = parse_formula(formula)
                if not comp:
                    continue
                unique_elements.update(comp.keys())
                dataset.append({
                    "comp":   comp,
                    "ys":     _safe_float(row.get("yield_strength_MPa", "")),
                    "hv":     _safe_float(row.get("HV", "")),
                    "ref":    row.get("ref", "") or "",
                    "name":   formula,
                    "phases": row.get("phases", "") or "",
                })
    except Exception as exc:
        log.error("CSV read error: %s", exc)
        return False

    feature_cols = sorted(unique_elements)

    def fvec(comp_norm):
        return build_feature_vector(comp_norm, feature_cols, PHYSICS_COLS)

    X_ys, y_ys, X_hv, y_hv = [], [], [], []
    for item in dataset:
        fv = fvec(item["comp"])
        if item["ys"] is not None:
            X_ys.append(fv)
            y_ys.append(item["ys"])
        if item["hv"] is not None:
            X_hv.append(fv)
            y_hv.append(item["hv"])

    _model = {
        "feature_cols":  feature_cols,
        "dataset":       dataset,
        "X_ys":          X_ys,
        "y_ys":          y_ys,
        "X_hv":          X_hv,
        "y_hv":          y_hv,
        "k":             min(7, len(X_ys)) if X_ys else 5,
    }

    log.info(
        "Model trained — elements: %d | YS samples: %d | HV samples: %d",
        len(feature_cols), len(y_ys), len(y_hv),
    )
    return True


# ── Startup ───────────────────────────────────────────────────────────────────
train_models()


# ─────────────────────────────────────────────────────────────────────────────
# Prediction cache  (keyed on a stable hash of the normalised composition)
# ─────────────────────────────────────────────────────────────────────────────

_prediction_cache: Dict[str, dict] = {}

def _comp_hash(comp_norm: Dict[str, float]) -> str:
    key = json.dumps(
        {k: round(v, 2) for k, v in sorted(comp_norm.items()) if v > 0},
        sort_keys=True,
    )
    return hashlib.sha1(key.encode()).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    composition: Dict[str, float]

    @field_validator("composition")
    @classmethod
    def check_elements(cls, v: Dict[str, float]) -> Dict[str, float]:
        unknown = [el for el in v if el not in ELEM_DB]
        if unknown:
            raise ValueError(f"Unknown element(s): {unknown}")
        negative = [el for el, val in v.items() if val < 0]
        if negative:
            raise ValueError(f"Negative composition values: {negative}")
        return v

    @model_validator(mode="after")
    def check_nonzero(self) -> "PredictionRequest":
        total = sum(self.composition.values())
        if total <= 0:
            raise ValueError("Composition values must sum to a positive number.")
        active = sum(1 for v in self.composition.values() if v > 0)
        if active < 2:
            raise ValueError("At least two elements must have non-zero values.")
        return self


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.post("/api/predict")
@app.post("/predict")
def predict_properties(req: PredictionRequest):
    if not _model.get("X_ys"):
        if not train_models():
            raise HTTPException(503, "Model not available — CSV missing or unreadable.")

    # Normalise to 100 %
    total = sum(req.composition.values())
    comp_norm = {k: (v / total) * 100.0 for k, v in req.composition.items()}

    # Cache lookup
    cache_key = _comp_hash(comp_norm)
    if cache_key in _prediction_cache:
        return _prediction_cache[cache_key]

    # Build feature vector with physics descriptors
    fvec = build_feature_vector(comp_norm, _model["feature_cols"], PHYSICS_COLS)

    k = _model["k"]
    ys_pred, ys_unc = knn_predict_with_uncertainty(_model["X_ys"], _model["y_ys"], fvec, k)
    hv_pred, hv_unc = knn_predict_with_uncertainty(_model["X_hv"], _model["y_hv"], fvec, k)

    # Physics descriptors for response
    phys = extract_physics(comp_norm)

    # Closest database match (Euclidean on full feature vector)
    closest, min_dist = None, float("inf")
    for item in _model["dataset"]:
        item_fvec = build_feature_vector(item["comp"], _model["feature_cols"], PHYSICS_COLS)
        d = math.sqrt(sum((a - b) ** 2 for a, b in zip(fvec, item_fvec)))
        if d < min_dist:
            min_dist, closest = d, item

    closest_match = None
    if closest:
        closest_match = {
            "name":     closest["name"],
            "ys":       closest["ys"],
            "hv":       closest["hv"],
            "ref":      closest["ref"],
            "phases":   closest["phases"],
            "distance": round(min_dist, 3),
        }

    # Confidence score  (0–1): based on proximity to training data
    # Nearest-neighbour distance normalised against a heuristic "far" distance
    # (empirically, distances > 40 are essentially extrapolation)
    nn_dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(fvec, _model["X_ys"][0]))) if _model["X_ys"] else 40.0
    confidence = max(0.0, min(1.0, 1.0 - (min_dist / 40.0)))

    result = {
        "ml": {
            "YS_pred":      round(ys_pred),
            "HV_pred":      round(hv_pred),
            "YS_uncertainty": round(ys_unc),
            "HV_uncertainty": round(hv_unc),
        },
        "physics": {
            "VEC":   phys.get("VEC"),
            "delta": phys.get("delta"),
            "omega": phys.get("omega"),
            "dChi":  phys.get("dChi"),
            "Tm":    phys.get("Tm"),
            "rho":   phys.get("rho"),
        },
        "confidence": round(confidence, 3),
        "closest_match": closest_match,
    }

    _prediction_cache[cache_key] = result
    return result


@app.post("/api/batch_predict")
async def batch_predict(compositions: List[Dict[str, float]]):
    """Predict for multiple compositions in one request."""
    if len(compositions) > 50:
        raise HTTPException(400, "Maximum 50 compositions per batch request.")
    results = []
    for comp in compositions:
        try:
            req = PredictionRequest(composition=comp)
            results.append(predict_properties(req))
        except Exception as exc:
            results.append({"error": str(exc)})
    return {"results": results}


@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded":     bool(_model.get("X_ys")),
        "training_data":     "kaggle_clean.csv",
        "training_ys":       len(_model.get("y_ys", [])),
        "training_hv":       len(_model.get("y_hv", [])),
        "validation_data":   "hea_database.csv (independent — not used for training)",
        "total_alloys":      len(_model.get("dataset", [])),
        "feature_dims":      len(_model.get("feature_cols", [])) + len(PHYSICS_COLS),
        "cache_entries":     len(_prediction_cache),
    }
@app.get("/api/elements")
def list_elements():
    """Return all elements the model knows about."""
    return {"elements": sorted(ELEM_DB.keys())}


@app.post("/api/similar")
def find_similar(req: PredictionRequest, top_k: int = 5):
    """Return the k database alloys closest to the given composition."""
    if not _model.get("dataset"):
        raise HTTPException(503, "Model not loaded.")
    if top_k < 1 or top_k > 20:
        raise HTTPException(400, "top_k must be between 1 and 20.")

    total = sum(req.composition.values())
    comp_norm = {k: (v / total) * 100.0 for k, v in req.composition.items()}
    fvec = build_feature_vector(comp_norm, _model["feature_cols"], PHYSICS_COLS)

    ranked = []
    for item in _model["dataset"]:
        item_fvec = build_feature_vector(item["comp"], _model["feature_cols"], PHYSICS_COLS)
        d = math.sqrt(sum((a - b) ** 2 for a, b in zip(fvec, item_fvec)))
        ranked.append({
            "name":     item["name"],
            "ys":       item["ys"],
            "hv":       item["hv"],
            "ref":      item["ref"],
            "phases":   item["phases"],
            "distance": round(d, 3),
        })

    ranked.sort(key=lambda x: x["distance"])
    return {"similar": ranked[:top_k]}