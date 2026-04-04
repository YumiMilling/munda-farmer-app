import { useState, useEffect, useCallback } from "react";
import { pullAll, pushObservation, pushHost, pushGroup, deleteHost as deleteHostRemote, processQueue } from "./lib/sync";

const C = {
  ochre: "#B8622D", ochrePale: "#F0DCC8",
  green: "#2D5A27", greenPale: "#D5E8D0",
  char: "#2C2C2C", charLight: "#3D3D3D",
  mid: "#7A746B", midLight: "#A09A92",
  warm: "#F5F0E8", warmDark: "#E8E1D5",
  white: "#FEFDFB",
  alert: "#C4652A", alertPale: "#FDF0E6",
};

const MEETINGS = ["Pre-season planning", "Mid-season observation", "Post-harvest review"];
const PRACTICES = ["Manure handling","Fertiliser comparison","Variety comparison","Intercropping","Conservation agriculture","Minimum tillage","Green manure / velvet bean","Rotation","Spacing trial","Feed comparison (livestock)","Other"];
const DEFAULT_GROUPS = Array.from({length:13},(_,i) => ({id:"g"+(i+1), name:"Group "+(i+1), area:""}));
const font = "'Source Sans 3', -apple-system, system-ui, sans-serif";
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

const KEYS = {consent:"munda-consent",groups:"munda-groups",hosts:"munda-hosts",obs:"munda-obs"};
function ld(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null}catch{return null}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.error(e)}}

// Styles
const inp={width:"100%",padding:"10px 12px",border:"1.5px solid "+C.warmDark,borderRadius:6,fontSize:16,fontFamily:font,background:C.white,color:C.char,outline:"none",boxSizing:"border-box"};
const sel={...inp,appearance:"auto"};
const ta={...inp,resize:"vertical",minHeight:70};
const lbl={fontSize:12,fontWeight:700,color:C.mid,letterSpacing:0.8,marginBottom:6,textTransform:"uppercase"};
const fld={marginBottom:16};
const dvd={height:1,background:C.warmDark,margin:"20px 0"};
const crd={background:C.warm,borderRadius:8,padding:"14px 16px",marginBottom:12};
function btn(bg,fg){return{display:"block",width:"100%",padding:"13px",border:"none",borderRadius:8,fontSize:15,fontWeight:700,fontFamily:font,cursor:"pointer",background:bg,color:fg||"#fff",textAlign:"center",marginBottom:10}}
function bsm(bg,fg){return{padding:"8px 16px",border:"none",borderRadius:6,fontSize:13,fontWeight:700,fontFamily:font,cursor:"pointer",background:bg,color:fg||"#fff"}}
function chp(on){return{display:"inline-block",padding:"7px 14px",borderRadius:20,fontSize:14,fontWeight:600,cursor:"pointer",marginRight:6,marginBottom:6,background:on?C.ochre:C.warm,color:on?"#fff":C.char,border:"1.5px solid "+(on?C.ochre:C.warmDark)}}
function sec(c){return{fontSize:13,fontWeight:700,color:c||C.ochre,letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}

function Chips({value,opts,onChange}){
  return <div style={{display:"flex",flexWrap:"wrap"}}>{opts.map(o=><span key={o} onClick={()=>onChange(o)} style={chp(value===o)}>{o}</span>)}</div>;
}

function Tag({text,ok}){
  const bg=ok===true?C.greenPale:ok===false?C.alertPale:C.warm;
  const fg=ok===true?C.green:ok===false?C.alert:C.mid;
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:bg,color:fg,fontWeight:600,marginRight:4}}>{text}</span>;
}

// ═══════ CONSENT ═══════
function ConsentScreen({onOk}){
  const [ck,setCk]=useState(false);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.white,borderRadius:12,padding:24,maxWidth:400,width:"100%"}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:12}}>Before you start</div>
        <p style={{fontSize:14,color:C.mid,marginBottom:16,lineHeight:1.6}}>This tool collects FFS observation data including optional GPS location. Data is stored on this device and can be shared with the Grassroots Trust FFS programme coordinator for improving farming practices and agricultural research.</p>
        <label style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:14,cursor:"pointer",marginBottom:20}}>
          <input type="checkbox" checked={ck} onChange={()=>setCk(!ck)} style={{marginTop:3,accentColor:C.ochre}}/>
          <span>I have permission from the FFS host farmer and group to share observation data with Grassroots Trust.</span>
        </label>
        <button disabled={!ck} onClick={onOk} style={{...btn(ck?C.ochre:C.warmDark),opacity:ck?1:0.5,cursor:ck?"pointer":"default"}}>Continue</button>
      </div>
    </div>
  );
}

// ═══════ LOG TAB ═══════
function LogTab({groups,hosts,onSave}){
  const blank={id:"",date:new Date().toISOString().slice(0,10),groupId:"",hostId:"",meetingType:"",practice:"",practiceOther:"",attendance:"",lat:"",lng:"",gpsAcc:"",sameSize:"",oneVar:"",visDiff:"",groupSaw:"",facSaw:"",problems:"",yieldA:"",yieldB:"",price:"",costA:"",costB:""};
  const [f,setF]=useState(blank);
  const [unit,setUnit]=useState("ha");
  const [saved,setSaved]=useState(false);
  const [gps,setGps]=useState("idle");

  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const gH=hosts.filter(h=>h.groupId===f.groupId);
  const mult=unit==="ha"?267:67;
  const uLbl=unit==="ha"?"per hectare":"per lima";
  const yA=parseFloat(f.yieldA)||0, yB=parseFloat(f.yieldB)||0, pr=parseFloat(f.price)||0;
  const cA=parseFloat(f.costA)||0, cB=parseFloat(f.costB)||0;
  const incA=yA*mult*pr, incB=yB*mult*pr, profA=incA-cA, profB=incB-cB, diff=profB-profA;
  const hasCalc=yA>0&&yB>0&&pr>0;

  function getGPS(){
    if(!navigator.geolocation){setGps("denied");return}
    setGps("getting");
    navigator.geolocation.getCurrentPosition(
      pos=>{set("lat",pos.coords.latitude.toFixed(6));set("lng",pos.coords.longitude.toFixed(6));set("gpsAcc",Math.round(pos.coords.accuracy).toString());setGps("got")},
      ()=>setGps("denied"),
      {enableHighAccuracy:true,timeout:15000}
    );
  }

  function compileWA(){
    let t="\u{1F331} Munda FFS Report\n\n\u{1F4C5} "+f.date+"\n";
    const grp=groups.find(g=>g.id===f.groupId);
    t+="\u{1F465} "+(grp?grp.name+(grp.area?" ("+grp.area+")":""):"?")+"\n";
    const host=hosts.find(h=>h.id===f.hostId);
    t+="\u{1F3E0} Host: "+(host?host.name:"?")+"\n";
    t+="\u{1F4CB} "+f.meetingType+"\n\u{1F33E} Testing: "+(f.practice==="Other"?f.practiceOther:f.practice)+"\n";
    if(f.attendance) t+="\u{1F464} Attendance: "+f.attendance+"\n";
    if(f.lat) t+="\u{1F4CD} GPS: "+f.lat+", "+f.lng+" (\u00B1"+f.gpsAcc+"m)\n";
    t+="\n\u2500\u2500 Comparison check \u2500\u2500\n";
    if(f.sameSize) t+="Same size: "+f.sameSize+"\n";
    if(f.oneVar) t+="One variable: "+f.oneVar+"\n";
    if(f.visDiff) t+="Visible diff: "+f.visDiff+"\n";
    if(f.groupSaw) t+="\nGroup noticed:\n"+f.groupSaw+"\n";
    if(f.facSaw) t+="\nFacilitator noticed:\n"+f.facSaw+"\n";
    if(f.problems) t+="\nProblems:\n"+f.problems+"\n";
    if(hasCalc){
      t+="\n\u2500\u2500 Gross margins ("+uLbl+") \u2500\u2500\n";
      t+="Plot A: "+yA+"kg \u00D7 "+mult+" = "+(yA*mult).toLocaleString()+"kg\n";
      t+="Plot B: "+yB+"kg \u00D7 "+mult+" = "+(yB*mult).toLocaleString()+"kg\n";
      t+="Price: K"+pr+"/kg\n";
      t+="Income A: K"+incA.toLocaleString()+" | B: K"+incB.toLocaleString()+"\n";
      if(cA>0||cB>0) t+="Costs A: K"+cA.toLocaleString()+" | B: K"+cB.toLocaleString()+"\n";
      t+="Profit A: K"+profA.toLocaleString()+" | B: K"+profB.toLocaleString()+"\n";
      t+="Difference: "+(diff>=0?"+":"")+"K"+diff.toLocaleString()+"\n";
    }
    t+="\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nSent "+new Date().toLocaleDateString()+"\nMunda \u00B7 Grassroots Trust";
    return t;
  }

  function handleSave(){
    if(!f.groupId||!f.meetingType) return;
    onSave({...f,id:f.id||uid(),savedAt:new Date().toISOString()});
    setSaved(true);
    setTimeout(()=>{setSaved(false);setF({...blank,groupId:f.groupId});setGps("idle")},2000);
  }

  return(
    <div style={{padding:16}}>
      <div style={fld}><div style={lbl}>Date</div><input type="date" value={f.date} onChange={e=>set("date",e.target.value)} style={inp}/></div>

      <div style={fld}>
        <div style={lbl}>Location</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={getGPS} disabled={gps==="getting"} style={{...bsm(C.char),flexShrink:0}}>
            {gps==="idle"?"\u{1F4CD} Get GPS":gps==="getting"?"Getting...":gps==="got"?"\u2713 Got it":"Denied"}
          </button>
          <span style={{fontSize:13,color:gps==="got"?C.green:C.mid}}>
            {gps==="got"?f.lat+", "+f.lng+" (\u00B1"+f.gpsAcc+"m)":gps==="denied"?"Location unavailable":"Optional"}
          </span>
        </div>
      </div>

      <div style={fld}><div style={lbl}>Group</div>
        <select value={f.groupId} onChange={e=>{set("groupId",e.target.value);set("hostId","")}} style={sel}>
          <option value="">Select group...</option>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}{g.area?" \u2014 "+g.area:""}</option>)}
        </select>
      </div>

      <div style={fld}><div style={lbl}>Host farmer</div>
        {gH.length>0?(
          <select value={f.hostId} onChange={e=>set("hostId",e.target.value)} style={sel}>
            <option value="">Select host...</option>
            {gH.map(h=><option key={h.id} value={h.id}>{h.name} \u2014 {h.practice}</option>)}
          </select>
        ):(
          <div style={{fontSize:13,color:C.mid,padding:"8px 0"}}>{f.groupId?"No hosts for this group. Add in Setup.":"Select a group first."}</div>
        )}
      </div>

      <div style={fld}><div style={lbl}>Meeting type</div><Chips value={f.meetingType} opts={MEETINGS} onChange={v=>set("meetingType",v)}/></div>

      <div style={fld}><div style={lbl}>What is being tested?</div>
        <select value={f.practice} onChange={e=>set("practice",e.target.value)} style={sel}>
          <option value="">Select practice...</option>
          {PRACTICES.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {f.practice==="Other"&&<input placeholder="Describe..." value={f.practiceOther} onChange={e=>set("practiceOther",e.target.value)} style={{...inp,marginTop:8}}/>}
      </div>

      <div style={fld}><div style={lbl}>Attendance</div><input type="number" placeholder="How many came" value={f.attendance} onChange={e=>set("attendance",e.target.value)} style={inp}/></div>

      <div style={dvd}/>
      <div style={sec(C.alert)}>Comparison check</div>
      <div style={fld}><div style={{...lbl,color:C.char}}>Are the two plots the same size?</div><div style={{fontSize:12,color:C.mid,marginBottom:6}}>Standard: 7.5m × 5m each</div><Chips value={f.sameSize} opts={["Yes","No","Not sure"]} onChange={v=>set("sameSize",v)}/></div>
      <div style={fld}><div style={{...lbl,color:C.char}}>Is only one thing different between the plots?</div><div style={{fontSize:12,color:C.mid,marginBottom:6}}>Same seed, spacing, planting date, weeding — except the one variable.</div><Chips value={f.oneVar} opts={["Yes, one difference","No, multiple","Not sure"]} onChange={v=>set("oneVar",v)}/></div>
      <div style={fld}><div style={{...lbl,color:C.char}}>Can you see a difference between the plots?</div><Chips value={f.visDiff} opts={["Clear","Some","None","Too early"]} onChange={v=>set("visDiff",v)}/></div>

      <div style={dvd}/>
      <div style={sec(C.green)}>Observations</div>
      <div style={fld}><div style={{...lbl,color:C.char}}>What did the group notice?</div><div style={{fontSize:12,color:C.mid,marginBottom:4}}>Their words, not yours.</div><textarea value={f.groupSaw} onChange={e=>set("groupSaw",e.target.value)} placeholder="What farmers said..." style={ta}/></div>
      <div style={fld}><div style={{...lbl,color:C.char}}>What did you notice?</div><div style={{fontSize:12,color:C.mid,marginBottom:4}}>Anything the group missed.</div><textarea value={f.facSaw} onChange={e=>set("facSaw",e.target.value)} placeholder="Your observations..." style={ta}/></div>
      <div style={fld}><div style={{...lbl,color:C.char}}>Any problems?</div><textarea value={f.problems} onChange={e=>set("problems",e.target.value)} placeholder="Issues, things that went wrong..." style={ta}/></div>

      <div style={dvd}/>
      <div style={sec(C.ochre)}>Gross margins calculator</div>
      <div style={{fontSize:12,color:C.mid,marginBottom:12}}>For post-harvest review. Plot = 7.5m × 5m (37.5 m²).</div>
      <div style={{display:"flex",gap:0,marginBottom:14,borderRadius:6,overflow:"hidden"}}>
        {["ha","lima"].map(u=><button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:9,border:"none",fontSize:13,fontWeight:700,fontFamily:font,cursor:"pointer",background:unit===u?C.ochre:C.warmDark,color:unit===u?"#fff":C.mid}}>{u==="ha"?"Per hectare (\u00D7267)":"Per lima (\u00D767)"}</button>)}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Plot A yield (kg)</div><input type="number" step="0.1" value={f.yieldA} onChange={e=>set("yieldA",e.target.value)} placeholder="kg" style={inp}/></div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Plot B yield (kg)</div><input type="number" step="0.1" value={f.yieldB} onChange={e=>set("yieldB",e.target.value)} placeholder="kg" style={inp}/></div>
      </div>
      <div style={fld}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Grain price (K/kg)</div><input type="number" step="0.1" value={f.price} onChange={e=>set("price",e.target.value)} placeholder="Current market price" style={inp}/></div>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Plot A costs (K/{unit})</div><input type="number" value={f.costA} onChange={e=>set("costA",e.target.value)} placeholder="0" style={inp}/></div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Plot B costs (K/{unit})</div><input type="number" value={f.costB} onChange={e=>set("costB",e.target.value)} placeholder="0" style={inp}/></div>
      </div>

      {hasCalc&&(
        <div style={{background:C.char,borderRadius:8,padding:16,marginBottom:16,color:"#fff"}}>
          <div style={{fontSize:12,fontWeight:700,color:C.ochre,marginBottom:10,letterSpacing:0.5}}>RESULTS ({uLbl.toUpperCase()})</div>
          {[["Plot A yield",(yA*mult).toLocaleString()+" kg"],["Plot B yield",(yB*mult).toLocaleString()+" kg"],["Price","K"+pr+"/kg"]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+C.charLight,fontSize:14}}><span style={{color:C.midLight}}>{l}</span><span style={{fontWeight:700}}>{v}</span></div>)}
          <div style={{height:1,background:C.ochre,margin:"8px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:14}}><span style={{color:C.midLight}}>Income A</span><span style={{fontWeight:700}}>K{incA.toLocaleString()}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:14}}><span style={{color:C.midLight}}>Income B</span><span style={{fontWeight:700}}>K{incB.toLocaleString()}</span></div>
          {(cA>0||cB>0)&&<><div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:14}}><span style={{color:C.midLight}}>Costs A</span><span style={{fontWeight:700,color:C.alert}}>{"\u2212"}K{cA.toLocaleString()}</span></div><div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:14}}><span style={{color:C.midLight}}>Costs B</span><span style={{fontWeight:700,color:C.alert}}>{"\u2212"}K{cB.toLocaleString()}</span></div></>}
          <div style={{height:2,background:C.ochre,margin:"8px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:15}}><span style={{fontWeight:700,color:"#fff"}}>Profit A</span><span style={{fontWeight:700,fontSize:17}}>K{profA.toLocaleString()}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:15}}><span style={{fontWeight:700,color:"#fff"}}>Profit B</span><span style={{fontWeight:700,fontSize:17}}>K{profB.toLocaleString()}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0 0",marginTop:4}}><span style={{fontWeight:700,color:C.ochre}}>Difference</span><span style={{fontWeight:700,fontSize:18,color:diff>=0?"#7FBF7F":"#E8A87C"}}>{diff>=0?"+":""}K{diff.toLocaleString()}</span></div>
        </div>
      )}

      <div style={dvd}/>
      <button onClick={handleSave} style={btn(C.green)}>{saved?"\u2713 Saved":"Save observation"}</button>
      <button onClick={()=>window.open("https://wa.me/260977313318?text="+encodeURIComponent(compileWA()),"_blank")} style={btn("#25D366")}>Send to Seb via WhatsApp</button>
    </div>
  );
}

// ═══════ HISTORY TAB ═══════
function HistoryTab({obs,hosts,groups}){
  const [fg,setFg]=useState("");
  const [fh,setFh]=useState("");
  const list=obs.filter(o=>!fg||o.groupId===fg).filter(o=>!fh||o.hostId===fh).sort((a,b)=>b.date.localeCompare(a.date));
  const gH=fg?hosts.filter(h=>h.groupId===fg):hosts;

  return(
    <div style={{padding:16}}>
      <div style={sec()}>Observations ({list.length})</div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <select value={fg} onChange={e=>{setFg(e.target.value);setFh("")}} style={{...sel,flex:1}}><option value="">All groups</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <select value={fh} onChange={e=>setFh(e.target.value)} style={{...sel,flex:1}}><option value="">All hosts</option>{gH.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select>
      </div>
      {list.length===0&&<div style={{textAlign:"center",padding:40,color:C.mid}}>No observations yet.</div>}
      {list.map(o=>{
        const grp=groups.find(g=>g.id===o.groupId);
        const host=hosts.find(h=>h.id===o.hostId);
        const hy=parseFloat(o.yieldA)>0&&parseFloat(o.yieldB)>0;
        return(
          <div key={o.id} style={crd}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:700,fontSize:14}}>{o.date}</span><span style={{fontSize:12,color:C.mid}}>{o.meetingType}</span></div>
            <div style={{fontSize:14,marginBottom:4}}><span style={{color:C.ochre,fontWeight:600}}>{grp?grp.name:"?"}</span>{host&&<span> · {host.name}</span>}</div>
            <div style={{fontSize:13,color:C.mid,marginBottom:6}}>{o.practice==="Other"?o.practiceOther:o.practice}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
              {o.sameSize&&<Tag text={"Size: "+o.sameSize} ok={o.sameSize==="Yes"?true:o.sameSize==="No"?false:null}/>}
              {o.oneVar&&<Tag text={"Var: "+o.oneVar} ok={o.oneVar.startsWith("Yes")?true:o.oneVar.startsWith("No")?false:null}/>}
              {o.visDiff&&<Tag text={"Diff: "+o.visDiff}/>}
              {o.lat&&<Tag text={"\u{1F4CD}"}/>}
            </div>
            {o.groupSaw&&<div style={{fontSize:13,marginBottom:3}}><b>Group:</b> {o.groupSaw.slice(0,120)}{o.groupSaw.length>120?"\u2026":""}</div>}
            {o.facSaw&&<div style={{fontSize:13,marginBottom:3}}><b>Facilitator:</b> {o.facSaw.slice(0,120)}{o.facSaw.length>120?"\u2026":""}</div>}
            {o.problems&&<div style={{fontSize:13,color:C.alert}}><b>Problems:</b> {o.problems.slice(0,100)}{o.problems.length>100?"\u2026":""}</div>}
            {hy&&<div style={{marginTop:8,padding:"8px 10px",background:C.char,borderRadius:6,fontSize:13,color:"#fff"}}>A: {o.yieldA}kg \u2192 {(parseFloat(o.yieldA)*267).toLocaleString()}kg/ha · B: {o.yieldB}kg \u2192 {(parseFloat(o.yieldB)*267).toLocaleString()}kg/ha</div>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════ PATTERNS TAB ═══════
function PatternsTab({obs,hosts,groups}){
  if(obs.length<2) return <div style={{padding:40,textAlign:"center",color:C.mid}}>Need more observations to show patterns.</div>;
  const total=obs.length;
  const sizeNo=obs.filter(o=>o.sameSize==="No").length;
  const varNo=obs.filter(o=>o.oneVar&&o.oneVar.startsWith("No")).length;
  const probs=obs.filter(o=>o.problems&&o.problems.trim()).length;
  const withGPS=obs.filter(o=>o.lat).length;

  const byP={};
  obs.forEach(o=>{const p=o.practice==="Other"?(o.practiceOther||"Other"):o.practice;if(!byP[p])byP[p]={n:0,issues:0};byP[p].n++;if(o.oneVar&&o.oneVar.startsWith("No"))byP[p].issues++});

  const byG={};
  obs.forEach(o=>{if(!byG[o.groupId])byG[o.groupId]={n:0,issues:0};byG[o.groupId].n++;if(o.sameSize==="No"||(o.oneVar&&o.oneVar.startsWith("No")))byG[o.groupId].issues++});

  const yields=obs.filter(o=>parseFloat(o.yieldA)>0&&parseFloat(o.yieldB)>0);

  return(
    <div style={{padding:16}}>
      <div style={sec(C.alert)}>Methodology quality</div>
      <div style={crd}>
        <div style={{fontSize:14,marginBottom:8}}><b>{total}</b> observations · <b>{withGPS}</b> with GPS</div>
        <div style={{fontSize:14,color:sizeNo>0?C.alert:C.green,marginBottom:4}}>{sizeNo>0?"\u26A0 "+sizeNo+" different-sized plots":"\u2713 All plots same size"}</div>
        <div style={{fontSize:14,color:varNo>0?C.alert:C.green,marginBottom:4}}>{varNo>0?"\u26A0 "+varNo+" multiple variables":"\u2713 All single-variable"}</div>
        <div style={{fontSize:14,color:C.mid}}>{probs} reported problems</div>
      </div>

      <div style={sec()}>By practice</div>
      {Object.entries(byP).sort((a,b)=>b[1].n-a[1].n).map(([p,d])=>(
        <div key={p} style={{...crd,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:14}}>{p}</div><div style={{fontSize:12,color:C.mid}}>{d.n} obs</div></div>
          {d.issues>0&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:10,background:C.alertPale,color:C.alert,fontWeight:600}}>{d.issues} issues</span>}
        </div>
      ))}

      <div style={sec()}>By group</div>
      {Object.entries(byG).sort((a,b)=>b[1].n-a[1].n).map(([gid,d])=>{
        const grp=groups.find(g=>g.id===gid);
        return(
          <div key={gid} style={{...crd,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:14}}>{grp?grp.name:gid}</div><div style={{fontSize:12,color:C.mid}}>{d.n} obs</div></div>
            {d.issues>0&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:10,background:C.alertPale,color:C.alert,fontWeight:600}}>{d.issues} issues</span>}
          </div>
        );
      })}

      {yields.length>0&&<>
        <div style={sec(C.green)}>Yield comparisons ({yields.length})</div>
        {yields.map(o=>{
          const host=hosts.find(h=>h.id===o.hostId);
          const a=parseFloat(o.yieldA),b=parseFloat(o.yieldB);
          const pct=((b-a)/a*100).toFixed(0);
          return(
            <div key={o.id} style={crd}>
              <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{host?host.name:"?"} · {o.date}</div>
              <div style={{fontSize:13,color:C.mid,marginBottom:6}}>{o.practice==="Other"?o.practiceOther:o.practice}</div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,background:C.white,borderRadius:4,padding:"6px 10px",fontSize:13}}><div style={{color:C.mid,fontSize:11}}>Plot A</div><div style={{fontWeight:700}}>{(a*267).toLocaleString()} kg/ha</div></div>
                <div style={{flex:1,background:C.white,borderRadius:4,padding:"6px 10px",fontSize:13}}><div style={{color:C.mid,fontSize:11}}>Plot B</div><div style={{fontWeight:700}}>{(b*267).toLocaleString()} kg/ha</div></div>
                <div style={{padding:"6px 10px",display:"flex",alignItems:"center"}}><span style={{fontWeight:700,color:parseFloat(pct)>=0?C.green:C.alert}}>{parseFloat(pct)>=0?"+":""}{pct}%</span></div>
              </div>
            </div>
          );
        })}
      </>}
    </div>
  );
}

// ═══════ SETUP TAB ═══════
function SetupTab({groups,hosts,onGroups,onHosts}){
  const [adding,setAdding]=useState(false);
  const [nh,setNh]=useState({name:"",groupId:"",practice:"",year:"2026"});
  const [editG,setEditG]=useState(null);
  const [eName,setEName]=useState("");
  const [eArea,setEArea]=useState("");

  function addHost(){if(!nh.name||!nh.groupId)return;const h={...nh,id:uid()};onHosts([...hosts,h],{type:'add',host:h,groupId:nh.groupId});setNh({name:"",groupId:nh.groupId,practice:"",year:"2026"});setAdding(false)}
  function saveG(){onGroups(groups.map(g=>g.id===editG?{...g,name:eName,area:eArea}:g));setEditG(null)}

  return(
    <div style={{padding:16}}>
      <div style={sec()}>Groups ({groups.length})</div>
      {groups.map(g=>{
        const gh=hosts.filter(h=>h.groupId===g.id);
        if(editG===g.id) return(
          <div key={g.id} style={{...crd,borderLeft:"3px solid "+C.ochre}}>
            <input value={eName} onChange={e=>setEName(e.target.value)} placeholder="Group name" style={{...inp,marginBottom:6}}/>
            <input value={eArea} onChange={e=>setEArea(e.target.value)} placeholder="Area / location" style={{...inp,marginBottom:8}}/>
            <div style={{display:"flex",gap:6}}><button onClick={saveG} style={bsm(C.green)}>Save</button><button onClick={()=>setEditG(null)} style={bsm(C.warmDark,C.char)}>Cancel</button></div>
          </div>
        );
        return(
          <div key={g.id} style={crd}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:gh.length>0?6:0}}>
              <div><span style={{fontWeight:700,fontSize:14}}>{g.name}</span>{g.area&&<span style={{fontSize:12,color:C.mid,marginLeft:8}}>{g.area}</span>}</div>
              <button onClick={()=>{setEditG(g.id);setEName(g.name);setEArea(g.area||"")}} style={{background:"none",border:"none",fontSize:12,color:C.ochre,cursor:"pointer",fontWeight:600}}>Edit</button>
            </div>
            {gh.map(h=><div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",fontSize:13,borderTop:"1px solid "+C.warmDark}}><span>{h.name} \u2014 <span style={{color:C.mid}}>{h.practice}</span>{h.year?<span style={{color:C.midLight}}> ({h.year})</span>:""}</span><button onClick={()=>onHosts(hosts.filter(x=>x.id!==h.id),{type:'delete',hostId:h.id})} style={{background:"none",border:"none",color:C.alert,cursor:"pointer",fontSize:14}}>{"\u00D7"}</button></div>)}
            {gh.length===0&&<div style={{fontSize:12,color:C.mid}}>No hosts</div>}
          </div>
        );
      })}

      <div style={dvd}/>
      <div style={sec(C.green)}>Add host farmer</div>
      {!adding?(
        <button onClick={()=>setAdding(true)} style={btn(C.ochre)}>+ Add host farmer</button>
      ):(
        <div style={{...crd,borderLeft:"3px solid "+C.green}}>
          <div style={fld}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Farmer name</div><input value={nh.name} onChange={e=>setNh({...nh,name:e.target.value})} placeholder="Name" style={inp}/></div>
          <div style={fld}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Group</div><select value={nh.groupId} onChange={e=>setNh({...nh,groupId:e.target.value})} style={sel}><option value="">Select...</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div style={fld}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>What they're testing</div><select value={nh.practice} onChange={e=>setNh({...nh,practice:e.target.value})} style={sel}><option value="">Select...</option>{PRACTICES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          <div style={fld}><div style={{fontSize:12,fontWeight:600,color:C.mid,marginBottom:4}}>Year started</div><input value={nh.year} onChange={e=>setNh({...nh,year:e.target.value})} style={inp}/></div>
          <div style={{display:"flex",gap:8}}><button onClick={addHost} style={bsm(C.green)}>Save</button><button onClick={()=>setAdding(false)} style={bsm(C.warmDark,C.char)}>Cancel</button></div>
        </div>
      )}
    </div>
  );
}

// ═══════ MAIN ═══════
export default function MundaTracker(){
  const [ok,setOk]=useState(false);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("log");
  const [groups,setGroups]=useState(DEFAULT_GROUPS);
  const [hosts,setHosts]=useState([]);
  const [obs,setObs]=useState([]);

  const [syncStatus, setSyncStatus] = useState("idle"); // idle, syncing, synced, offline
  const [queueCount, setQueueCount] = useState(0);

  useEffect(()=>{
    // Load local first (instant)
    const c=ld(KEYS.consent),g=ld(KEYS.groups),h=ld(KEYS.hosts),o=ld(KEYS.obs);
    if(c)setOk(true);if(g)setGroups(g);if(h)setHosts(h);if(o)setObs(o);setLoading(false);

    // Then pull from Supabase if online
    if(navigator.onLine){
      setSyncStatus("syncing");
      processQueue().then(()=>{
        return pullAll();
      }).then(data=>{
        if(data.groups?.length){
          setGroups(data.groups.map(g=>({id:g.id,name:g.name,area:g.area||""})));
          sv(KEYS.groups,data.groups.map(g=>({id:g.id,name:g.name,area:g.area||""})));
        }
        if(data.hosts){
          const mapped=data.hosts.map(h=>({id:h.id,groupId:h.group_id,name:h.name,practice:h.practice||"",year:h.year||"2026"}));
          setHosts(mapped);sv(KEYS.hosts,mapped);
        }
        if(data.observations){
          const mapped=data.observations.map(o=>({
            id:o.id,date:o.date,groupId:o.group_id,hostId:o.host_id,
            meetingType:o.meeting_type,practice:o.practice,practiceOther:o.practice_other||"",
            attendance:o.attendance?""+o.attendance:"",lat:o.lat?""+o.lat:"",lng:o.lng?""+o.lng:"",
            gpsAcc:o.gps_acc?""+o.gps_acc:"",sameSize:o.same_size||"",oneVar:o.one_var||"",
            visDiff:o.vis_diff||"",groupSaw:o.group_saw||"",facSaw:o.fac_saw||"",
            problems:o.problems||"",yieldA:o.yield_a?""+o.yield_a:"",yieldB:o.yield_b?""+o.yield_b:"",
            price:o.price?""+o.price:"",costA:o.cost_a?""+o.cost_a:"",costB:o.cost_b?""+o.cost_b:"",
            savedAt:o.synced_at
          }));
          setObs(mapped);sv(KEYS.obs,mapped);
        }
        setSyncStatus("synced");
      }).catch(()=>setSyncStatus("offline"));
    } else {
      setSyncStatus("offline");
    }

    // Update queue count
    try{const q=JSON.parse(localStorage.getItem("munda-sync-queue")||"[]");setQueueCount(q.length)}catch{}
  },[]);

  const doConsent=()=>{setOk(true);sv(KEYS.consent,true)};
  const doGroups=useCallback(g=>{
    setGroups(g);sv(KEYS.groups,g);
    // Push changed groups to Supabase
    g.forEach(grp=>pushGroup(grp));
  },[]);
  const doHosts=useCallback((h,action)=>{
    setHosts(h);sv(KEYS.hosts,h);
    // action = {type:'add',host,groupId} or {type:'delete',hostId}
    if(action?.type==='add') pushHost(action.host,action.groupId);
    if(action?.type==='delete') deleteHostRemote(action.hostId);
  },[]);
  const doSave=useCallback(entry=>{
    setObs(prev=>{
      const idx=prev.findIndex(o=>o.id===entry.id);
      const next=idx>=0?prev.map(o=>o.id===entry.id?entry:o):[...prev,entry];
      sv(KEYS.obs,next);
      return next;
    });
    // Push to Supabase
    pushObservation(entry);
    try{const q=JSON.parse(localStorage.getItem("munda-sync-queue")||"[]");setQueueCount(q.length)}catch{}
  },[]);

  if(loading) return <div style={{maxWidth:480,margin:"0 auto",padding:60,textAlign:"center",color:C.mid,fontFamily:font}}>Loading...</div>;

  const tabs=[{id:"log",label:"Log"},{id:"history",label:"History ("+obs.length+")"},{id:"patterns",label:"Patterns"},{id:"setup",label:"Setup"}];

  return(
    <div style={{maxWidth:480,margin:"0 auto",background:C.white,minHeight:"100vh",fontFamily:font,fontSize:16,color:C.char,lineHeight:1.55}}>
      {!ok&&<ConsentScreen onOk={doConsent}/>}
      <div style={{background:C.char,padding:"14px 16px",paddingTop:"calc(14px + env(safe-area-inset-top))"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:16,color:C.ochre,letterSpacing:0.5}}>Munda</span>
          <span style={{fontSize:11,letterSpacing:1,color:syncStatus==="synced"?"#7FBF7F":syncStatus==="syncing"?C.ochre:C.mid}}>
            {syncStatus==="syncing"?"SYNCING...":syncStatus==="synced"?"\u2713 SYNCED":syncStatus==="offline"?"OFFLINE":"FFS TRACKER"}
            {queueCount>0&&<span style={{marginLeft:6,background:C.alert,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10}}>{queueCount}</span>}
          </span>
        </div>
      </div>
      <div style={{display:"flex",background:C.charLight,borderTop:"1px solid "+C.mid+"22"}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 8px",border:"none",cursor:"pointer",background:tab===t.id?C.ochre:"transparent",color:tab===t.id?"#fff":C.midLight,fontSize:11,fontWeight:700,fontFamily:font,letterSpacing:0.3}}>{t.label}</button>)}
      </div>
      {tab==="log"&&<LogTab groups={groups} hosts={hosts} onSave={doSave}/>}
      {tab==="history"&&<HistoryTab obs={obs} hosts={hosts} groups={groups}/>}
      {tab==="patterns"&&<PatternsTab obs={obs} hosts={hosts} groups={groups}/>}
      {tab==="setup"&&<SetupTab groups={groups} hosts={hosts} onGroups={doGroups} onHosts={doHosts}/>}
      <div style={{padding:"12px 16px",background:C.warm,fontSize:11,color:C.mid,textAlign:"center",paddingBottom:"calc(12px + env(safe-area-inset-bottom))"}}>Munda · Grassroots Trust · Kafue · {obs.length} observations stored</div>
    </div>
  );
}
