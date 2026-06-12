import os
import re
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
from sklearn.neighbors import KNeighborsRegressor

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
ys_model = None
hv_model = None

def train_models():
    global all_elements, feature_cols, dataset, ys_model, hv_model
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: Database CSV not found at {CSV_PATH}")
        return False
        
    df = pd.read_csv(CSV_PATH)
    
    # 1. Parse all compositions and collect unique elements
    temp_dataset = []
    unique_elements = set()
    
    for idx, row in df.iterrows():
        composition_str = str(row['composition'])
        if not composition_str or composition_str == "nan":
            continue
            
        comp_dict = parse_formula(composition_str)
        unique_elements.update(comp_dict.keys())
        
        ys = row['yield_strength_MPa']
        hv = row['HV']
        
        temp_dataset.append({
            'composition': comp_dict,
            'ys': float(ys) if pd.notna(ys) else None,
            'hv': float(hv) if pd.notna(hv) else None,
            'ref': str(row['ref']) if pd.notna(row['ref']) else '',
            'original_name': composition_str
        })
        
    all_elements = unique_elements
    feature_cols = sorted(list(all_elements))
    dataset = temp_dataset
    
    # 2. Vectorize compositions into features
    def get_features(comp):
        return [comp.get(el, 0.0) for el in feature_cols]
        
    # 3. Train Yield Strength KNN model
    X_ys = []
    y_ys = []
    for item in dataset:
        if item['ys'] is not None:
            X_ys.append(get_features(item['composition']))
            y_ys.append(item['ys'])
            
    if X_ys:
        # Use distance weighting: closer neighbors have higher influence
        ys_model = KNeighborsRegressor(n_neighbors=min(5, len(X_ys)), weights='distance')
        ys_model.fit(X_ys, y_ys)
        print(f"Trained YS Model on {len(X_ys)} samples.")
        
    # 4. Train Hardness (HV) KNN model
    X_hv = []
    y_hv = []
    for item in dataset:
        if item['hv'] is not None:
            X_hv.append(get_features(item['composition']))
            y_hv.append(item['hv'])
            
    if X_hv:
        hv_model = KNeighborsRegressor(n_neighbors=min(5, len(X_hv)), weights='distance')
        hv_model.fit(X_hv, y_hv)
        print(f"Trained HV Model on {len(X_hv)} samples.")
        
    return True

# Run training on startup
train_models()

class PredictionRequest(BaseModel):
    composition: Dict[str, float]

@app.post("/api/predict")
def predict_properties(req: PredictionRequest):
    global ys_model, hv_model, dataset, feature_cols
    
    if not ys_model or not hv_model:
        # Attempt to train if not already trained
        success = train_models()
        if not success:
            raise HTTPException(status_code=500, detail="Prediction models are not loaded.")

    target_comp = req.composition
    
    # Normalize input composition to sum to 100%
    total = sum(target_comp.values())
    if total == 0:
        raise HTTPException(status_code=400, detail="Composition values cannot sum to 0.")
        
    normalized_comp = {k: (v / total) * 100.0 for k, v in target_comp.items()}
    
    # Vectorize input composition
    features = [normalized_comp.get(el, 0.0) for el in feature_cols]
    
    # Execute predictions
    ys_pred = float(ys_model.predict([features])[0])
    hv_pred = float(hv_model.predict([features])[0])
    
    # Find closest matching composition in database (Euclidean distance)
    closest_alloy = None
    min_dist = float('inf')
    
    for item in dataset:
        dist_sq = 0.0
        # Compute distance over the union of keys in target and database entry
        all_keys = set(normalized_comp.keys()).union(item['composition'].keys())
        for el in all_keys:
            dist_sq += (normalized_comp.get(el, 0.0) - item['composition'].get(el, 0.0)) ** 2
            
        dist = np.sqrt(dist_sq)
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
            "distance": round(float(min_dist), 2)
        }
        
    return {
        "ml": {
            "YS_pred": round(ys_pred),
            "HV_pred": round(hv_pred)
        },
        "closest_match": closest_match_data
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": ys_model is not None and hv_model is not None,
        "database_size": len(dataset)
    }
