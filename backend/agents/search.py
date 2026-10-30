"""Deterministic bounded alloy candidate search.

This module is independent of FastAPI and LLM providers. The prediction callable
is injected so that experiments are reproducible and easy to test.
"""
from __future__ import annotations

import random
from typing import Callable, Dict, List, Any

OBJECTIVES = {"yield_strength", "hardness", "low_density", "specific_strength"}


def generate_candidates(
    elements: List[str],
    count: int = 40,
    min_elements: int = 3,
    max_elements: int = 5,
    seed: int = 0,
) -> List[Dict[str, float]]:
    """Return at most 100 normalized atomic-percent compositions."""
    if len(elements) != len(set(elements)) or len(elements) < 2:
        raise ValueError("At least two unique elements are required.")
    if not 2 <= min_elements <= max_elements <= len(elements):
        raise ValueError("Invalid element-count constraints.")
    if not 1 <= count <= 100:
        raise ValueError("Candidate count must be between 1 and 100.")
    rng = random.Random(seed)
    results: List[Dict[str, float]] = []
    seen = set()
    # Always include an equiatomic baseline for the minimum permitted element count.
    baseline = sorted(elements)[:min_elements]
    compositions = [{el: 100.0 / min_elements for el in baseline}]
    for _ in range(count * 10):
        if len(compositions) >= count:
            break
        n = rng.randint(min_elements, max_elements)
        chosen = sorted(rng.sample(elements, n))
        weights = [rng.gammavariate(2.0, 1.0) for _ in chosen]
        total = sum(weights)
        compositions.append({el: 100.0 * w / total for el, w in zip(chosen, weights)})
    for composition in compositions:
        key = tuple((k, round(v, 5)) for k, v in sorted(composition.items()))
        if key not in seen:
            seen.add(key)
            results.append(composition)
        if len(results) >= count:
            break
    return results


def score_prediction(prediction: Dict[str, Any], objective: str) -> float:
    """Transparent scores in native property units; higher is always better."""
    if objective not in OBJECTIVES:
        raise ValueError(f"Unsupported objective: {objective}")
    ml = prediction.get("ml", {})
    physics = prediction.get("physics", {})
    density = physics.get("rho")
    if objective == "yield_strength":
        value = ml.get("YS_pred")
    elif objective == "hardness":
        value = ml.get("HV_pred")
    elif objective == "low_density":
        value = -float(density) if density is not None else None
    else:
        strength = ml.get("YS_pred")
        value = float(strength) / float(density) if strength is not None and density and density > 0 else None
    if value is None:
        raise ValueError("Prediction lacks property required for objective.")
    return float(value)


def research(
    elements: List[str],
    predict: Callable[[Dict[str, float]], Dict[str, Any]],
    objective: str = "specific_strength",
    count: int = 40,
    min_elements: int = 3,
    max_elements: int = 5,
    seed: int = 0,
    top_k: int = 5,
) -> Dict[str, Any]:
    """Run a capped search, preserving the evidence for every ranked candidate."""
    if objective not in OBJECTIVES:
        raise ValueError(f"Unsupported objective: {objective}")
    if not 1 <= top_k <= 20:
        raise ValueError("top_k must be between 1 and 20.")
    candidates = generate_candidates(elements, count, min_elements, max_elements, seed)
    ranked = []
    failures = []
    for i, composition in enumerate(candidates):
        try:
            prediction = predict(composition)
            score = score_prediction(prediction, objective)
            ranked.append({"composition": composition, "score": score, "prediction": prediction})
        except (ValueError, ArithmeticError, KeyError) as exc:
            failures.append({"candidate_index": i, "error": str(exc)})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return {
        "objective": objective,
        "seed": seed,
        "evaluated": len(candidates),
        "successful": len(ranked),
        "candidates": ranked[:top_k],
        "failures": failures,
        "tool_trace": [{"tool": "generate_candidates", "calls": 1},
                       {"tool": "predict_properties", "calls": len(candidates)},
                       {"tool": "rank_candidates", "calls": 1}],
        "limitations": [
            "Predicted properties are not experimentally validated.",
            "KNN neighbor spread is a heuristic uncertainty proxy, not a calibrated interval.",
            "Search is bounded random sampling, not proof of a global optimum.",
        ],
    }
