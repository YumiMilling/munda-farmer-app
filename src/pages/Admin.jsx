import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { signOut } from "../lib/auth";

const C = {
  ochre: "#B8622D", ochrePale: "#F0DCC8",
  green: "#2D5A27", greenPale: "#D5E8D0",
  char: "#2C2C2C", charLight: "#3D3D3D",
  mid: "#7A746B", midLight: "#A09A92",
  warm: "#F5F0E8", warmDark: "#E8E1D5",
  white: "#FEFDFB",
  alert: "#C4652A", alertPale: "#FDF0E6",
};
const font = "'Source Sans 3', -apple-system, system-ui, sans-serif";

// ── Stats helpers ──
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}
function tTest(a, b) {
  // Welch's t-test for two independent samples
  if (a.length < 2 || b.length < 2) return { t: 0, p: 1, significant: false };
  const mA = mean(a), mB = mean(b);
  const vA = stdDev(a) ** 2 / a.length, vB = stdDev(b) ** 2 / b.length;
  const se = Math.sqrt(vA + vB);
  if (se === 0) return { t: 0, p: 1, significant: false };
  const t = (mB - mA) / se;
  const df = (vA + vB) ** 2 / ((vA ** 2 / (a.length - 1)) + (vB ** 2 / (b.length - 1)));
  // Approximate p-value using normal distribution for large df
  const p = df > 30 ? 2 * (1 - normalCDF(Math.abs(t))) : null;
  return { t: t.toFixed(2), p: p ? p.toFixed(3) : "~", significant: p !== null && p < 0.05, df: Math.round(df) };
}
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// ── Styles ──
const card = { background: C.white, borderRadius: 8, padding: "20px 24px", marginBottom: 16, border: "1px solid " + C.warmDark };
const statBox = { background: C.warm, borderRadius: 8, padding: "16px 20px", textAlign: "center", flex: 1 };
const statNum = { fontSize: 28, fontWeight: 800, color: C.char, letterSpacing: -1 };
const statLabel = { fontSize: 11, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4 };
const sel = { padding: "8px 12px", border: "1.5px solid " + C.warmDark, borderRadius: 6, fontSize: 14, fontFamily: font, background: C.white, color: C.char, outline: "none" };
const thStyle = { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "2px solid " + C.warmDark, background: C.warm, position: "sticky", top: 0 };
const tdStyle = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid " + C.warmDark, verticalAlign: "top" };
const tagOk = { fontSize: 11, padding: "2px 8px", borderRadius: 10, background: C.greenPale, color: C.green, fontWeight: 600 };
const tagBad = { fontSize: 11, padding: "2px 8px", borderRadius: 10, background: C.alertPale, color: C.alert, fontWeight: 600 };
const tagNeutral = { fontSize: 11, padding: "2px 8px", borderRadius: 10, background: C.warm, color: C.mid, fontWeight: 600 };

function Badge({ text, ok }) {
  return <span style={ok === true ? tagOk : ok === false ? tagBad : tagNeutral}>{text}</span>;
}

export default function Admin() {
  const [groups, setGroups] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [obs, setObs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Filters
  const [fGroup, setFGroup] = useState("");
  const [fHost, setFHost] = useState("");
  const [fPractice, setFPractice] = useState("");
  const [fMeeting, setFMeeting] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  // View
  const [view, setView] = useState("overview"); // overview, table, yields, quality

  async function loadData() {
    setLoading(true);
    const [gRes, hRes, oRes] = await Promise.all([
      supabase.from("ffs_groups").select("*").order("name"),
      supabase.from("ffs_hosts").select("*").order("name"),
      supabase.from("ffs_observations").select("*").order("date", { ascending: false }),
    ]);
    if (gRes.data) setGroups(gRes.data);
    if (hRes.data) setHosts(hRes.data);
    if (oRes.data) setObs(oRes.data);
    setLastRefresh(new Date());
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // Filtered observations
  const filtered = useMemo(() => {
    return obs.filter(o => {
      if (fGroup && o.group_id !== fGroup) return false;
      if (fHost && o.host_id !== fHost) return false;
      if (fPractice && o.practice !== fPractice) return false;
      if (fMeeting && o.meeting_type !== fMeeting) return false;
      if (fDateFrom && o.date < fDateFrom) return false;
      if (fDateTo && o.date > fDateTo) return false;
      return true;
    });
  }, [obs, fGroup, fHost, fPractice, fMeeting, fDateFrom, fDateTo]);

  const filteredHosts = fGroup ? hosts.filter(h => h.group_id === fGroup) : hosts;

  // Computed stats
  const stats = useMemo(() => {
    const f = filtered;
    const withYield = f.filter(o => o.yield_a > 0 && o.yield_b > 0);
    const sizeIssues = f.filter(o => o.same_size === "No").length;
    const varIssues = f.filter(o => o.one_var && o.one_var.startsWith("No")).length;
    const withGPS = f.filter(o => o.lat).length;
    const withProblems = f.filter(o => o.problems && o.problems.trim()).length;
    const totalAttendance = f.reduce((s, o) => s + (o.attendance || 0), 0);

    // Yields
    const yieldsA = withYield.map(o => parseFloat(o.yield_a) * 267);
    const yieldsB = withYield.map(o => parseFloat(o.yield_b) * 267);
    const diffs = withYield.map(o => ((o.yield_b - o.yield_a) / o.yield_a) * 100);

    // By practice
    const byPractice = {};
    f.forEach(o => {
      const p = o.practice === "Other" ? (o.practice_other || "Other") : (o.practice || "Unknown");
      if (!byPractice[p]) byPractice[p] = { n: 0, issues: 0, yields: [] };
      byPractice[p].n++;
      if (o.same_size === "No" || (o.one_var && o.one_var.startsWith("No"))) byPractice[p].issues++;
      if (o.yield_a > 0 && o.yield_b > 0) byPractice[p].yields.push({ a: parseFloat(o.yield_a) * 267, b: parseFloat(o.yield_b) * 267 });
    });

    // By group
    const byGroup = {};
    f.forEach(o => {
      if (!byGroup[o.group_id]) byGroup[o.group_id] = { n: 0, issues: 0, attendance: 0 };
      byGroup[o.group_id].n++;
      if (o.same_size === "No" || (o.one_var && o.one_var.startsWith("No"))) byGroup[o.group_id].issues++;
      byGroup[o.group_id].attendance += o.attendance || 0;
    });

    return { total: f.length, withYield: withYield.length, sizeIssues, varIssues, withGPS, withProblems, totalAttendance, yieldsA, yieldsB, diffs, byPractice, byGroup };
  }, [filtered]);

  // CSV export
  function exportCSV() {
    const headers = ["date", "group", "host", "meeting_type", "practice", "attendance", "lat", "lng", "same_size", "one_var", "vis_diff", "group_saw", "fac_saw", "problems", "yield_a_kg_ha", "yield_b_kg_ha", "price", "cost_a", "cost_b"];
    const rows = filtered.map(o => {
      const grp = groups.find(g => g.id === o.group_id);
      const host = hosts.find(h => h.id === o.host_id);
      return [o.date, grp?.name || "", host?.name || "", o.meeting_type, o.practice === "Other" ? o.practice_other : o.practice, o.attendance || "", o.lat || "", o.lng || "", o.same_size || "", o.one_var || "", o.vis_diff || "", `"${(o.group_saw || "").replace(/"/g, '""')}"`, `"${(o.fac_saw || "").replace(/"/g, '""')}"`, `"${(o.problems || "").replace(/"/g, '""')}"`, o.yield_a ? (parseFloat(o.yield_a) * 267).toFixed(0) : "", o.yield_b ? (parseFloat(o.yield_b) * 267).toFixed(0) : "", o.price || "", o.cost_a || "", o.cost_b || ""].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `munda-ffs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const practices = [...new Set(obs.map(o => o.practice).filter(Boolean))];
  const meetings = [...new Set(obs.map(o => o.meeting_type).filter(Boolean))];

  if (loading) return <div style={{ maxWidth: 960, margin: "0 auto", padding: 60, textAlign: "center", color: C.mid, fontFamily: font }}>Loading dashboard...</div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", fontFamily: font, fontSize: 15, color: C.char, lineHeight: 1.5, background: C.warm, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: C.char, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 18, color: C.ochre, letterSpacing: 0.5 }}>Munda</span>
          <span style={{ fontSize: 12, color: C.mid, marginLeft: 12, letterSpacing: 1 }}>ADMIN DASHBOARD</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.mid }}>{lastRefresh ? "Updated " + lastRefresh.toLocaleTimeString() : ""}</span>
          <button onClick={loadData} style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: font, cursor: "pointer", background: C.ochre, color: "#fff" }}>Refresh</button>
          <a href="/" style={{ fontSize: 12, color: C.mid, textDecoration: "none" }}>Field view</a>
          <button onClick={signOut} style={{ padding: "6px 14px", border: "1px solid " + C.mid + "44", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: font, cursor: "pointer", background: "transparent", color: C.mid }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Filters */}
        <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginBottom: 4 }}>GROUP</div>
            <select value={fGroup} onChange={e => { setFGroup(e.target.value); setFHost(""); }} style={sel}>
              <option value="">All groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginBottom: 4 }}>HOST</div>
            <select value={fHost} onChange={e => setFHost(e.target.value)} style={sel}>
              <option value="">All hosts</option>
              {filteredHosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginBottom: 4 }}>PRACTICE</div>
            <select value={fPractice} onChange={e => setFPractice(e.target.value)} style={sel}>
              <option value="">All practices</option>
              {practices.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginBottom: 4 }}>MEETING</div>
            <select value={fMeeting} onChange={e => setFMeeting(e.target.value)} style={sel}>
              <option value="">All types</option>
              {meetings.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginBottom: 4 }}>FROM</div>
            <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={sel} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginBottom: 4 }}>TO</div>
            <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={sel} />
          </div>
          <button onClick={() => { setFGroup(""); setFHost(""); setFPractice(""); setFMeeting(""); setFDateFrom(""); setFDateTo(""); }} style={{ padding: "8px 14px", border: "1px solid " + C.warmDark, borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: font, cursor: "pointer", background: C.white, color: C.mid }}>Clear</button>
          <button onClick={exportCSV} style={{ padding: "8px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: font, cursor: "pointer", background: C.green, color: "#fff" }}>Export CSV</button>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 6, overflow: "hidden" }}>
          {[["overview", "Overview"], ["table", "All Data"], ["yields", "Yield Analysis"], ["quality", "Methodology"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", background: view === id ? C.ochre : C.white, color: view === id ? "#fff" : C.mid, fontSize: 13, fontWeight: 700, fontFamily: font, borderBottom: view !== id ? "2px solid " + C.warmDark : "none" }}>{label}</button>
          ))}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {view === "overview" && <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {[[stats.total, "Observations"], [stats.totalAttendance, "Total Attendance"], [stats.withYield, "With Yields"], [stats.withGPS, "With GPS"], [groups.length, "Groups"], [hosts.length, "Host Farmers"]].map(([n, l]) => (
              <div key={l} style={statBox}><div style={statNum}>{n}</div><div style={statLabel}>{l}</div></div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* By practice */}
            <div style={{ ...card, flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>By Practice</div>
              {Object.entries(stats.byPractice).sort((a, b) => b[1].n - a[1].n).map(([p, d]) => (
                <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + C.warmDark }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p}</div>
                    <div style={{ fontSize: 12, color: C.mid }}>{d.n} obs{d.yields.length > 0 ? ` · ${d.yields.length} yields` : ""}</div>
                  </div>
                  {d.issues > 0 && <Badge text={d.issues + " issues"} ok={false} />}
                </div>
              ))}
            </div>

            {/* By group */}
            <div style={{ ...card, flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>By Group</div>
              {Object.entries(stats.byGroup).sort((a, b) => b[1].n - a[1].n).map(([gid, d]) => {
                const grp = groups.find(g => g.id === gid);
                return (
                  <div key={gid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + C.warmDark }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{grp?.name || gid}</div>
                      <div style={{ fontSize: 12, color: C.mid }}>{d.n} obs · {d.attendance} attendance</div>
                    </div>
                    {d.issues > 0 && <Badge text={d.issues + " issues"} ok={false} />}
                  </div>
                );
              })}
            </div>
          </div>
        </>}

        {/* ═══ TABLE ═══ */}
        {view === "table" && (
          <div style={{ ...card, padding: 0, overflow: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Date", "Group", "Host", "Type", "Practice", "Att.", "Size", "1 Var", "Diff", "GPS", "A kg/ha", "B kg/ha", "%"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const grp = groups.find(g => g.id === o.group_id);
                  const host = hosts.find(h => h.id === o.host_id);
                  const hasY = o.yield_a > 0 && o.yield_b > 0;
                  const pct = hasY ? (((o.yield_b - o.yield_a) / o.yield_a) * 100).toFixed(0) : "";
                  return (
                    <tr key={o.id} style={{ background: C.white }}>
                      <td style={tdStyle}>{o.date}</td>
                      <td style={{ ...tdStyle, color: C.ochre, fontWeight: 600 }}>{grp?.name || "?"}</td>
                      <td style={tdStyle}>{host?.name || ""}</td>
                      <td style={tdStyle}>{o.meeting_type}</td>
                      <td style={tdStyle}>{o.practice === "Other" ? o.practice_other : o.practice}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{o.attendance || ""}</td>
                      <td style={tdStyle}>{o.same_size && <Badge text={o.same_size} ok={o.same_size === "Yes" ? true : o.same_size === "No" ? false : null} />}</td>
                      <td style={tdStyle}>{o.one_var && <Badge text={o.one_var.startsWith("Yes") ? "Yes" : o.one_var.startsWith("No") ? "No" : "?"} ok={o.one_var.startsWith("Yes") ? true : o.one_var.startsWith("No") ? false : null} />}</td>
                      <td style={tdStyle}>{o.vis_diff || ""}</td>
                      <td style={tdStyle}>{o.lat ? "\u{1F4CD}" : ""}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{hasY ? (parseFloat(o.yield_a) * 267).toLocaleString() : ""}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{hasY ? (parseFloat(o.yield_b) * 267).toLocaleString() : ""}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: pct && parseFloat(pct) >= 0 ? C.green : C.alert }}>{pct ? (parseFloat(pct) >= 0 ? "+" : "") + pct + "%" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.mid }}>No observations match filters.</div>}
          </div>
        )}

        {/* ═══ YIELD ANALYSIS ═══ */}
        {view === "yields" && (() => {
          const withYield = filtered.filter(o => o.yield_a > 0 && o.yield_b > 0);
          if (withYield.length === 0) return <div style={{ ...card, textAlign: "center", color: C.mid, padding: 40 }}>No yield data in current filter.</div>;

          const yA = withYield.map(o => parseFloat(o.yield_a) * 267);
          const yB = withYield.map(o => parseFloat(o.yield_b) * 267);
          const test = tTest(yA, yB);

          // By practice
          const byP = {};
          withYield.forEach(o => {
            const p = o.practice === "Other" ? (o.practice_other || "Other") : o.practice;
            if (!byP[p]) byP[p] = { a: [], b: [] };
            byP[p].a.push(parseFloat(o.yield_a) * 267);
            byP[p].b.push(parseFloat(o.yield_b) * 267);
          });

          return <>
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Overall Yield Comparison ({withYield.length} observations)</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={statBox}>
                  <div style={{ ...statNum, color: C.mid }}>{Math.round(mean(yA)).toLocaleString()}</div>
                  <div style={statLabel}>Mean A (kg/ha)</div>
                  <div style={{ fontSize: 11, color: C.midLight, marginTop: 2 }}>\u00B1{Math.round(stdDev(yA)).toLocaleString()}</div>
                </div>
                <div style={statBox}>
                  <div style={{ ...statNum, color: C.green }}>{Math.round(mean(yB)).toLocaleString()}</div>
                  <div style={statLabel}>Mean B (kg/ha)</div>
                  <div style={{ fontSize: 11, color: C.midLight, marginTop: 2 }}>\u00B1{Math.round(stdDev(yB)).toLocaleString()}</div>
                </div>
                <div style={statBox}>
                  <div style={{ ...statNum, color: mean(yB) > mean(yA) ? C.green : C.alert }}>{mean(yA) > 0 ? ((mean(yB) - mean(yA)) / mean(yA) * 100).toFixed(1) : 0}%</div>
                  <div style={statLabel}>Mean Difference</div>
                </div>
              </div>

              {withYield.length >= 4 && (
                <div style={{ background: C.warm, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, marginBottom: 8, textTransform: "uppercase" }}>Statistical Test (Welch's t-test)</div>
                  <div style={{ fontSize: 14 }}>
                    t = {test.t}, df = {test.df}, p = {test.p}
                    {test.significant !== null && (
                      <span style={{ marginLeft: 12, fontWeight: 700, color: test.significant ? C.green : C.mid }}>
                        {test.significant ? "\u2713 Significant (p < 0.05)" : "Not significant (p \u2265 0.05)"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>
                    {withYield.length < 10 ? "Warning: small sample size (" + withYield.length + "). Results should be interpreted with caution." : "Sample size: " + withYield.length + " paired observations."}
                  </div>
                </div>
              )}

              {/* Individual observations */}
              <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, marginBottom: 8, textTransform: "uppercase" }}>Individual Results</div>
              {withYield.map(o => {
                const host = hosts.find(h => h.id === o.host_id);
                const grp = groups.find(g => g.id === o.group_id);
                const a = parseFloat(o.yield_a) * 267, b = parseFloat(o.yield_b) * 267;
                const pct = ((b - a) / a * 100).toFixed(0);
                return (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid " + C.warmDark, fontSize: 13 }}>
                    <span style={{ color: C.mid, width: 80, flexShrink: 0 }}>{o.date}</span>
                    <span style={{ color: C.ochre, fontWeight: 600, width: 80, flexShrink: 0 }}>{grp?.name || "?"}</span>
                    <span style={{ flex: 1 }}>{host?.name || "?"} — {o.practice === "Other" ? o.practice_other : o.practice}</span>
                    <span style={{ width: 70, textAlign: "right", fontWeight: 600 }}>{a.toLocaleString()}</span>
                    <span style={{ width: 70, textAlign: "right", fontWeight: 600 }}>{b.toLocaleString()}</span>
                    <span style={{ width: 60, textAlign: "right", fontWeight: 700, color: parseFloat(pct) >= 0 ? C.green : C.alert }}>{parseFloat(pct) >= 0 ? "+" : ""}{pct}%</span>
                  </div>
                );
              })}
            </div>

            {/* By practice breakdown */}
            {Object.keys(byP).length > 1 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ochre, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>By Practice</div>
                {Object.entries(byP).sort((a, b) => b[1].a.length - a[1].a.length).map(([p, d]) => {
                  const pTest = d.a.length >= 2 ? tTest(d.a, d.b) : null;
                  return (
                    <div key={p} style={{ padding: "12px 0", borderBottom: "1px solid " + C.warmDark }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p} <span style={{ fontWeight: 400, color: C.mid }}>({d.a.length} obs)</span></div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        <span>A: {Math.round(mean(d.a)).toLocaleString()} kg/ha</span>
                        <span>B: {Math.round(mean(d.b)).toLocaleString()} kg/ha</span>
                        <span style={{ fontWeight: 700, color: mean(d.b) > mean(d.a) ? C.green : C.alert }}>
                          {mean(d.a) > 0 ? ((mean(d.b) - mean(d.a)) / mean(d.a) * 100).toFixed(1) : 0}%
                        </span>
                        {pTest && pTest.p !== "~" && <span style={{ color: C.mid }}>p={pTest.p}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>;
        })()}

        {/* ═══ METHODOLOGY QUALITY ═══ */}
        {view === "quality" && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.alert, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Methodology Quality ({filtered.length} observations)</div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ ...statBox, background: stats.sizeIssues === 0 ? C.greenPale : C.alertPale }}>
                <div style={{ ...statNum, color: stats.sizeIssues === 0 ? C.green : C.alert }}>{stats.sizeIssues}</div>
                <div style={statLabel}>Wrong Size</div>
              </div>
              <div style={{ ...statBox, background: stats.varIssues === 0 ? C.greenPale : C.alertPale }}>
                <div style={{ ...statNum, color: stats.varIssues === 0 ? C.green : C.alert }}>{stats.varIssues}</div>
                <div style={statLabel}>Multi Variable</div>
              </div>
              <div style={statBox}>
                <div style={statNum}>{stats.withProblems}</div>
                <div style={statLabel}>With Problems</div>
              </div>
              <div style={statBox}>
                <div style={statNum}>{stats.withGPS}</div>
                <div style={statLabel}>GPS Tagged</div>
              </div>
            </div>

            {/* Problem observations */}
            {(() => {
              const issues = filtered.filter(o => o.same_size === "No" || (o.one_var && o.one_var.startsWith("No")) || (o.problems && o.problems.trim()));
              if (issues.length === 0) return <div style={{ textAlign: "center", color: C.green, fontWeight: 600, padding: 20 }}>{"\u2713"} No methodology issues found.</div>;
              return <>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, marginBottom: 8, textTransform: "uppercase" }}>Issues to Address</div>
                {issues.map(o => {
                  const grp = groups.find(g => g.id === o.group_id);
                  const host = hosts.find(h => h.id === o.host_id);
                  return (
                    <div key={o.id} style={{ background: C.warm, borderRadius: 6, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{o.date} · {grp?.name || "?"}{host ? " · " + host.name : ""}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                        {o.same_size === "No" && <Badge text="Wrong plot size" ok={false} />}
                        {o.one_var && o.one_var.startsWith("No") && <Badge text="Multiple variables" ok={false} />}
                      </div>
                      {o.problems && <div style={{ fontSize: 12, color: C.alert }}>{o.problems}</div>}
                    </div>
                  );
                })}
              </>;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
