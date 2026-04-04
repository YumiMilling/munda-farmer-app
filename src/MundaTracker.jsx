import { useState, useEffect, useCallback } from "react";
import { pullAll, pushObservation, pushHost, pushGroup, deleteHost as deleteHostRemote, processQueue } from "./lib/sync";
import { signOut } from "./lib/auth";

// ── Design tokens ──
const T = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F2ED",
  border: "#E8E4DE",
  borderLight: "#F0ECE6",
  text: "#1A1A1A",
  textSec: "#6B6560",
  textTer: "#9E9890",
  ochre: "#C06B2D",
  ochreLight: "#F8EDE3",
  green: "#2E7D4F",
  greenLight: "#E8F5EC",
  greenDark: "#1B5E35",
  blue: "#3B7DD8",
  blueLight: "#EBF2FC",
  red: "#D14B4B",
  redLight: "#FDECEC",
  amber: "#D19A2B",
  amberLight: "#FDF5E3",
  radius: 12,
  radiusSm: 8,
  font: "'Inter', 'Source Sans 3', -apple-system, system-ui, sans-serif",
};

const MEETINGS = [
  { id: "pre", label: "Pre-season planning", icon: "📋", desc: "Planning what to test this season" },
  { id: "mid", label: "Mid-season observation", icon: "🔍", desc: "Checking crop progress & health" },
  { id: "post", label: "Post-harvest review", icon: "📊", desc: "Measuring results & economics" },
];

const PRACTICES = ["Manure handling","Fertiliser comparison","Variety comparison","Intercropping","Conservation agriculture","Minimum tillage","Green manure / velvet bean","Rotation","Spacing trial","Feed comparison (livestock)","Other"];

const PESTS = ["Fall armyworm","Stalk borer","Aphids","Termites","Grasshoppers","Other"];
const DISEASES = ["Grey leaf spot","Maize streak virus","Rust","Leaf blight","Root rot","Other"];

const KEYS = {consent:"munda-consent",groups:"munda-groups",hosts:"munda-hosts",obs:"munda-obs"};
function ld(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null}catch{return null}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.error(e)}}
function uid(){return crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

// ── Reusable components ──

function StepShell({ step, total, title, subtitle, children, onBack, onNext, nextLabel, nextDisabled, accent }) {
  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: T.bg, fontFamily: T.font }}>
      {/* Progress */}
      <div style={{ height: 3, background: T.border }}>
        <div style={{ height: "100%", width: `${(step / total) * 100}%`, background: accent || T.green, transition: "width 0.3s ease" }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "32px 20px 100px", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {title && <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: "0 0 4px", letterSpacing: -0.5 }}>{title}</h2>}
        {subtitle && <p style={{ fontSize: 14, color: T.textSec, margin: "0 0 28px", lineHeight: 1.5 }}>{subtitle}</p>}
        {children}
      </div>

      {/* Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", background: "rgba(250,250,247,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid " + T.borderLight, display: "flex", gap: 12, justifyContent: "space-between", zIndex: 50 }}>
        {onBack ? <button onClick={onBack} style={{ padding: "14px 24px", border: "none", borderRadius: T.radius, fontSize: 15, fontWeight: 600, fontFamily: T.font, cursor: "pointer", background: "transparent", color: T.textSec }}>Back</button> : <div />}
        {onNext && <button onClick={onNext} disabled={nextDisabled} style={{ padding: "14px 32px", border: "none", borderRadius: T.radius, fontSize: 15, fontWeight: 600, fontFamily: T.font, cursor: nextDisabled ? "default" : "pointer", background: nextDisabled ? T.border : (accent || T.green), color: "#fff", opacity: nextDisabled ? 0.5 : 1, transition: "all 0.15s", boxShadow: nextDisabled ? "none" : "0 2px 8px rgba(46,125,79,0.25)" }}>{nextLabel || "Continue"}</button>}
      </div>
    </div>
  );
}

function BigSelect({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map(o => (
        <button key={o.id || o} onClick={() => onChange(o.id || o)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: (value === (o.id || o)) ? T.greenLight : T.surface, border: `2px solid ${(value === (o.id || o)) ? T.green : T.border}`, borderRadius: T.radius, cursor: "pointer", textAlign: "left", fontFamily: T.font, transition: "all 0.15s" }}>
          {o.icon && <span style={{ fontSize: 24 }}>{o.icon}</span>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{o.label || o}</div>
            {o.desc && <div style={{ fontSize: 13, color: T.textSec, marginTop: 2 }}>{o.desc}</div>}
          </div>
          {(value === (o.id || o)) && <span style={{ color: T.green, fontSize: 18, fontWeight: 700 }}>✓</span>}
        </button>
      ))}
    </div>
  );
}

function ChipGroup({ options, value, onChange, multi }) {
  const selected = multi ? (value || []) : [value];
  const toggle = (o) => {
    if (multi) {
      const arr = value || [];
      onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
    } else {
      onChange(value === o ? "" : o);
    }
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(o => {
        const on = selected.includes(o);
        return <button key={o} onClick={() => toggle(o)} style={{ padding: "10px 18px", borderRadius: 24, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: T.font, background: on ? T.green : T.surface, color: on ? "#fff" : T.text, border: `1.5px solid ${on ? T.green : T.border}`, transition: "all 0.12s" }}>{o}</button>;
      })}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: value ? T.greenLight : T.surface, border: `1.5px solid ${value ? T.green : T.border}`, borderRadius: T.radius, cursor: "pointer", textAlign: "left", fontFamily: T.font, width: "100%", transition: "all 0.15s", marginBottom: 10 }}>
      <div style={{ width: 44, height: 26, borderRadius: 13, background: value ? T.green : T.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 2, left: value ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 13, color: T.textSec, marginTop: 2 }}>{desc}</div>}
      </div>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>{label}</div>}
      {children}
    </div>
  );
}

function Input(props) {
  return <input {...props} style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 16, fontFamily: T.font, background: T.surface, color: T.text, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s", ...props.style }} onFocus={e => e.target.style.borderColor = T.green} onBlur={e => e.target.style.borderColor = T.border} />;
}

function TextArea(props) {
  return <textarea {...props} style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 16, fontFamily: T.font, background: T.surface, color: T.text, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 80, transition: "border-color 0.15s", ...props.style }} onFocus={e => e.target.style.borderColor = T.green} onBlur={e => e.target.style.borderColor = T.border} />;
}

function Select({ options, value, onChange, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 16, fontFamily: T.font, background: T.surface, color: value ? T.text : T.textTer, outline: "none", appearance: "auto" }}>
      <option value="">{placeholder || "Select..."}</option>
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.border, margin: "24px 0" }} />;
}

function StatusPill({ text, color }) {
  const colors = { green: [T.greenLight, T.green], red: [T.redLight, T.red], amber: [T.amberLight, T.amber], blue: [T.blueLight, T.blue], gray: [T.surfaceAlt, T.textTer] };
  const [bg, fg] = colors[color] || colors.gray;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color: fg }}>{text}</span>;
}

// ── Consent ──
function ConsentScreen({ onOk }) {
  const [ck, setCk] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: T.font }}>
      <div style={{ background: T.surface, borderRadius: 16, padding: 28, maxWidth: 400, width: "100%" }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: T.text }}>Before you start</div>
        <p style={{ fontSize: 14, color: T.textSec, marginBottom: 20, lineHeight: 1.6 }}>This tool collects FFS observation data including optional GPS location. Data is stored and shared with the Grassroots Trust FFS programme coordinator.</p>
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, cursor: "pointer", marginBottom: 24 }}>
          <input type="checkbox" checked={ck} onChange={() => setCk(!ck)} style={{ marginTop: 3, accentColor: T.green, width: 18, height: 18 }} />
          <span style={{ color: T.text, lineHeight: 1.5 }}>I have permission from the FFS host farmer and group to share observation data.</span>
        </label>
        <button disabled={!ck} onClick={onOk} style={{ display: "block", width: "100%", padding: 14, border: "none", borderRadius: T.radius, fontSize: 15, fontWeight: 700, fontFamily: T.font, cursor: ck ? "pointer" : "default", background: ck ? T.green : T.border, color: "#fff", opacity: ck ? 1 : 0.5 }}>Continue</button>
      </div>
    </div>
  );
}

// ── Observation Wizard ──
function ObsWizard({ groups, hosts, onSave, onCancel }) {
  const blank = { id: uid(), date: new Date().toISOString().slice(0, 10), groupId: "", hostId: "", meetingType: "", practice: "", practiceOther: "", attendance: "", lat: "", lng: "", gpsAcc: "", sameSize: "", oneVar: "", visDiff: "", groupSaw: "", facSaw: "", problems: "", hasPests: false, pests: [], pestOther: "", hasDiseases: false, diseases: [], diseaseOther: "", hasSprayed: false, sprayProduct: "", sprayPlot: "", hasFertiliser: false, fertType: "", fertPlot: "", fertWhen: "", weedingDone: "", weedingCount: "", weedPressure: "", droughtStress: false, droughtPlot: "", cropVigour: "", soilMoisture: "", germination: "", hasYield: false, yieldA: "", yieldB: "", price: "", costA: "", costB: "", unit: "ha", stoverBurned: "", pigeonPeaStanding: "", nextSeasonDiscussed: false };
  const [f, setF] = useState(blank);
  const [step, setStep] = useState(0);
  const [gps, setGps] = useState("idle");
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const gH = hosts.filter(h => h.groupId === f.groupId);
  const mt = f.meetingType;
  const isMid = mt === "mid";
  const isPost = mt === "post";
  const isMidOrPost = isMid || isPost;

  // Build step sequence based on meeting type
  const steps = ["group", "meeting", "gps"];
  if (f.groupId && gH.length > 0) steps.splice(1, 0, "host");
  if (isMidOrPost) steps.push("practice");
  if (isMidOrPost) steps.push("comparison");
  if (isMid) steps.push("health");
  if (isMidOrPost) steps.push("observations");
  if (isPost) steps.push("yield");
  if (isPost) steps.push("postharvest");
  steps.push("review");

  const cur = steps[step] || "group";
  const total = steps.length;

  function getGPS() {
    if (!navigator.geolocation) { setGps("denied"); return; }
    setGps("getting");
    navigator.geolocation.getCurrentPosition(
      pos => { set("lat", pos.coords.latitude.toFixed(6)); set("lng", pos.coords.longitude.toFixed(6)); set("gpsAcc", Math.round(pos.coords.accuracy).toString()); setGps("got"); },
      () => setGps("denied"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function handleSave() {
    onSave({ ...f, savedAt: new Date().toISOString(), meetingType: MEETINGS.find(m => m.id === f.meetingType)?.label || f.meetingType });
    setSaved(true);
    setTimeout(() => { setSaved(false); setF({ ...blank, id: uid(), groupId: f.groupId }); setStep(0); setGps("idle"); }, 2000);
  }

  const canNext = () => {
    switch (cur) {
      case "group": return !!f.groupId;
      case "meeting": return !!f.meetingType;
      default: return true;
    }
  };

  const next = () => step < total - 1 && setStep(step + 1);
  const back = () => step > 0 && setStep(step - 1);

  // ── Gross margin calc ──
  const mult = f.unit === "ha" ? 267 : 67;
  const yA = parseFloat(f.yieldA) || 0, yB = parseFloat(f.yieldB) || 0, pr = parseFloat(f.price) || 0;
  const cA = parseFloat(f.costA) || 0, cB = parseFloat(f.costB) || 0;
  const incA = yA * mult * pr, incB = yB * mult * pr;
  const profA = incA - cA, profB = incB - cB, diff = profB - profA;
  const hasCalc = yA > 0 && yB > 0 && pr > 0;

  return (
    <StepShell step={step + 1} total={total} title={
      { group: "Which group?", host: "Which host farmer?", meeting: "What type of visit?", gps: "Location & attendance", practice: "What is being tested?", comparison: "Comparison check", health: "Crop health", observations: "What did you see?", yield: "Yield measurements", postharvest: "After harvest", review: "Review & save" }[cur]
    } subtitle={
      { group: "Select the farmer group you're visiting", host: "Select the host farmer for this trial", meeting: "This determines which fields you'll fill in", gps: "Optional GPS and attendance count", practice: "What practice is the comparison trial testing?", comparison: "Checking the trial methodology is sound", health: "Pests, diseases, weeds, moisture", observations: "Record what farmers and you observed", yield: "Plot yields for gross margin analysis", postharvest: "Residue management and next steps", review: "Check everything before saving" }[cur]
    } onBack={step > 0 ? back : onCancel} onNext={cur === "review" ? handleSave : next} nextLabel={cur === "review" ? (saved ? "✓ Saved" : "Save observation") : "Continue"} nextDisabled={!canNext() || saved} accent={cur === "review" ? T.ochre : T.green}>

      {/* ── GROUP ── */}
      {cur === "group" && (
        <BigSelect options={groups.map(g => ({ id: g.id, label: g.name, desc: g.area || undefined }))} value={f.groupId} onChange={v => { set("groupId", v); set("hostId", ""); }} />
      )}

      {/* ── HOST ── */}
      {cur === "host" && (
        gH.length > 0 ? (
          <BigSelect options={gH.map(h => ({ id: h.id, label: h.name, desc: h.practice ? `Testing: ${h.practice}` : undefined }))} value={f.hostId} onChange={v => set("hostId", v)} />
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: T.textSec }}>No host farmers for this group. Add them in Setup.</div>
        )
      )}

      {/* ── MEETING TYPE ── */}
      {cur === "meeting" && (
        <BigSelect options={MEETINGS} value={f.meetingType} onChange={v => set("meetingType", v)} />
      )}

      {/* ── GPS + ATTENDANCE ── */}
      {cur === "gps" && <>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={e => set("date", e.target.value)} />
        </Field>
        <Field label="GPS location">
          <button onClick={getGPS} disabled={gps === "getting"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: gps === "got" ? T.greenLight : T.surface, border: `1.5px solid ${gps === "got" ? T.green : T.border}`, borderRadius: T.radius, cursor: "pointer", fontFamily: T.font, width: "100%" }}>
            <span style={{ fontSize: 20 }}>{gps === "got" ? "✓" : "📍"}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{gps === "idle" ? "Tap to get GPS" : gps === "getting" ? "Getting location..." : gps === "got" ? `${f.lat}, ${f.lng}` : "Location unavailable"}</div>
              {gps === "got" && <div style={{ fontSize: 12, color: T.textSec }}>Accuracy: ±{f.gpsAcc}m</div>}
              {gps === "idle" && <div style={{ fontSize: 12, color: T.textTer }}>Optional but helpful for mapping</div>}
            </div>
          </button>
        </Field>
        <Field label="How many people attended?">
          <Input type="number" placeholder="Number of attendees" value={f.attendance} onChange={e => set("attendance", e.target.value)} />
        </Field>
      </>}

      {/* ── PRACTICE ── */}
      {cur === "practice" && (
        <Field>
          <Select options={PRACTICES} value={f.practice} onChange={v => set("practice", v)} placeholder="Select practice being tested..." />
          {f.practice === "Other" && <div style={{ marginTop: 10 }}><Input placeholder="Describe what's being tested" value={f.practiceOther} onChange={e => set("practiceOther", e.target.value)} /></div>}
        </Field>
      )}

      {/* ── COMPARISON CHECK ── */}
      {cur === "comparison" && <>
        <Field label="Are the two plots the same size? (Standard: 7.5m × 5m)">
          <ChipGroup options={["Yes", "No", "Not sure"]} value={f.sameSize} onChange={v => set("sameSize", v)} />
        </Field>
        <Field label="Is only ONE thing different between the plots?">
          <div style={{ fontSize: 12, color: T.textTer, marginBottom: 8 }}>Same seed, spacing, planting date — except the one variable being tested.</div>
          <ChipGroup options={["Yes, one difference", "No, multiple", "Not sure"]} value={f.oneVar} onChange={v => set("oneVar", v)} />
        </Field>
        <Field label="Can you see a difference between the plots?">
          <ChipGroup options={["Clear", "Some", "None", "Too early"]} value={f.visDiff} onChange={v => set("visDiff", v)} />
        </Field>
      </>}

      {/* ── CROP HEALTH (mid-season) ── */}
      {cur === "health" && <>
        <Toggle label="Any pest damage?" desc="Fall armyworm, stalk borer, etc." value={f.hasPests} onChange={v => set("hasPests", v)} />
        {f.hasPests && <div style={{ padding: "0 0 16px 16px" }}>
          <Field label="Which pests?"><ChipGroup options={PESTS} value={f.pests} onChange={v => set("pests", v)} multi /></Field>
          {f.pests.includes("Other") && <Input placeholder="Describe pest" value={f.pestOther} onChange={e => set("pestOther", e.target.value)} />}
        </div>}

        <Toggle label="Any crop disease?" desc="Leaf spots, virus, rust" value={f.hasDiseases} onChange={v => set("hasDiseases", v)} />
        {f.hasDiseases && <div style={{ padding: "0 0 16px 16px" }}>
          <Field label="Which diseases?"><ChipGroup options={DISEASES} value={f.diseases} onChange={v => set("diseases", v)} multi /></Field>
          {f.diseases.includes("Other") && <Input placeholder="Describe disease" value={f.diseaseOther} onChange={e => set("diseaseOther", e.target.value)} />}
        </div>}

        <Toggle label="Sprayed anything?" desc="Pesticide, herbicide, fungicide" value={f.hasSprayed} onChange={v => set("hasSprayed", v)} />
        {f.hasSprayed && <div style={{ padding: "0 0 16px 16px" }}>
          <Field label="What product?"><Input placeholder="Product name" value={f.sprayProduct} onChange={e => set("sprayProduct", e.target.value)} /></Field>
          <Field label="Which plot?"><ChipGroup options={["Plot A", "Plot B", "Both"]} value={f.sprayPlot} onChange={v => set("sprayPlot", v)} /></Field>
        </div>}

        <Toggle label="Fertiliser applied?" value={f.hasFertiliser} onChange={v => set("hasFertiliser", v)} />
        {f.hasFertiliser && <div style={{ padding: "0 0 16px 16px" }}>
          <Field label="What type?"><Input placeholder="D-compound, urea, manure..." value={f.fertType} onChange={e => set("fertType", e.target.value)} /></Field>
          <Field label="Which plot?"><ChipGroup options={["Plot A", "Plot B", "Both"]} value={f.fertPlot} onChange={v => set("fertPlot", v)} /></Field>
        </div>}

        <Divider />

        <Field label="Weeding done?">
          <ChipGroup options={["Yes", "No", "Partial"]} value={f.weedingDone} onChange={v => set("weedingDone", v)} />
        </Field>
        {(f.weedingDone === "Yes" || f.weedingDone === "Partial") && <Field label="How many times?"><Input type="number" placeholder="Number of weedings" value={f.weedingCount} onChange={e => set("weedingCount", e.target.value)} /></Field>}

        <Field label="Weed pressure">
          <ChipGroup options={["Low", "Medium", "High"]} value={f.weedPressure} onChange={v => set("weedPressure", v)} />
        </Field>

        <Field label="Crop vigour: Plot A vs Plot B">
          <ChipGroup options={["A better", "Same", "B better"]} value={f.cropVigour} onChange={v => set("cropVigour", v)} />
        </Field>

        <Field label="Soil moisture">
          <ChipGroup options={["Dry", "Adequate", "Waterlogged"]} value={f.soilMoisture} onChange={v => set("soilMoisture", v)} />
        </Field>

        <Field label="Germination / stand">
          <ChipGroup options={["Good", "Patchy", "Poor"]} value={f.germination} onChange={v => set("germination", v)} />
        </Field>

        <Toggle label="Drought stress visible?" value={f.droughtStress} onChange={v => set("droughtStress", v)} />
        {f.droughtStress && <Field label="Which plot?"><ChipGroup options={["Plot A", "Plot B", "Both"]} value={f.droughtPlot} onChange={v => set("droughtPlot", v)} /></Field>}
      </>}

      {/* ── OBSERVATIONS ── */}
      {cur === "observations" && <>
        <Field label="What did the GROUP notice?">
          <div style={{ fontSize: 12, color: T.textTer, marginBottom: 6 }}>Their words, not yours.</div>
          <TextArea placeholder="What farmers said about the difference between plots..." value={f.groupSaw} onChange={e => set("groupSaw", e.target.value)} />
        </Field>
        <Field label="What did YOU notice?">
          <div style={{ fontSize: 12, color: T.textTer, marginBottom: 6 }}>Anything the group missed.</div>
          <TextArea placeholder="Your professional observations..." value={f.facSaw} onChange={e => set("facSaw", e.target.value)} />
        </Field>
        <Field label="Any problems?">
          <TextArea placeholder="Issues, things that went wrong..." value={f.problems} onChange={e => set("problems", e.target.value)} />
        </Field>
      </>}

      {/* ── YIELD ── */}
      {cur === "yield" && <>
        <Toggle label="Did you measure yields?" desc="From the 7.5m × 5m comparison plots" value={f.hasYield} onChange={v => set("hasYield", v)} />

        {f.hasYield && <>
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: T.radiusSm, overflow: "hidden" }}>
            {["ha", "lima"].map(u => <button key={u} onClick={() => set("unit", u)} style={{ flex: 1, padding: 10, border: "none", fontSize: 13, fontWeight: 700, fontFamily: T.font, cursor: "pointer", background: f.unit === u ? T.ochre : T.surfaceAlt, color: f.unit === u ? "#fff" : T.textSec }}>{u === "ha" ? "Per hectare (×267)" : "Per lima (×67)"}</button>)}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Field label="Plot A yield (kg)"><Input type="number" step="0.1" placeholder="kg" value={f.yieldA} onChange={e => set("yieldA", e.target.value)} /></Field>
            <Field label="Plot B yield (kg)"><Input type="number" step="0.1" placeholder="kg" value={f.yieldB} onChange={e => set("yieldB", e.target.value)} /></Field>
          </div>

          <Field label="Grain price (K/kg)"><Input type="number" step="0.1" placeholder="Current market price" value={f.price} onChange={e => set("price", e.target.value)} /></Field>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Field label={`Plot A costs (K/${f.unit})`}><Input type="number" placeholder="0" value={f.costA} onChange={e => set("costA", e.target.value)} /></Field>
            <Field label={`Plot B costs (K/${f.unit})`}><Input type="number" placeholder="0" value={f.costB} onChange={e => set("costB", e.target.value)} /></Field>
          </div>

          {hasCalc && (
            <div style={{ background: T.text, borderRadius: T.radius, padding: 20, color: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.ochre, letterSpacing: 1, marginBottom: 12 }}>RESULTS ({f.unit === "ha" ? "PER HECTARE" : "PER LIMA"})</div>
              {[["Plot A yield", `${(yA * mult).toLocaleString()} kg`], ["Plot B yield", `${(yB * mult).toLocaleString()} kg`], ["Price", `K${pr}/kg`]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", fontSize: 14 }}><span style={{ opacity: 0.6 }}>{l}</span><span style={{ fontWeight: 700 }}>{v}</span></div>)}
              <div style={{ height: 1, background: T.ochre, margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 15 }}><span style={{ fontWeight: 700 }}>Profit A</span><span style={{ fontWeight: 700, fontSize: 18 }}>K{profA.toLocaleString()}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 15 }}><span style={{ fontWeight: 700 }}>Profit B</span><span style={{ fontWeight: 700, fontSize: 18 }}>K{profB.toLocaleString()}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 6, borderTop: "2px solid " + T.ochre }}><span style={{ fontWeight: 700, color: T.ochre }}>Difference</span><span style={{ fontWeight: 700, fontSize: 20, color: diff >= 0 ? "#7FBF7F" : "#E8A87C" }}>{diff >= 0 ? "+" : ""}K{diff.toLocaleString()}</span></div>
            </div>
          )}
        </>}
      </>}

      {/* ── POST-HARVEST ── */}
      {cur === "postharvest" && <>
        <Field label="Crop residue after harvest?">
          <ChipGroup options={["Left on field", "Burned", "Removed", "Fed to livestock"]} value={f.stoverBurned} onChange={v => set("stoverBurned", v)} />
        </Field>
        <Field label="Pigeon pea still standing? (if intercrop)">
          <ChipGroup options={["Yes, growing", "Harvested", "N/A"]} value={f.pigeonPeaStanding} onChange={v => set("pigeonPeaStanding", v)} />
        </Field>
        <Toggle label="Next season plan discussed?" value={f.nextSeasonDiscussed} onChange={v => set("nextSeasonDiscussed", v)} />
      </>}

      {/* ── REVIEW ── */}
      {cur === "review" && (() => {
        const grp = groups.find(g => g.id === f.groupId);
        const host = hosts.find(h => h.id === f.hostId);
        const meetLabel = MEETINGS.find(m => m.id === f.meetingType)?.label || f.meetingType;

        const items = [
          ["Date", f.date],
          ["Group", grp?.name],
          ["Host", host?.name],
          ["Meeting", meetLabel],
          ["Attendance", f.attendance],
          f.lat ? ["GPS", `${f.lat}, ${f.lng} (±${f.gpsAcc}m)`] : null,
          f.practice ? ["Practice", f.practice === "Other" ? f.practiceOther : f.practice] : null,
          f.sameSize ? ["Same size plots", f.sameSize] : null,
          f.oneVar ? ["One variable", f.oneVar] : null,
          f.visDiff ? ["Visible difference", f.visDiff] : null,
          f.hasPests ? ["Pests", f.pests.join(", ")] : null,
          f.hasDiseases ? ["Diseases", f.diseases.join(", ")] : null,
          f.hasSprayed ? ["Sprayed", `${f.sprayProduct} on ${f.sprayPlot}`] : null,
          f.weedPressure ? ["Weed pressure", f.weedPressure] : null,
          f.cropVigour ? ["Crop vigour", f.cropVigour] : null,
          f.groupSaw ? ["Group observed", f.groupSaw.slice(0, 80) + (f.groupSaw.length > 80 ? "..." : "")] : null,
          f.facSaw ? ["Facilitator observed", f.facSaw.slice(0, 80) + (f.facSaw.length > 80 ? "..." : "")] : null,
          f.problems ? ["Problems", f.problems.slice(0, 80)] : null,
          f.hasYield && yA > 0 ? ["Yield A", `${(yA * mult).toLocaleString()} kg/${f.unit}`] : null,
          f.hasYield && yB > 0 ? ["Yield B", `${(yB * mult).toLocaleString()} kg/${f.unit}`] : null,
          hasCalc ? ["Profit diff", `${diff >= 0 ? "+" : ""}K${diff.toLocaleString()}/${f.unit}`] : null,
        ].filter(Boolean);

        return (
          <div style={{ background: T.surface, borderRadius: T.radius, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            {items.map(([label, value], i) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < items.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: 14 }}>
                <span style={{ color: T.textSec }}>{label}</span>
                <span style={{ fontWeight: 600, color: T.text, textAlign: "right", maxWidth: "60%" }}>{value}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </StepShell>
  );
}

// ── History list ──
function HistoryList({ obs, groups, hosts }) {
  if (obs.length === 0) return <div style={{ textAlign: "center", padding: 60, color: T.textTer, fontFamily: T.font }}>No observations yet.</div>;

  return (
    <div style={{ padding: 16, fontFamily: T.font }}>
      {obs.sort((a, b) => b.date.localeCompare(a.date)).map(o => {
        const grp = groups.find(g => g.id === o.groupId);
        const host = hosts.find(h => h.id === o.hostId);
        return (
          <div key={o.id} style={{ background: T.surface, borderRadius: T.radius, padding: "14px 16px", marginBottom: 10, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{o.date}</span>
              <StatusPill text={o.meetingType} color="gray" />
            </div>
            <div style={{ fontSize: 14, color: T.ochre, fontWeight: 600 }}>{grp?.name || "?"}{host ? ` · ${host.name}` : ""}</div>
            {o.practice && <div style={{ fontSize: 13, color: T.textSec, marginTop: 2 }}>{o.practice === "Other" ? o.practiceOther : o.practice}</div>}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
              {o.sameSize && <StatusPill text={`Size: ${o.sameSize}`} color={o.sameSize === "Yes" ? "green" : o.sameSize === "No" ? "red" : "gray"} />}
              {o.oneVar && <StatusPill text={o.oneVar.startsWith("Yes") ? "1 var ✓" : o.oneVar.startsWith("No") ? "Multi var ⚠" : "Var ?"} color={o.oneVar.startsWith("Yes") ? "green" : o.oneVar.startsWith("No") ? "red" : "gray"} />}
              {o.lat && <StatusPill text="📍" color="blue" />}
              {o.hasPests && <StatusPill text="Pests" color="amber" />}
              {o.hasSprayed && <StatusPill text="Sprayed" color="red" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Setup screen ──
function SetupScreen({ groups, hosts, onGroups, onHosts }) {
  const [adding, setAdding] = useState(false);
  const [nh, setNh] = useState({ name: "", groupId: "", practice: "", year: "2026" });
  const [editG, setEditG] = useState(null);
  const [eName, setEName] = useState("");
  const [eArea, setEArea] = useState("");

  function addHost() {
    if (!nh.name || !nh.groupId) return;
    const h = { ...nh, id: uid() };
    onHosts([...hosts, h], { type: "add", host: h, groupId: nh.groupId });
    setNh({ name: "", groupId: nh.groupId, practice: "", year: "2026" });
    setAdding(false);
  }

  function saveG() {
    onGroups(groups.map(g => g.id === editG ? { ...g, name: eName, area: eArea } : g));
    setEditG(null);
  }

  return (
    <div style={{ padding: 16, fontFamily: T.font }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.ochre, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Groups ({groups.length})</div>
      {groups.map(g => {
        const gh = hosts.filter(h => h.groupId === g.id);
        if (editG === g.id) return (
          <div key={g.id} style={{ background: T.surface, borderRadius: T.radius, padding: 16, marginBottom: 10, border: `2px solid ${T.ochre}` }}>
            <Input value={eName} onChange={e => setEName(e.target.value)} placeholder="Group name" style={{ marginBottom: 8 }} />
            <Input value={eArea} onChange={e => setEArea(e.target.value)} placeholder="Area / location" style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveG} style={{ padding: "8px 18px", border: "none", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700, fontFamily: T.font, cursor: "pointer", background: T.green, color: "#fff" }}>Save</button>
              <button onClick={() => setEditG(null)} style={{ padding: "8px 18px", border: "none", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: "pointer", background: T.surfaceAlt, color: T.textSec }}>Cancel</button>
            </div>
          </div>
        );
        return (
          <div key={g.id} style={{ background: T.surface, borderRadius: T.radius, padding: "12px 16px", marginBottom: 8, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gh.length > 0 ? 8 : 0 }}>
              <div><span style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</span>{g.area && <span style={{ fontSize: 12, color: T.textTer, marginLeft: 8 }}>{g.area}</span>}</div>
              <button onClick={() => { setEditG(g.id); setEName(g.name); setEArea(g.area || ""); }} style={{ background: "none", border: "none", fontSize: 12, color: T.ochre, cursor: "pointer", fontWeight: 600 }}>Edit</button>
            </div>
            {gh.map(h => <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, borderTop: `1px solid ${T.borderLight}` }}><span>{h.name} — <span style={{ color: T.textTer }}>{h.practice}</span></span><button onClick={() => onHosts(hosts.filter(x => x.id !== h.id), { type: "delete", hostId: h.id })} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 16 }}>×</button></div>)}
          </div>
        );
      })}

      <Divider />
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ display: "block", width: "100%", padding: 14, border: "none", borderRadius: T.radius, fontSize: 15, fontWeight: 700, fontFamily: T.font, cursor: "pointer", background: T.ochre, color: "#fff" }}>+ Add host farmer</button>
      ) : (
        <div style={{ background: T.surface, borderRadius: T.radius, padding: 16, border: `2px solid ${T.green}` }}>
          <Field label="Farmer name"><Input value={nh.name} onChange={e => setNh({ ...nh, name: e.target.value })} placeholder="Name" /></Field>
          <Field label="Group"><Select options={groups.map(g => ({ value: g.id, label: g.name }))} value={nh.groupId} onChange={v => setNh({ ...nh, groupId: v })} /></Field>
          <Field label="What they're testing"><Select options={PRACTICES} value={nh.practice} onChange={v => setNh({ ...nh, practice: v })} /></Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={addHost} style={{ padding: "10px 20px", border: "none", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700, fontFamily: T.font, cursor: "pointer", background: T.green, color: "#fff" }}>Save</button>
            <button onClick={() => setAdding(false)} style={{ padding: "10px 20px", border: "none", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: "pointer", background: T.surfaceAlt, color: T.textSec }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════
// MAIN
// ══════════════════════════════
export default function MundaTracker({ userProfile }) {
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home"); // home, wizard, history, setup
  const [groups, setGroups] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [obs, setObs] = useState([]);
  const [syncStatus, setSyncStatus] = useState("idle");

  useEffect(() => {
    const c = ld(KEYS.consent), g = ld(KEYS.groups), h = ld(KEYS.hosts), o = ld(KEYS.obs);
    if (c) setOk(true); if (g) setGroups(g); if (h) setHosts(h); if (o) setObs(o); setLoading(false);

    if (navigator.onLine) {
      setSyncStatus("syncing");
      processQueue().then(() => pullAll()).then(data => {
        if (data.groups?.length) { const g = data.groups.map(g => ({ id: g.id, name: g.name, area: g.area || "" })); setGroups(g); sv(KEYS.groups, g); }
        if (data.hosts) { const h = data.hosts.map(h => ({ id: h.id, groupId: h.group_id, name: h.name, practice: h.practice || "", year: h.year || "2026" })); setHosts(h); sv(KEYS.hosts, h); }
        if (data.observations) { const o = data.observations.map(o => ({ id: o.id, date: o.date, groupId: o.group_id, hostId: o.host_id, meetingType: o.meeting_type, practice: o.practice, practiceOther: o.practice_other || "", attendance: o.attendance ? "" + o.attendance : "", lat: o.lat ? "" + o.lat : "", lng: o.lng ? "" + o.lng : "", gpsAcc: o.gps_acc ? "" + o.gps_acc : "", sameSize: o.same_size || "", oneVar: o.one_var || "", visDiff: o.vis_diff || "", groupSaw: o.group_saw || "", facSaw: o.fac_saw || "", problems: o.problems || "", yieldA: o.yield_a ? "" + o.yield_a : "", yieldB: o.yield_b ? "" + o.yield_b : "", price: o.price ? "" + o.price : "", costA: o.cost_a ? "" + o.cost_a : "", costB: o.cost_b ? "" + o.cost_b : "", savedAt: o.synced_at })); setObs(o); sv(KEYS.obs, o); }
        setSyncStatus("synced");
      }).catch(() => setSyncStatus("offline"));
    } else { setSyncStatus("offline"); }
  }, []);

  const doConsent = () => { setOk(true); sv(KEYS.consent, true); };
  const doGroups = useCallback(g => { setGroups(g); sv(KEYS.groups, g); g.forEach(grp => pushGroup(grp)); }, []);
  const doHosts = useCallback((h, action) => { setHosts(h); sv(KEYS.hosts, h); if (action?.type === "add") pushHost(action.host, action.groupId); if (action?.type === "delete") deleteHostRemote(action.hostId); }, []);
  const doSave = useCallback(entry => {
    setObs(prev => { const next = [...prev, entry]; sv(KEYS.obs, next); return next; });
    pushObservation(entry);
    setScreen("home");
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, color: T.textTer }}>Loading...</div>;

  // Wizard
  if (screen === "wizard") return <ObsWizard groups={groups} hosts={hosts} onSave={doSave} onCancel={() => setScreen("home")} />;

  // Full-screen views
  if (screen === "history") return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.textSec }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>History ({obs.length})</span>
      </div>
      <HistoryList obs={obs} groups={groups} hosts={hosts} />
    </div>
  );

  if (screen === "setup") return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.textSec }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Setup</span>
      </div>
      <SetupScreen groups={groups} hosts={hosts} onGroups={doGroups} onHosts={doHosts} />
    </div>
  );

  // Home
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.text }}>
      {!ok && <ConsentScreen onOk={doConsent} />}

      {/* Header */}
      <div style={{ background: T.text, padding: "16px 20px", paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: T.ochre }}>Munda</span>
            {userProfile?.role === "admin" && <a href="/admin" style={{ fontSize: 10, color: T.textTer, textDecoration: "none", border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 4, padding: "2px 8px" }}>Admin</a>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: syncStatus === "synced" ? "#7FBF7F" : syncStatus === "syncing" ? T.ochre : T.textTer }}>
              {syncStatus === "syncing" ? "SYNCING..." : syncStatus === "synced" ? "✓ SYNCED" : "OFFLINE"}
            </span>
            <button onClick={signOut} style={{ background: "none", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 4, padding: "3px 8px", fontSize: 10, color: T.textTer, cursor: "pointer", fontFamily: T.font }}>Logout</button>
          </div>
        </div>
      </div>

      {/* Home content */}
      <div style={{ padding: 20, maxWidth: 480, margin: "0 auto" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", letterSpacing: -0.5 }}>{userProfile?.full_name ? `Hi, ${userProfile.full_name.split(" ")[0]}` : "Welcome"}</h1>
          <p style={{ fontSize: 14, color: T.textSec, margin: 0 }}>{obs.length} observation{obs.length !== 1 ? "s" : ""} recorded</p>
        </div>

        {/* Main action */}
        <button onClick={() => setScreen("wizard")} style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "24px 20px", background: `linear-gradient(135deg, ${T.green}, ${T.greenDark})`, border: "none", borderRadius: 16, cursor: "pointer", textAlign: "left", marginBottom: 16, boxShadow: "0 4px 16px rgba(46,125,79,0.3)" }}>
          <span style={{ fontSize: 32 }}>📋</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>New observation</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Log a field school visit</div>
          </div>
        </button>

        {/* Quick links */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <button onClick={() => setScreen("history")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "16px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, cursor: "pointer", fontFamily: T.font }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>History</div>
              <div style={{ fontSize: 12, color: T.textTer }}>{obs.length} records</div>
            </div>
          </button>
          <button onClick={() => setScreen("setup")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "16px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, cursor: "pointer", fontFamily: T.font }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Setup</div>
              <div style={{ fontSize: 12, color: T.textTer }}>{groups.length} groups</div>
            </div>
          </button>
        </div>

        {/* Recent */}
        {obs.length > 0 && <>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Recent</div>
          {obs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(o => {
            const grp = groups.find(g => g.id === o.groupId);
            return (
              <div key={o.id} style={{ background: T.surface, borderRadius: T.radiusSm, padding: "12px 14px", marginBottom: 8, border: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{grp?.name || "?"}</div>
                  <div style={{ fontSize: 12, color: T.textTer }}>{o.date} · {o.meetingType}</div>
                </div>
                {o.hasPests && <StatusPill text="Pests" color="amber" />}
                {o.hasSprayed && <StatusPill text="Sprayed" color="red" />}
              </div>
            );
          })}
        </>}
      </div>
    </div>
  );
}
