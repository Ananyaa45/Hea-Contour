import React from 'react';

export function LivePhysicsDisplay({ data }) {
    if (!data?.physics) return null;

    function generateLiveExplanation(phys) {
        if (!phys || Object.keys(phys).length === 0) return "No data yet.";
        const out = [];

        if (phys.VEC < 6) out.push("Low VEC → BCC/HCP tendency (strong but less ductile)");
        else if (phys.VEC < 8) out.push("Moderate VEC → BCC structure likely");
        else out.push("High VEC → FCC structure (ductile)");

        if (phys.delta < 4) out.push("Low atomic mismatch → very stable solid solution");
        else if (phys.delta < 6.5) out.push("Moderate mismatch → solid solution possible");
        else out.push("High mismatch → intermetallic risk");

        if (phys.dChi < 0.1) out.push("Low electronegativity difference → stable mixing");
        else if (phys.dChi < 0.25) out.push("Moderate chemical difference");
        else out.push("High chemical difference → phase separation risk");

        const omegaVal = Number(phys.omega) || 0;
        if (omegaVal > 1.5) out.push("High Ω → strong solid solution stability");
        else if (omegaVal > 1) out.push("Ω > 1 → stable region");
        else out.push("Low Ω → instability");

        if (phys.density_calc < 5) out.push("Lightweight alloy");
        else if (phys.density_calc > 8) out.push("High density (heavy alloy)");

        out.push(`Phase predicted: ${phys.phase}`);
        return out.join(". ") + ".";
    }

    return (
        <div className="card">
            <p>VEC: {data.physics?.VEC ?? "-"}</p>
            <p>Density: {data.physics?.density_calc ?? "-"} g/cm³</p>
            <p>Tm: {data.physics?.Tm_avg ?? "-"} K</p>
            <p>δ: {data.physics?.delta ?? "-"}</p>
            <p>Δχ: {data.physics?.dChi ?? "-"}</p>
            <p>Ω: {data.physics?.omega ?? "-"}</p>

            <p><b>YS:</b> {data?.ml?.YS_pred != null ? data.ml.YS_pred.toFixed(2) : "-"}</p>
            <p><b>HV:</b> {data?.ml?.HV_pred != null ? data.ml.HV_pred.toFixed(2) : "-"}</p>

            <p><b>Structure:</b> {data.physics?.structure ?? "-"}</p>
            <p>Phase: {data.physics?.phase ?? "-"}</p>

            <p><b>Phase Fractions:</b></p>
            <p>FCC: {data.physics?.phase_fractions?.FCC ?? "-"}</p>
            <p>BCC: {data.physics?.phase_fractions?.BCC ?? "-"}</p>
            <p>HCP: {data.physics?.phase_fractions?.HCP ?? "-"}</p>

            <hr style={{ margin: "10px 0" }} />

            <p style={{ fontSize: "14px", color: "#374151" }}>
                <b>Live Interpretation:</b><br />
                {generateLiveExplanation(data?.physics || {})}
            </p>
            <p style={{ fontSize: "14px", color: "#1e40af" }}>
                <b>Physics-Based Explanation:</b><br />
                {data.physics?.explanation || "-"}
            </p>
        </div>
    );
}
