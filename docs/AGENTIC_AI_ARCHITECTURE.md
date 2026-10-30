# HEA Contour — Agentic AI architecture and delivery plan

## Purpose
Turn HEA Contour into a research assistant that can interpret materials-design objectives, invoke trusted scientific tools, explore compositions, compare candidates, and explain evidence and uncertainty. Predictions are **hypotheses**, not laboratory measurements.

## Existing foundation (main branch)
- React 19 / Vite frontend with composition sliders, phase and radar charts, optimization results.
- FastAPI backend in `backend/main.py` with `/api/predict`, `/api/batch_predict`, `/api/similar`, `/api/elements`.
- `extract_physics`, `predict_properties`, and a distance-weighted KNN trained from `hea_database.csv`.
- The KNN neighbor spread is a heuristic uncertainty proxy, not a calibrated prediction interval.

## Target architecture

```text
React Research Workspace (goal, constraints, candidate cards, run history)
  -> FastAPI /api/agent/research (validated request)
     -> Research Orchestrator (bounded plan -> tool calls -> evaluate -> report)
        -> Composition Generator / Optimizer
        -> Existing Physics Calculator
        -> Existing ML Predictor
        -> Scientific Validator / Evidence Formatter
     -> Structured result: plan, tool trace, ranked candidates, limitations
```

The initial research workflow is deterministic and reproducible. An optional LLM planner can later translate natural-language requests into the same typed research specification and explain results. **The LLM never invents physical measurements or bypasses deterministic validation.** No model key is required for the deterministic workflow.

## Phases
1. **Architecture and foundations**: design, bounded composition search engine, objective scoring, scientific warnings, tests. No changes to production endpoints.
2. **Backend integration**: typed `/api/agent/research` endpoint; invoke existing prediction and physics functions; enforce max tool calls, valid elements, fractions, input size, timeouts, and explicit errors; test FastAPI.
3. **Research workspace UI**: add Research Agent tab with goals, constraints, progress, candidate comparisons, uncertainty, and error states. Existing dashboard remains available.
4. **Optional LLM orchestration**: provider-agnostic adapter / LangGraph workflow with strict tool schemas, allowlist, step budget, trace IDs, and human confirmation before external actions. Keep API credentials server-side.
5. **Validation and release**: evaluation suite, held-out alloy checks, error analysis, data provenance, rate limits, deployment secrets, CI, and staged rollout.

## Research goals and scoring
Initial goals: maximize predicted yield strength, maximize predicted hardness, minimize calculated density, or balanced strength-to-density. Candidates are filtered by allowed elements, element count, atomic-percent bounds, and physics validity. Score is transparent and deterministic. Return Pareto trade-offs where possible.

## Scientific and security guardrails
- Never equate a KNN prediction with an experimental result.
- Label uncertainty as a *neighbor-spread proxy*, not a statistical confidence interval.
- The existing `confidence` field is a distance heuristic; avoid interpreting it as a probability.
- Check out-of-distribution distance, missing training coverage, incomplete binary mixing enthalpy data, and phase heuristics.
- Require independent validation before making fabrication or safety claims.
- Cap candidate counts, iteration budgets, and token/model spend; log tool calls without storing secrets.
- Keep LLM keys only on the server, not in Vite environment variables.
- No external write actions without user approval.

## Acceptance criteria
- Given identical input and seed, research produces identical ranked compositions.
- All candidates use supported elements, nonnegative fractions summing to 100%, and obey constraints.
- Unsupported elements and impossible constraints fail clearly.
- Existing `/api/predict` behavior and UI remain unchanged.
- Results show the objective, candidate compositions, predictions, limitations, and tool trace.
- Tests cover invalid input, search bounds, and scoring.
