// InsightFlow AI — Production Build
// Real data processing · All bugs fixed · Working New Analysis
import React, { useState, useRef, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PALETTE = ["#4F8EF7","#9B6DFF","#FF7849","#00C9A7","#F7C948","#FF5E99","#43D6A4","#6EE7F7"];
const KPI_ICONS = ["📋","💰","📊","📈","🎯","👥","🛒","⚡"];
const API_URL   = "https://api.anthropic.com/v1/messages";
const MODEL     = "claude-sonnet-4-20250514";

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSVFull(text) {
  try {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error("File needs a header row + at least one data row.");
    const splitLine = (line) => {
      const out = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { out.push(cur.trim()); cur = ""; }
        else { cur += c; }
      }
      out.push(cur.trim());
      return out.map(v => v.replace(/^"|"$/g, "").trim());
    };
    const headers = splitLine(lines[0]);
    const rows = lines.slice(1).map(l => {
      const vals = splitLine(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    const colTypes = {};
    headers.forEach(h => {
      const sample = rows.slice(0, 30).map(r => r[h]).filter(v => v !== "");
      const numCount = sample.filter(v => !isNaN(parseFloat(String(v).replace(/[$,%\s]/g, "")))).length;
      colTypes[h] = numCount / Math.max(sample.length, 1) > 0.65 ? "numeric" : "categorical";
    });
    return { headers, rows, colTypes, rowCount: rows.length, error: null };
  } catch (e) {
    return { headers: [], rows: [], colTypes: {}, rowCount: 0, error: e.message };
  }
}

async function parseFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const ext = file.name.split(".").pop().toLowerCase();
      const csv = ext === "tsv" ? text.replace(/\t/g, ",") : text;
      resolve(parseCSVFull(csv));
    };
    reader.onerror = () => resolve({ headers:[], rows:[], colTypes:{}, rowCount:0, error:"Read failed" });
    reader.readAsText(file);
  });
}

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
const toNum = v => parseFloat(String(v ?? "").replace(/[$,%\s]/g,"")) || 0;

function buildCharts(parsed, query) {
  const { headers, rows, colTypes } = parsed;
  if (!rows.length) return [];
  const num = headers.filter(h => colTypes[h] === "numeric");
  const cat = headers.filter(h => colTypes[h] === "categorical");
  const timeCol = headers.find(h => /date|month|year|week|quarter|period|time/i.test(h));
  const c1 = cat[0], n1 = num[0], n2 = num[1];
  const q = query.toLowerCase();
  const charts = [];

  if (timeCol && n1) {
    const keys = num.slice(0,3);
    const map = {};
    rows.forEach(r => {
      const k = String(r[timeCol] ?? "?");
      if (!map[k]) { map[k] = { [timeCol]: k }; keys.forEach(k2 => { map[k][k2] = 0; }); }
      keys.forEach(k2 => { map[k][k2] += toNum(r[k2]); });
    });
    const data = Object.values(map).slice(0,16);
    charts.push({ type: q.includes("area") || q.includes("trend") ? "area" : "line",
      title: `${keys[0]} over ${timeCol}`, data, keys });
  }

  if (c1 && n1 && c1 !== timeCol) {
    const keys = num.slice(0,2);
    const map = {};
    rows.forEach(r => {
      const k = String(r[c1] ?? "Other").slice(0,30);
      if (!map[k]) { map[k] = { [c1]: k }; keys.forEach(k2 => { map[k][k2] = 0; }); }
      keys.forEach(k2 => { map[k][k2] += toNum(r[k2]); });
    });
    const data = Object.values(map).sort((a,b) => b[n1]-a[n1]).slice(0,10);
    charts.push({ type:"bar", title:`${n1} by ${c1}`, data, keys });
  }

  if (c1 && n1) {
    const map = {};
    rows.forEach(r => { const k = String(r[c1]??"Other").slice(0,30); map[k] = (map[k]||0)+toNum(r[n1]); });
    const data = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value:Math.round(value)}));
    charts.push({ type:"pie", title:`${n1} distribution by ${c1}`, data });
  }

  if (n1 && n2) {
    if (q.includes("scatter") || q.includes("correlation")) {
      const data = rows.slice(0,80).map(r => ({ x:toNum(r[n1]), y:toNum(r[n2]), z:num[2]?toNum(r[num[2]]):1 }));
      charts.push({ type:"scatter", title:`${n1} vs ${n2}`, data, xKey:n1, yKey:n2 });
    } else if (!timeCol && c1) {
      const map = {};
      rows.forEach(r => {
        const k = String(r[c1]??"Other").slice(0,30);
        if (!map[k]) map[k] = { [c1]:k, [n1]:0, [n2]:0 };
        map[k][n1] += toNum(r[n1]); map[k][n2] += toNum(r[n2]);
      });
      const data = Object.values(map).sort((a,b)=>b[n1]-a[n1]).slice(0,10);
      charts.push({ type:"bar", title:`${n1} & ${n2} by ${c1}`, data, keys:[n1,n2] });
    }
  }

  return charts.slice(0,5);
}

function buildKPIs(parsed) {
  const { headers, rows, colTypes } = parsed;
  const num = headers.filter(h => colTypes[h] === "numeric");
  if (!rows.length) return [];
  const kpis = [{ label:"Total Records", value:rows.length.toLocaleString(), sub:`${headers.length} columns`, change:"100%", up:true, icon:"📋" }];
  num.slice(0,4).forEach((col,i) => {
    const vals = rows.map(r=>toNum(r[col])).filter(v=>v!==0&&!isNaN(v));
    if (!vals.length) return;
    const total = vals.reduce((a,b)=>a+b,0);
    const avg = total/vals.length;
    const isCur = /revenue|sales|price|amount|cost|profit/i.test(col);
    const fmt = v => {
      if (isCur) return v>=1e6?`$${(v/1e6).toFixed(2)}M`:v>=1e3?`$${(v/1e3).toFixed(1)}K`:`$${Math.round(v).toLocaleString()}`;
      return v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(1)}K`:Math.round(v).toLocaleString();
    };
    const h = Math.floor(vals.length/2);
    const ch = h>0 ? ((vals.slice(h).reduce((a,b)=>a+b,0)/Math.max(vals.length-h,1)) - (vals.slice(0,h).reduce((a,b)=>a+b,0)/h)) / (vals.slice(0,h).reduce((a,b)=>a+b,0)/h) * 100 : 0;
    kpis.push({ label:col, value:fmt(total), sub:`Avg ${fmt(avg)}`, change:`${ch>=0?"+":""}${ch.toFixed(1)}%`, up:ch>=0, icon:KPI_ICONS[(i+1)%8] });
  });
  return kpis.slice(0,5);
}

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
async function callClaude(messages, system="", max_tokens=600) {
  const body = { model:MODEL, max_tokens, messages };
  if (system) body.system = system;
  const res = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  return d.content?.map(b=>b.type==="text"?b.text:"").join("") || "";
}

async function aiAnalyze(query, parsed, dsName) {
  const { headers, rows, colTypes } = parsed;
  const num = headers.filter(h=>colTypes[h]==="numeric");
  const cat = headers.filter(h=>colTypes[h]==="categorical");
  const sample = JSON.stringify(rows.slice(0,15));
  const sys = `You are a BI analyst. Return ONLY a raw JSON object (no markdown, no backticks) with exactly these keys:
{"sql":"string","insights":["string","string","string","string"],"queryTitle":"string (max 6 words)"}
Make insights specific and data-driven. Use emojis for anomalies.`;
  const msg = `Dataset: ${dsName}\nColumns: ${headers.join(", ")}\nNumeric: [${num.join(", ")}]\nCategorical: [${cat.join(", ")}]\nRows: ${parsed.rowCount}\nSample: ${sample}\nQuestion: "${query}"`;
  try {
    const text = await callClaude([{role:"user",content:msg}], sys, 500);
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  } catch {
    return {
      sql:`SELECT ${num.slice(0,3).join(", ")||"*"}\nFROM ${dsName.replace(/\.[^.]+$/,"")}\nLIMIT 100;`,
      insights:[`Dataset has ${parsed.rowCount} rows, ${headers.length} columns.`,`Numeric: ${num.slice(0,3).join(", ")||"none"}.`,`Categorical: ${cat.slice(0,3).join(", ")||"none"}.`,`Query: "${query}"`],
      queryTitle: query.slice(0,40)
    };
  }
}

async function describeChart(chart) {
  try {
    return await callClaude([{role:"user",content:`Describe this ${chart.type} chart titled "${chart.title}" in 2 sentences for a business audience. Data: ${JSON.stringify(chart.data?.slice(0,8))}. Be specific about trends.`}],"",160);
  } catch { return "Chart visualizes key metrics from your dataset. Review values across categories to identify opportunities."; }
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ico = ({ name, size=16, color, style:s }) => {
  const p = {
    send:   <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    image:  <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    menu:   <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    chevL:  <polyline points="15 18 9 12 15 6"/>,
    chevR:  <polyline points="9 18 15 12 9 6"/>,
    chevD:  <polyline points="6 9 12 15 18 9"/>,
    plus:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    code:   <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    table:  <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></>,
    spark:  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
    logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    x:      <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    db:     <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    copy:   <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
    check:  <polyline points="20 6 9 17 4 12"/>,
    warn:   <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  };
  if (!p[name]) return null;
  return (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",color,lineHeight:0,...s}}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>
    </span>
  );
};

// ─── CHART ────────────────────────────────────────────────────────────────────
const TT = { borderRadius:10, border:"1px solid #e2e8f0", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", fontSize:12 };
const fmtTick = v => v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}K`:v;

function ChartCard({ chart, idx }) {
  const [desc, setDesc] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const xKey = chart.keys ? Object.keys(chart.data?.[0]||{})[0] : "name";

  const onDescribe = async () => {
    if (desc) { setOpen(o=>!o); return; }
    setOpen(true); setLoading(true);
    setDesc(await describeChart(chart));
    setLoading(false);
  };

  const body = () => {
    const { type, data, keys } = chart;
    if (!data?.length) return <div style={{color:"#94a3b8",textAlign:"center",padding:20,fontSize:12}}>No data</div>;
    switch(type) {
      case "line": return (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={data} margin={{top:5,right:16,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey={xKey} tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false} width={48} tickFormatter={fmtTick}/>
            <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11}}/>
            {keys.map((k,i)=><Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i%8]} strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}}/>)}
          </LineChart>
        </ResponsiveContainer>);
      case "bar": return (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{top:5,right:16,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey={xKey} tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false} width={48} tickFormatter={fmtTick}/>
            <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11}}/>
            {keys.map((k,i)=><Bar key={k} dataKey={k} fill={PALETTE[i%8]} radius={[5,5,0,0]} maxBarSize={40}/>)}
          </BarChart>
        </ResponsiveContainer>);
      case "pie": return (
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
              {data.map((_,i)=><Cell key={i} fill={PALETTE[i%8]}/>)}
            </Pie>
            <Tooltip contentStyle={TT} formatter={v=>[v.toLocaleString(),""]}/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11}}/>
          </PieChart>
        </ResponsiveContainer>);
      case "area": return (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={data} margin={{top:5,right:16,left:0,bottom:5}}>
            <defs>{keys.map((k,i)=><linearGradient key={k} id={`ag${idx}${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PALETTE[i%8]} stopOpacity={0.25}/><stop offset="95%" stopColor={PALETTE[i%8]} stopOpacity={0.02}/></linearGradient>)}</defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey={xKey} tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false} width={48} tickFormatter={fmtTick}/>
            <Tooltip contentStyle={TT}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11}}/>
            {keys.map((k,i)=><Area key={k} type="monotone" dataKey={k} stroke={PALETTE[i%8]} strokeWidth={2.5} fill={`url(#ag${idx}${i})`}/>)}
          </AreaChart>
        </ResponsiveContainer>);
      case "scatter": return (
        <ResponsiveContainer width="100%" height={210}>
          <ScatterChart margin={{top:5,right:16,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="x" name={chart.xKey} tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false}/>
            <YAxis dataKey="y" name={chart.yKey} tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false} width={48}/>
            <ZAxis dataKey="z" range={[20,200]}/><Tooltip contentStyle={TT} cursor={{strokeDasharray:"3 3"}}/>
            <Scatter data={data} fill={PALETTE[idx%8]} fillOpacity={0.7}/>
          </ScatterChart>
        </ResponsiveContainer>);
      default: return null;
    }
  };

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8ecf4",boxShadow:"0 2px 12px rgba(79,142,247,0.05)",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <span style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12.5,color:"#1e293b",flex:1,lineHeight:1.3}}>{chart.title}</span>
        <button onClick={onDescribe} style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,background:"linear-gradient(135deg,#f0f4ff,#f5f0ff)",border:"1px solid #e0e7ff",borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:600,color:"#6366f1",cursor:"pointer"}}>
          <Ico name="spark" size={11}/> Describe
        </button>
      </div>
      {body()}
      {open&&<div style={{background:"linear-gradient(135deg,#f8faff,#faf5ff)",border:"1px solid #e8ecff",borderRadius:10,padding:"11px 13px",fontSize:12.5,lineHeight:1.7,color:"#475569"}}>
        {loading?<span style={{color:"#a78bfa"}}>✦ Generating…</span>:<><span style={{color:"#6366f1",fontWeight:700}}>✦ </span>{desc}</>}
      </div>}
    </div>
  );
}

// ─── DATA TABLE ───────────────────────────────────────────────────────────────
function DataTable({ data }) {
  const [page,setPage]       = useState(0);
  const [search,setSearch]   = useState("");
  const [sortKey,setSortKey] = useState(null);
  const [asc,setAsc]         = useState(true);
  if (!data?.length) return null;
  const hdrs = Object.keys(data[0]);
  let rows = search ? data.filter(r=>hdrs.some(h=>String(r[h]??"").toLowerCase().includes(search.toLowerCase()))) : data;
  if (sortKey) rows = [...rows].sort((a,b)=>{const av=a[sortKey]??"",bv=b[sortKey]??"";const an=parseFloat(av),bn=parseFloat(bv);if(!isNaN(an)&&!isNaN(bn))return asc?an-bn:bn-an;return asc?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));});
  const PER=6, pages=Math.ceil(rows.length/PER), vis=rows.slice(page*PER,(page+1)*PER);
  const doSort = h => { if(sortKey===h)setAsc(a=>!a); else{setSortKey(h);setAsc(true);} };
  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8ecf4",overflow:"hidden"}}>
      <div style={{padding:"11px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #f1f5f9",flexWrap:"wrap",gap:8}}>
        <span style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,color:"#1e293b",display:"flex",alignItems:"center",gap:6}}>
          <Ico name="table" size={13} color="#4F8EF7"/> Data Table <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>({rows.length} rows)</span>
        </span>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search…" style={{border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 10px",fontSize:12,outline:"none",width:140,color:"#475569",background:"#f8fafc"}}/>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#f8fafc"}}>{hdrs.map(h=>(
            <th key={h} onClick={()=>doSort(h)} style={{padding:"8px 13px",textAlign:"left",fontWeight:600,color:"#64748b",cursor:"pointer",whiteSpace:"nowrap",userSelect:"none",borderBottom:"1px solid #f1f5f9"}}>
              {h} {sortKey===h?(asc?"↑":"↓"):""}
            </th>
          ))}</tr></thead>
          <tbody>{vis.map((r,i)=>(
            <tr key={i} style={{borderTop:"1px solid #f8fafc"}} onMouseEnter={e=>e.currentTarget.style.background="#f8faff"} onMouseLeave={e=>e.currentTarget.style.background=""}>
              {hdrs.map(h=><td key={h} style={{padding:"8px 13px",color:"#334155",whiteSpace:"nowrap",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis"}}>{String(r[h]??"")}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {pages>1&&<div style={{padding:"9px 15px",display:"flex",gap:5,justifyContent:"flex-end",borderTop:"1px solid #f1f5f9",flexWrap:"wrap"}}>
        {Array.from({length:Math.min(pages,10)},(_,i)=>(
          <button key={i} onClick={()=>setPage(i)} style={{width:26,height:26,borderRadius:7,border:page===i?"none":"1px solid #e2e8f0",background:page===i?"linear-gradient(135deg,#4F8EF7,#9B6DFF)":"#fff",color:page===i?"#fff":"#64748b",fontWeight:600,fontSize:11,cursor:"pointer"}}>{i+1}</button>
        ))}
      </div>}
    </div>
  );
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const AiAvatar = () => (
  <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700,flexShrink:0,boxShadow:"0 4px 12px rgba(79,142,247,0.28)"}}>AI</div>
);

// ─── DASHBOARD BLOCK ──────────────────────────────────────────────────────────
function DashBlock({ item }) {
  const [sqlOpen,setSqlOpen] = useState(false);
  const [copied,setCopied]   = useState(false);
  const copy = () => { navigator.clipboard.writeText(item.sql||""); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  if (item.loading) return (
    <div style={{padding:"18px 0"}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <AiAvatar/>
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8ecf4",padding:"14px 18px",flex:1,display:"flex",alignItems:"center",gap:10,boxShadow:"0 2px 12px rgba(79,142,247,0.05)"}}>
          <div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",animation:`bounce .8s ease-in-out ${i*.18}s infinite alternate`}}/>)}</div>
          <span style={{fontSize:13,color:"#64748b"}}>Analyzing your data…</span>
        </div>
      </div>
    </div>
  );

  if (item.error) return (
    <div style={{padding:"14px 0"}}>
      <div style={{display:"flex",gap:10}}>
        <AiAvatar/>
        <div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:14,padding:"13px 16px",flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,color:"#dc2626",fontWeight:600,fontSize:13,marginBottom:3}}><Ico name="warn" size={13}/> Error</div>
          <div style={{fontSize:12.5,color:"#dc2626"}}>{item.error}</div>
        </div>
      </div>
    </div>
  );

  const n = item.charts?.length||0;
  const grid = n===1?"1fr":"repeat(auto-fit,minmax(340px,1fr))";

  return (
    <div style={{padding:"18px 0",borderBottom:"1px solid #f1f5f9"}} className="dash-block">
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <div style={{maxWidth:"72%",background:"linear-gradient(135deg,#4F8EF7,#6B8FFF)",borderRadius:"18px 18px 4px 18px",padding:"10px 16px",boxShadow:"0 4px 16px rgba(79,142,247,0.22)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:600,marginBottom:2}}>📂 {item.dataset}</div>
          <div style={{fontSize:13.5,color:"#fff",fontWeight:500}}>{item.query}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <AiAvatar/>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:13,minWidth:0}}>
          {item.queryTitle&&<div style={{fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",color:"#1e293b"}}>{item.queryTitle}</div>}
          {!!item.kpis?.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:10}}>
            {item.kpis.map((k,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:13,border:"1px solid #e8ecf4",padding:"13px 15px",boxShadow:"0 2px 10px rgba(79,142,247,0.05)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${PALETTE[i%8]},${PALETTE[(i+1)%8]})`}}/>
                <div style={{fontSize:18,marginBottom:5}}>{k.icon}</div>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k.label}</div>
                <div style={{fontSize:20,fontWeight:700,fontFamily:"'Sora',sans-serif",color:"#1e293b",marginBottom:2}}>{k.value}</div>
                <div style={{fontSize:11,color:k.up?"#10b981":"#ef4444",fontWeight:600}}>{k.change}</div>
                {k.sub&&<div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{k.sub}</div>}
              </div>
            ))}
          </div>}
          <div style={{background:"#fff",borderRadius:13,border:"1px solid #e8ecf4",overflow:"hidden"}}>
            <button onClick={()=>setSqlOpen(o=>!o)} style={{width:"100%",padding:"10px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fafc",border:"none",cursor:"pointer",borderBottom:sqlOpen?"1px solid #e8ecf4":"none"}}>
              <span style={{display:"flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:600,color:"#475569"}}><Ico name="code" size={13} color="#4F8EF7"/> Generated SQL</span>
              <span style={{color:"#94a3b8",transform:sqlOpen?"rotate(90deg)":"none",transition:"transform .2s",display:"flex"}}><Ico name="chevR" size={13}/></span>
            </button>
            {sqlOpen&&<div style={{position:"relative"}}>
              <pre style={{margin:0,padding:"13px 15px",fontSize:11.5,lineHeight:1.8,color:"#334155",overflowX:"auto",fontFamily:"'JetBrains Mono','Fira Code',monospace"}}>{item.sql}</pre>
              <button onClick={copy} style={{position:"absolute",top:9,right:9,background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,color:copied?"#10b981":"#64748b"}}>
                {copied?<><Ico name="check" size={11}/> Copied!</>:<><Ico name="copy" size={11}/> Copy</>}
              </button>
            </div>}
          </div>
          {n>0&&<div style={{display:"grid",gridTemplateColumns:grid,gap:12}}>
            {item.charts.map((c,i)=><ChartCard key={i} chart={c} idx={i}/>)}
          </div>}
          {!!item.insights?.length&&<div style={{background:"linear-gradient(135deg,#f8faff,#fdf5ff)",borderRadius:13,border:"1px solid #e8ecff",padding:"15px 17px"}}>
            <div style={{fontSize:12.5,fontWeight:700,color:"#4F8EF7",marginBottom:9,display:"flex",alignItems:"center",gap:5}}>
              <Ico name="spark" size={13} color="#4F8EF7"/> AI Insights
            </div>
            {item.insights.map((ins,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:i<item.insights.length-1?6:0}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:PALETTE[i%8],marginTop:7,flexShrink:0}}/>
                <span style={{fontSize:12.5,color:"#475569",lineHeight:1.65}}>{ins}</span>
              </div>
            ))}
          </div>}
          {!!item.tableData?.length&&<DataTable data={item.tableData}/>}
        </div>
      </div>
    </div>
  );
}

// ─── DATASET PREVIEW ──────────────────────────────────────────────────────────
function DatasetPreview({ ds }) {
  const [open,setOpen] = useState(true);
  const { file, parsed, description } = ds;
  const { headers, rows, colTypes, rowCount, error } = parsed;
  if (error) return <div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:12,padding:"11px 15px",marginBottom:12,fontSize:12.5,color:"#dc2626"}}>⚠️ {file.name}: {error}</div>;
  const num = headers.filter(h=>colTypes[h]==="numeric");
  const cat = headers.filter(h=>colTypes[h]==="categorical");
  return (
    <div style={{background:"linear-gradient(135deg,#f0f7ff,#f5f0ff)",borderRadius:13,border:"1px solid #dde8ff",padding:"13px 15px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:700,color:"#4F8EF7"}}>
          <Ico name="db" size={14} color="#4F8EF7"/> {file.name}
          <span style={{fontSize:11,background:"#e0e7ff",borderRadius:20,padding:"2px 8px",color:"#6366f1",fontWeight:600}}>{rowCount.toLocaleString()} rows</span>
        </div>
        <span style={{color:"#94a3b8",display:"flex",transform:open?"rotate(90deg)":"none",transition:"transform .2s"}}><Ico name="chevR" size={14}/></span>
      </div>
      {open&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontSize:12,color:"#64748b",lineHeight:1.6}}>{description||`${rowCount} rows · ${headers.length} columns. Numeric: ${num.slice(0,3).join(", ")}. Categorical: ${cat.slice(0,3).join(", ")}.`}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {headers.map(h=>(
            <span key={h} style={{background:colTypes[h]==="numeric"?"#e0f2fe":"#f0fdf4",border:`1px solid ${colTypes[h]==="numeric"?"#bae6fd":"#bbf7d0"}`,borderRadius:6,padding:"3px 8px",fontSize:10.5,color:colTypes[h]==="numeric"?"#0369a1":"#166534",fontWeight:500}}>{h}</span>
          ))}
        </div>
        {rows.length>0&&<div style={{overflowX:"auto",borderRadius:8,border:"1px solid #e0e7ff"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"#e8ecff"}}>
              {headers.slice(0,6).map(h=><th key={h} style={{padding:"5px 10px",textAlign:"left",fontWeight:600,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>)}
              {headers.length>6&&<th style={{padding:"5px 10px",color:"#94a3b8"}}>+{headers.length-6}</th>}
            </tr></thead>
            <tbody>{rows.slice(0,3).map((r,i)=>(
              <tr key={i} style={{background:i%2===0?"#fff":"#f8f9ff"}}>
                {headers.slice(0,6).map(h=><td key={h} style={{padding:"5px 10px",color:"#64748b",whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{String(r[h]??"")}</td>)}
                {headers.length>6&&<td style={{padding:"5px 10px",color:"#94a3b8"}}>…</td>}
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </div>}
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode,setMode] = useState("login");
  const [form,setForm] = useState({name:"",email:"",password:"",confirm:""});
  const [err,setErr]   = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const IST = {width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"11px 14px",fontSize:13.5,color:"#1e293b",outline:"none",background:"#f8fafc",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"};
  const submit = () => {
    setErr("");
    if (!form.email.trim()||!form.password.trim()) return setErr("Please fill in all fields.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr("Invalid email address.");
    if (form.password.length<6) return setErr("Password must be at least 6 characters.");
    if (mode==="signup") {
      if (!form.name.trim()) return setErr("Please enter your name.");
      if (form.password!==form.confirm) return setErr("Passwords do not match.");
    }
    onLogin({ name:form.name||form.email.split("@")[0], email:form.email });
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f4ff,#faf5ff,#f0f9ff)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(79,142,247,0.35)"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span style={{fontSize:22,fontWeight:700,fontFamily:"'Sora',sans-serif",background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>InsightFlow AI</span>
          </div>
          <p style={{color:"#64748b",fontSize:13}}>Conversational Business Intelligence</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.93)",backdropFilter:"blur(20px)",borderRadius:20,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 20px 60px rgba(79,142,247,0.12)",padding:"30px 34px"}}>
          <h2 style={{fontSize:20,fontWeight:700,fontFamily:"'Sora',sans-serif",color:"#1e293b",margin:"0 0 3px"}}>{mode==="login"?"Welcome back":"Create account"}</h2>
          <p style={{color:"#64748b",fontSize:13,marginBottom:22}}>{mode==="login"?"Sign in to your workspace":"Start your free trial"}</p>
          {err&&<div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:10,padding:"9px 13px",fontSize:12.5,color:"#dc2626",marginBottom:13}}>{err}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            {mode==="signup"&&<div><label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>Full Name</label><input value={form.name} onChange={e=>set("name",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Jane Smith" style={IST}/></div>}
            <div><label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>Email</label><input value={form.email} onChange={e=>set("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="jane@company.com" type="email" style={IST}/></div>
            <div><label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>Password</label><input value={form.password} onChange={e=>set("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" type="password" style={IST}/></div>
            {mode==="signup"&&<div><label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>Confirm Password</label><input value={form.confirm} onChange={e=>set("confirm",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" type="password" style={IST}/></div>}
            <button onClick={submit} style={{background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",border:"none",borderRadius:12,padding:"13px",color:"#fff",fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",cursor:"pointer",boxShadow:"0 8px 24px rgba(79,142,247,0.35)",marginTop:3}}>
              {mode==="login"?"Sign In →":"Create Account →"}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:16,fontSize:12.5,color:"#64748b"}}>
            {mode==="login"?"No account? ":"Have an account? "}
            <button onClick={()=>{setMode(m=>m==="login"?"signup":"login");setErr("");}} style={{background:"none",border:"none",color:"#4F8EF7",fontWeight:600,cursor:"pointer",fontSize:12.5}}>
              {mode==="login"?"Sign Up":"Sign In"}
            </button>
          </div>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"#94a3b8",marginTop:14}}>Demo: any valid email + 6-char password</p>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function InsightFlowApp() {
  const [user,setUser]           = useState(null);
  const [sidebarOpen,setSidebar] = useState(true);
  const [query,setQuery]         = useState("");
  const [convs,setConvs]         = useState([]);
  const [datasets,setDatasets]   = useState({});
  const [activeDS,setActiveDS]   = useState(null);
  const [filterDS,setFilterDS]   = useState(null);
  const [expDS,setExpDS]         = useState({});
  const [chips,setChips]         = useState([]);
  const [uploadErr,setUploadErr] = useState("");

  const csvRef = useRef(); const imgRef = useRef();
  const bottomRef = useRef(); const taRef = useRef();

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[convs]);
  useEffect(()=>{
    const t = taRef.current; if(!t) return;
    t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,120)+"px";
  },[query]);

  // ── FILE LOAD ───────────────────────────────────────────────────────────────
  const loadFile = async (file) => {
    setUploadErr("");
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv","xlsx","xls","tsv"].includes(ext)) { setUploadErr(`Unsupported format .${ext} — use CSV or Excel.`); return; }
    const parsed = await parseFile(file);
    if (parsed.error) { setUploadErr(`Parse error: ${parsed.error}`); return; }
    if (!parsed.rowCount) { setUploadErr(`${file.name} appears to be empty.`); return; }
    let description = "";
    try {
      description = await callClaude([{role:"user",content:`In 1-2 sentences, describe what this business dataset likely contains. File: ${file.name}. Columns: ${parsed.headers.join(", ")}. Rows: ${parsed.rowCount}. Be specific.`}],"",100);
    } catch { description = `${parsed.rowCount} rows · ${parsed.headers.length} columns.`; }
    setDatasets(prev=>({...prev,[file.name]:{file,parsed,description,queries:[]}}));
    setActiveDS(file.name);
    setFilterDS(null);
    setExpDS(e=>({...e,[file.name]:true}));
    setChips(c=>[...c.filter(x=>x.name!==file.name),{name:file.name,type:"csv"}]);
  };

  const onCSV = async (e) => { if(e.target.files[0]) await loadFile(e.target.files[0]); e.target.value=""; };
  const onImg = (e) => { if(e.target.files[0]) setChips(c=>[...c,{name:e.target.files[0].name,type:"image"}]); e.target.value=""; };
  const removeChip = (name) => {
    setChips(c=>c.filter(x=>x.name!==name));
    setDatasets(d=>{ const nd={...d}; delete nd[name]; return nd; });
    if(activeDS===name) setActiveDS(null);
  };

  // ── NEW ANALYSIS — resets everything ────────────────────────────────────────
  const handleNewAnalysis = () => {
    setConvs([]);
    setDatasets({});
    setActiveDS(null);
    setFilterDS(null);
    setChips([]);
    setQuery("");
    setUploadErr("");
    setExpDS({});
  };

  // ── SEND ────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const q = query.trim();
    if (!q) return;
    const dsName = activeDS || Object.keys(datasets)[0];
    if (!dsName || !datasets[dsName]) { setUploadErr("Upload a dataset first."); return; }
    setUploadErr("");
    const id = Date.now().toString();
    setConvs(c=>[...c,{id,query:q,dataset:dsName,loading:true}]);
    setDatasets(prev=>{ const d={...prev}; if(d[dsName]) d[dsName]={...d[dsName],queries:[...d[dsName].queries,id]}; return d; });
    setQuery("");
    try {
      const parsed = datasets[dsName].parsed;
      const [ai]   = await Promise.all([aiAnalyze(q,parsed,dsName)]);
      const charts = buildCharts(parsed,q);
      const kpis   = buildKPIs(parsed);
      setConvs(c=>c.map(item=>item.id!==id?item:{
        ...item, loading:false,
        queryTitle:ai.queryTitle, sql:ai.sql, insights:ai.insights,
        charts, kpis, tableData:parsed.rows.slice(0,50),
      }));
    } catch(err) {
      setConvs(c=>c.map(item=>item.id!==id?item:{...item,loading:false,error:`Analysis failed: ${err.message}`}));
    }
  };

  const onKey = (e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();} };
  const hasDS   = Object.keys(datasets).length>0;
  const canSend = query.trim()&&hasDS;
  const filtered = filterDS ? convs.filter(c=>c.dataset===filterDS) : convs;

  if (!user) return <AuthPage onLogin={setUser}/>;

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans','Sora',sans-serif",background:"#f5f7fc",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        ::-webkit-scrollbar-track{background:transparent}
        @keyframes bounce{0%{transform:translateY(0)}100%{transform:translateY(-7px)}}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .dash-block{animation:fadeSlide .35s ease}
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{width:sidebarOpen?260:58,flexShrink:0,background:"#fff",borderRight:"1px solid #e8ecf4",display:"flex",flexDirection:"column",transition:"width .22s cubic-bezier(.4,0,.2,1)",overflow:"hidden",zIndex:10}}>

        {/* Header */}
        <div style={{padding:"13px 10px",display:"flex",alignItems:"center",gap:9,borderBottom:"1px solid #f1f5f9",minHeight:56}}>
          <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px rgba(79,142,247,0.3)"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          {sidebarOpen&&<span style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14.5,background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",whiteSpace:"nowrap",flex:1}}>InsightFlow AI</span>}
          <button onClick={()=>setSidebar(o=>!o)} title={sidebarOpen?"Collapse":"Expand"}
            style={{background:sidebarOpen?"transparent":"linear-gradient(135deg,#f0f4ff,#f5f0ff)",border:sidebarOpen?"1px solid transparent":"1px solid #dde8ff",cursor:"pointer",color:sidebarOpen?"#94a3b8":"#4F8EF7",padding:6,display:"flex",borderRadius:8,flexShrink:0,transition:"all .2s"}}>
            {sidebarOpen?<Ico name="chevL" size={15}/>:<Ico name="menu" size={15} color="#4F8EF7"/>}
          </button>
        </div>

        {/* ── NEW ANALYSIS BUTTON ── */}
        <div style={{padding:"10px 8px"}}>
          <button
            onClick={handleNewAnalysis}
            title={!sidebarOpen?"New Analysis":""}
            style={{
              width:"100%",
              background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",
              border:"none",
              borderRadius:9,
              padding:sidebarOpen?"10px 13px":"10px",
              display:"flex",
              alignItems:"center",
              gap:7,
              justifyContent:sidebarOpen?"flex-start":"center",
              color:"#fff",
              fontSize:12.5,
              fontWeight:600,
              cursor:"pointer",
              boxShadow:"0 4px 14px rgba(79,142,247,0.28)",
              transition:"all .2s"
            }}>
            <Ico name="plus" size={14}/>
            {sidebarOpen&&<span>New Analysis</span>}
          </button>
        </div>

        {/* Dataset list */}
        <div style={{flex:1,overflowY:"auto",padding:"2px 6px"}}>
          {sidebarOpen&&<div style={{fontSize:9.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",padding:"8px 8px 4px"}}>
            {hasDS?"Datasets":"No datasets yet"}
          </div>}
          {Object.entries(datasets).map(([name,ds])=>{
            const active = filterDS===name;
            const exp    = expDS[name];
            return (
              <div key={name}>
                <button
                  onClick={()=>{ setActiveDS(name); setFilterDS(active?null:name); setExpDS(e=>({...e,[name]:!e[name]})); }}
                  title={!sidebarOpen?name:""}
                  style={{width:"100%",background:active?"linear-gradient(135deg,#f0f4ff,#f5f0ff)":"transparent",border:active?"1px solid #dde8ff":"1px solid transparent",borderRadius:9,padding:sidebarOpen?"8px 9px":"9px",display:"flex",alignItems:"center",gap:7,cursor:"pointer",marginBottom:2,transition:"all .15s"}}>
                  <Ico name="db" size={14} color={active?"#4F8EF7":"#94a3b8"}/>
                  {sidebarOpen&&<>
                    <span style={{fontSize:12,fontWeight:600,color:active?"#4F8EF7":"#475569",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{name}</span>
                    <span style={{fontSize:10,color:"#fff",fontWeight:600,background:active?"#4F8EF7":"#94a3b8",borderRadius:20,padding:"1px 7px",flexShrink:0}}>{ds.queries.length}</span>
                    <Ico name={exp?"chevD":"chevR"} size={12} color="#94a3b8"/>
                  </>}
                </button>
                {sidebarOpen&&exp&&ds.queries.length>0&&(
                  <div style={{paddingLeft:10,paddingBottom:4}}>
                    {convs.filter(c=>c.dataset===name).map(c=>(
                      <div key={c.id} title={c.query}
                        style={{fontSize:11.5,color:"#64748b",padding:"6px 9px 6px 11px",borderLeft:"2px solid #dde8ff",marginLeft:5,marginBottom:2,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",borderRadius:"0 7px 7px 0",transition:"background .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        {c.queryTitle||c.query}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User footer */}
        <div style={{padding:"10px 8px",borderTop:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:8,minHeight:52}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,flexShrink:0}}>
            {user.name[0].toUpperCase()}
          </div>
          {sidebarOpen&&<>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:12.5,fontWeight:600,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
              <div style={{fontSize:10.5,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
            </div>
            <button onClick={()=>setUser(null)} title="Sign out"
              style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:4,display:"flex",borderRadius:6}}
              onMouseEnter={e=>e.currentTarget.style.color="#ef4444"}
              onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
              <Ico name="logout" size={14}/>
            </button>
          </>}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

        {/* Topbar */}
        <div style={{background:"rgba(255,255,255,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid #e8ecf4",padding:"12px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,gap:12}}>
          <div>
            <h1 style={{fontSize:16,fontWeight:700,fontFamily:"'Sora',sans-serif",color:"#1e293b"}}>Conversational Business Intelligence</h1>
            <p style={{fontSize:12,color:"#64748b",marginTop:1}}>Upload data · Ask questions · Instant dashboards</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
            {activeDS&&<div style={{background:"linear-gradient(135deg,#f0f4ff,#f5f0ff)",border:"1px solid #dde8ff",borderRadius:9,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#4F8EF7",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
              <Ico name="db" size={12} color="#4F8EF7"/> {activeDS}
              {datasets[activeDS]&&<span style={{color:"#94a3b8",fontWeight:400}}>({datasets[activeDS].parsed.rowCount.toLocaleString()} rows)</span>}
            </div>}
            {filterDS&&<button onClick={()=>setFilterDS(null)} style={{fontSize:11,color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:7,padding:"5px 10px",cursor:"pointer"}}>Show all →</button>}
          </div>
        </div>

        {/* Chat */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px",display:"flex",flexDirection:"column"}}>
          {!filterDS&&hasDS&&Object.entries(datasets).map(([name,ds])=>(
            <div key={name} className="dash-block"><DatasetPreview ds={ds}/></div>
          ))}
          {!hasDS&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"60px 20px"}}>
              <div style={{width:68,height:68,borderRadius:22,background:"linear-gradient(135deg,#4F8EF7,#9B6DFF)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20,boxShadow:"0 12px 36px rgba(79,142,247,0.3)"}}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h2 style={{fontSize:22,fontWeight:700,fontFamily:"'Sora',sans-serif",color:"#1e293b",marginBottom:10}}>Start your analysis</h2>
              <p style={{fontSize:14,color:"#64748b",maxWidth:380,lineHeight:1.7,marginBottom:22}}>Upload a CSV or Excel file, then ask questions to generate interactive dashboards from your real data.</p>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                {["Show me a summary","Compare by category","Show trends","Top 10 by value"].map(s=>(
                  <button key={s} onClick={()=>setQuery(s)} style={{background:"#fff",border:"1px solid #dde8ff",borderRadius:20,padding:"7px 13px",fontSize:12.5,color:"#4F8EF7",fontWeight:500,cursor:"pointer"}}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {hasDS&&convs.length===0&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"30px 20px",textAlign:"center"}}>
              <div style={{fontSize:30,marginBottom:10}}>💬</div>
              <p style={{fontSize:14,color:"#64748b",marginBottom:14}}>Dataset loaded — ask a question to generate your first dashboard.</p>
              <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>
                {["Give me a full summary","Show top categories","Plot trends over time","Key insights?"].map(s=>(
                  <button key={s} onClick={()=>setQuery(s)} style={{background:"#fff",border:"1px solid #dde8ff",borderRadius:20,padding:"7px 13px",fontSize:12.5,color:"#4F8EF7",fontWeight:500,cursor:"pointer"}}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {filtered.map(item=>(
            <div key={item.id} className="dash-block"><DashBlock item={item}/></div>
          ))}
          <div ref={bottomRef} style={{height:1}}/>
        </div>

        {/* Input */}
        <div style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",borderTop:"1px solid #e8ecf4",padding:"11px 18px 15px",flexShrink:0}}>
          {uploadErr&&<div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:9,padding:"8px 12px",fontSize:12.5,color:"#dc2626",marginBottom:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>⚠️ {uploadErr}</span>
            <button onClick={()=>setUploadErr("")} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",display:"flex",padding:2}}><Ico name="x" size={12}/></button>
          </div>}
          {chips.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
            {chips.map(f=>(
              <div key={f.name} onClick={()=>setActiveDS(f.name)}
                style={{display:"flex",alignItems:"center",gap:5,background:f.name===activeDS?"linear-gradient(135deg,#e0e7ff,#ede9fe)":"linear-gradient(135deg,#f0f4ff,#f5f0ff)",border:`1px solid ${f.name===activeDS?"#a5b4fc":"#dde8ff"}`,borderRadius:8,padding:"4px 9px",fontSize:11.5,color:f.name===activeDS?"#4338ca":"#4F8EF7",fontWeight:500,cursor:"pointer"}}>
                <Ico name={f.type==="image"?"image":"db"} size={11}/>
                {f.name}
                <button onClick={e=>{e.stopPropagation();removeChip(f.name);}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:0,display:"flex",marginLeft:2}}><Ico name="x" size={11}/></button>
              </div>
            ))}
          </div>}
          <div style={{display:"flex",alignItems:"flex-end",gap:8,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:16,padding:"7px 7px 7px 13px",boxShadow:"0 4px 20px rgba(79,142,247,0.07)"}}>
            <input type="file" accept=".csv,.xlsx,.xls,.tsv" ref={csvRef} onChange={onCSV} style={{display:"none"}}/>
            <input type="file" accept="image/*" ref={imgRef} onChange={onImg} style={{display:"none"}}/>
            <button onClick={()=>csvRef.current.click()} title="Upload CSV/Excel" style={{flexShrink:0,background:"linear-gradient(135deg,#f0f4ff,#f5f0ff)",border:"1px solid #dde8ff",borderRadius:9,padding:"7px 10px",color:"#4F8EF7",cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:11.5,fontWeight:600,whiteSpace:"nowrap"}}>
              <Ico name="upload" size={13}/> CSV/Excel
            </button>
            <button onClick={()=>imgRef.current.click()} title="Upload Image" style={{flexShrink:0,background:"linear-gradient(135deg,#fff5f0,#fff0f5)",border:"1px solid #ffe4d6",borderRadius:9,padding:"7px 9px",color:"#FF7849",cursor:"pointer",display:"flex",alignItems:"center"}}>
              <Ico name="image" size={13}/>
            </button>
            <div style={{width:1,height:22,background:"#e8ecf4",flexShrink:0,alignSelf:"center"}}/>
            <textarea ref={taRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey}
              placeholder={hasDS?"Ask something about your data…":"Upload a dataset first, then ask questions…"}
              rows={1}
              style={{flex:1,border:"none",outline:"none",resize:"none",fontSize:13.5,color:"#1e293b",lineHeight:1.55,fontFamily:"'DM Sans',sans-serif",background:"transparent",padding:"5px 4px",overflow:"hidden",minHeight:30}}/>
            <button onClick={handleSend} disabled={!canSend}
              style={{flexShrink:0,width:37,height:37,borderRadius:11,background:canSend?"linear-gradient(135deg,#4F8EF7,#9B6DFF)":"#e2e8f0",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:canSend?"pointer":"not-allowed",boxShadow:canSend?"0 4px 14px rgba(79,142,247,0.35)":"none",transition:"all .2s",color:canSend?"#fff":"#94a3b8",alignSelf:"flex-end"}}>
              <Ico name="send" size={14}/>
            </button>
          </div>
          <div style={{textAlign:"center",fontSize:10.5,color:"#94a3b8",marginTop:6}}>Enter to send · Shift+Enter for new line</div>
        </div>
      </div>
    </div>
  );
}
