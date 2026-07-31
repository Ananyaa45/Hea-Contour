import pytest, sys, math
sys.path.insert(0, '.')
from backend.main import parse_formula, extract_physics, knn_predict_with_uncertainty
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# ── Formula Parser Tests ──────────────────────────────────────────────────────

def test_parse_equiatomic():
    """CoCrFeNi with no coefficients means 25% each"""
    comp = parse_formula('CoCrFeNi')
    assert comp is not None
    assert abs(comp['Co'] - 25.0) < 0.1
    assert abs(comp['Cr'] - 25.0) < 0.1

def test_parse_stoichiometric():
    """Al0.3CoCrFeNi means Al has less fraction than Co"""
    comp = parse_formula('Al0.3CoCrFeNi')
    assert comp is not None
    assert abs(sum(comp.values()) - 100.0) < 0.1
    assert comp['Al'] < comp['Co']

def test_parse_parenthetical():
    """(CoCrNi)75Al25 style formula"""
    comp = parse_formula('(CoCrNi)75Al25')
    assert comp is not None
    assert abs(sum(comp.values()) - 100.0) < 0.1
    assert 'Al' in comp

def test_parse_empty_returns_none():
    """Empty string should return None"""
    result = parse_formula('')
    assert result is None

# ── Physics Descriptor Tests ──────────────────────────────────────────────────

def test_vec_equiatomic():
    """CoCrFeNi: Co=9, Cr=6, Fe=8, Ni=10 → average VEC = 8.25"""
    comp = {'Co': 25, 'Cr': 25, 'Fe': 25, 'Ni': 25}
    phys = extract_physics(comp)
    assert abs(phys['VEC'] - 8.25) < 0.05

def test_vec_pure_aluminum():
    """Pure Al has VEC = 3.0"""
    phys = extract_physics({'Al': 100})
    assert abs(phys['VEC'] - 3.0) < 0.01

def test_delta_near_zero_for_same_radius():
    """Co and Ni both have r=125pm so mismatch should be near zero"""
    phys = extract_physics({'Co': 50, 'Ni': 50})
    assert phys['delta'] < 0.5

def test_omega_is_positive():
    """Omega must always be positive"""
    comp = {'Al': 20, 'Co': 20, 'Cr': 20, 'Fe': 20, 'Ni': 20}
    phys = extract_physics(comp)
    assert phys['omega'] > 0

def test_density_physical_range():
    """Density must be between 1 and 20 g/cm3 for any real alloy"""
    comp = {'Al': 20, 'Co': 20, 'Cr': 20, 'Fe': 20, 'Ni': 20}
    phys = extract_physics(comp)
    assert 1.0 < phys['rho'] < 20.0

def test_n_elements_counts_correctly():
    """5-element alloy must report n_elements = 5"""
    comp = {'Al': 20, 'Co': 20, 'Cr': 20, 'Fe': 20, 'Ni': 20}
    phys = extract_physics(comp)
    assert phys['n_elements'] == 5

def test_melting_temp_reasonable():
    """Tm must be above room temperature"""
    phys = extract_physics({'Al': 20, 'Co': 20, 'Cr': 20, 'Fe': 20, 'Ni': 20})
    assert phys['Tm'] > 500

# ── KNN Predictor Tests ───────────────────────────────────────────────────────

def test_knn_returns_float_tuple():
    """Predictor must return (float, float)"""
    X = [[1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15]]
    y = [100.0, 200.0, 300.0, 400.0, 500.0]
    pred, unc = knn_predict_with_uncertainty(X, y, [4,5,6], k=3)
    assert isinstance(pred, float)
    assert isinstance(unc, float)
    assert unc >= 0

def test_knn_exact_match_zero_uncertainty():
    """Exact match in training set must return that value with zero uncertainty"""
    X = [[1.0,2.0],[3.0,4.0],[5.0,6.0],[7.0,8.0],[9.0,10.0]]
    y = [42.0, 84.0, 126.0, 168.0, 210.0]
    pred, unc = knn_predict_with_uncertainty(X, y, [3.0, 4.0], k=3)
    assert abs(pred - 84.0) < 0.1
    assert unc == 0.0

# ── API Endpoint Tests ────────────────────────────────────────────────────────

def test_health_endpoint():
    """Health check must return 200 and status healthy"""
    r = client.get('/api/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'healthy'

def test_predict_valid_composition():
    """Valid 5-element composition must return YS and HV predictions"""
    r = client.post('/api/predict',
        json={'composition': {'Al':20,'Co':20,'Cr':20,'Fe':20,'Ni':20}})
    assert r.status_code == 200
    data = r.json()
    assert 'ml' in data
    assert data['ml']['YS_pred'] > 0
    assert data['ml']['HV_pred'] > 0

def test_predict_rejects_unknown_elements():
    """Unknown elements like Xx must be rejected with 422"""
    r = client.post('/api/predict',
        json={'composition': {'Xx': 50, 'Yy': 50}})
    assert r.status_code == 422

def test_predict_rejects_zero_sum():
    """All-zero composition must be rejected"""
    r = client.post('/api/predict',
        json={'composition': {'Al': 0, 'Ni': 0}})
    assert r.status_code == 422

def test_elements_endpoint():
    """Elements endpoint must list Al, Ni, Fe at minimum"""
    r = client.get('/api/elements')
    assert r.status_code == 200
    els = r.json()['elements']
    assert 'Al' in els
    assert 'Ni' in els
    assert 'Fe' in els

def test_similar_endpoint():
    """Similar endpoint must return at most top_k results"""
    r = client.post('/api/similar?top_k=3',
        json={'composition': {'Co':20,'Cr':20,'Fe':20,'Mn':20,'Ni':20}})
    assert r.status_code == 200
    assert len(r.json()['similar']) <= 3

def test_physics_values_in_range():
    """Physics values returned by predict must be physically sensible"""
    r = client.post('/api/predict',
        json={'composition': {'Co':20,'Cr':20,'Fe':20,'Mn':20,'Ni':20}})
    phys = r.json()['physics']
    assert 2 <= phys['VEC'] <= 12
    assert 0 <= phys['delta'] <= 20
    assert phys['rho'] > 0