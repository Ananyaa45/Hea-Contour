import os
import re
import csv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional

app = FastAPI(title="HEA Contour ML Backend")

# Enable CORS for frontend querying
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve path to database CSV relative to main.py
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "hea_database.csv")

# Regular expression to parse element counts (e.g. Al0.3CoCrFeNi)
ELEMENT_PATTERN = re.compile(r'([A-Z][a-z]?)([0-9.]*)')

def parse_formula(formula: str) -> Dict[str, float]:
    """
    Parses a chemical formula string into a normalized dictionary of element percentages.
    Handles standard stoichiometry (Al0.3CoCrFeNi) and parenthetical formulas (e.g., (CuMnNi)90Al10).
    """
    formula = formula.strip().replace(" ", "")
    comp = {}
    
    # Check for parentheses structure: e.g. (CuMnNi)90Al10 or (CuMnNi)75Zn25
    parenthesis_match = re.match(r'^\((.*?)\)([0-9.]+)(.*)$', formula)
    
    if parenthesis_match:
        inside = parenthesis_match.group(1)
        multiplier = float(parenthesis_match.group(2))
        rest = parenthesis_match.group(3)
        
        # Sub-elements inside parentheses are treated as equiatomic
        sub_elements = [m[0] for m in ELEMENT_PATTERN.findall(inside)]
        if sub_elements:
            share = multiplier / len(sub_elements)
            for el in sub_elements:
                comp[el] = comp.get(el, 0.0) + share
                
        # Parse the remaining part
        for el, coeff in ELEMENT_PATTERN.findall(rest):
            val = float(coeff) if coeff else 1.0
            comp[el] = comp.get(el, 0.0) + val
    else:
        # Standard parsing
        for el, coeff in ELEMENT_PATTERN.findall(formula):
            val = float(coeff) if coeff else 1.0
            comp[el] = comp.get(el, 0.0) + val
            
    # Normalize to 100%
    total = sum(comp.values())
    if total > 0:
        for el in comp:
            comp[el] = (comp[el] / total) * 100.0
            
    return comp

# Global variables for models and feature mapping
all_elements = set()
feature_cols = []
dataset = []
X_ys = []
y_ys = []
X_hv = []
y_hv = []

def train_models():
    global all_elements, feature_cols, dataset, X_ys, y_ys, X_hv, y_hv
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: Database CSV not found at {CSV_PATH}")
        return False
        
    temp_dataset = []
    unique_elements = set()
    
    try:
        with open(CSV_PATH, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                composition_str = row.get('composition')
                if not composition_str or composition_str.strip() == "" or composition_str == "nan":
                    continue
                    
                comp_dict = parse_formula(composition_str)
                unique_elements.update(comp_dict.keys())
                
                # Safe float parsing helper
                def safe_float(val_str):
                    if not val_str or val_str.strip() == "" or val_str.lower() == "nan":
                        return None
                    try:
                        return float(val_str)
                    except ValueError:
                        return None
                
                ys = safe_float(row.get('yield_strength_MPa'))
                hv = safe_float(row.get('HV'))
                ref = row.get('ref', '')
                if ref is None or ref.lower() == "nan":
                    ref = ''
                    
                temp_dataset.append({
                    'composition': comp_dict,
                    'ys': ys,
                    'hv': hv,
                    'ref': ref,
                    'original_name': composition_str
                })
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return False
        
    all_elements = unique_elements
    feature_cols = sorted(list(all_elements))
    dataset = temp_dataset
    
    def get_features(comp):
        return [comp.get(el, 0.0) for el in feature_cols]
        
    X_ys = []
    y_ys = []
    for item in dataset:
        if item['ys'] is not None:
            X_ys.append(get_features(item['composition']))
            y_ys.append(item['ys'])
            
    X_hv = []
    y_hv = []
    for item in dataset:
        if item['hv'] is not None:
            X_hv.append(get_features(item['composition']))
            y_hv.append(item['hv'])
            
    print(f"Trained custom models. YS samples: {len(X_ys)}, HV samples: {len(X_hv)}")
    return True

def knn_predict(X_train: List[List[float]], y_train: List[float], target: List[float], k: int) -> float:
    """
    Pure Python K-Nearest Neighbors regressor with distance-weighted interpolation (1 / distance).
    Matches KNeighborsRegressor(weights='distance') functionality.
    """
    if not X_train:
        raise ValueError("Training set is empty.")
        
    distances = []
    for i, x_i in enumerate(X_train):
        dist = sum((a - b) ** 2 for a, b in zip(target, x_i)) ** 0.5
        distances.append((dist, y_train[i]))
        
    # Sort by distance
    distances.sort(key=lambda x: x[0])
    
    # Get top K
    neighbors = distances[:k]
    
    # Exact match handling
    if neighbors[0][0] == 0.0:
        return neighbors[0][1]
        
    total_weight = 0.0
    weighted_sum = 0.0
    for dist, val in neighbors:
        if dist == 0.0:
            return val
        weight = 1.0 / dist
        weighted_sum += val * weight
        total_weight += weight
        
    return weighted_sum / total_weight

# Run training on startup
train_models()

class PredictionRequest(BaseModel):
    composition: Dict[str, float]

@app.post("/api/predict")
@app.post("/predict")
def predict_properties(req: PredictionRequest):
    global X_ys, y_ys, X_hv, y_hv, dataset, feature_cols
    
    if not X_ys or not X_hv:
        success = train_models()
        if not success:
            raise HTTPException(status_code=500, detail="Prediction models could not be loaded.")

    target_comp = req.composition
    
    total = sum(target_comp.values())
    if total == 0:
        raise HTTPException(status_code=400, detail="Composition values cannot sum to 0.")
        
    normalized_comp = {k: (v / total) * 100.0 for k, v in target_comp.items()}
    
    # Vectorize input composition
    features = [normalized_comp.get(el, 0.0) for el in feature_cols]
    
    # Execute predictions
    ys_pred = knn_predict(X_ys, y_ys, features, k=min(5, len(X_ys)))
    hv_pred = knn_predict(X_hv, y_hv, features, k=min(5, len(X_hv)))
    
    # Find closest matching composition in database (Euclidean distance)
    closest_alloy = None
    min_dist = float('inf')
    
    for item in dataset:
        dist_sq = 0.0
        all_keys = set(normalized_comp.keys()).union(item['composition'].keys())
        for el in all_keys:
            dist_sq += (normalized_comp.get(el, 0.0) - item['composition'].get(el, 0.0)) ** 2
            
        dist = dist_sq ** 0.5
        if dist < min_dist:
            min_dist = dist
            closest_alloy = item
            
    closest_match_data = None
    if closest_alloy:
        closest_match_data = {
            "name": closest_alloy['original_name'],
            "ys": closest_alloy['ys'],
            "hv": closest_alloy['hv'],
            "ref": closest_alloy['ref'],
            "distance": round(min_dist, 2)
        }
        
    return {
        "ml": {
            "YS_pred": round(ys_pred),
            "HV_pred": round(hv_pred)
        },
        "closest_match": closest_match_data
    }

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": len(X_ys) > 0 and len(X_hv) > 0,
        "database_size": len(dataset)
    }
