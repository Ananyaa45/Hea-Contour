import pytest

from backend.agents.search import generate_candidates, research, score_prediction


def fake_predict(comp):
    return {"ml": {"YS_pred": sum(comp.values()) * 3, "HV_pred": 200},
            "physics": {"rho": 5.0}}


def test_reproducible_and_normalized():
    a = generate_candidates(["Al", "Ni", "Fe", "Cr"], count=12, seed=12)
    assert a == generate_candidates(["Al", "Ni", "Fe", "Cr"], count=12, seed=12)
    assert len(a) == 12
    assert all(abs(sum(c.values()) - 100) < 1e-8 for c in a)
    assert all(3 <= len(c) <= 4 for c in a)


def test_research_ranking_and_trace():
    r = research(["Al", "Ni", "Fe", "Cr"], fake_predict, count=10, top_k=3)
    assert r["evaluated"] == 10
    assert len(r["candidates"]) == 3
    assert r["candidates"][0]["score"] == pytest.approx(60)
    assert r["tool_trace"][1]["calls"] == 10


def test_reject_invalid_constraints():
    with pytest.raises(ValueError):
        generate_candidates(["Al", "Al"], count=3)
    with pytest.raises(ValueError):
        generate_candidates(["Al", "Ni"], min_elements=3, max_elements=3)
    with pytest.raises(ValueError):
        research(["Al", "Ni", "Fe"], fake_predict, objective="magic")


def test_objectives():
    p = fake_predict({"Al": 50, "Ni": 50})
    assert score_prediction(p, "low_density") == -5
    assert score_prediction(p, "hardness") == 200
