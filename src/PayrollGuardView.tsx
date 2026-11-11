import React, { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Database, Download, Play, RefreshCw, ShieldCheck, Users } from "lucide-react"
import "./payrollguard.css"

type Dashboard = { database: string; database_name?: string; counts: Record<string, number>; open_exceptions: number; rules: number }
type Period = { pay_period_id: string; status: string }
type Run = { run_id: string; pay_period_id: string; employee_count: number; eligible_count: number; held_count: number; gross_total: number; deductions_total: number; net_total: number; reconciliation_status: string; created_at: string }
type ExceptionItem = { exception_id: string; run_id?: string; rule_id: string; employee_id: string; pay_period_id: string; severity: string; title: string; details?: string; status: string; created_at: string; reviewed_by?: string; review_note?: string }
const API = `${import.meta.env.VITE_PAYROLLGUARD_API_URL || ""}/api/v1/payrollguard`

async function readApiResponse(response: Response) {
  const raw = await response.text()
  let body: any = {}
  if (raw.trim()) {
    try { body = JSON.parse(raw) }
    catch { throw new Error(`PayrollGuard API returned an invalid response (HTTP ${response.status}). Check that the backend is running and review its terminal output.`) }
  }
  if (!response.ok) {
    const detail = body?.detail || body?.message || `API request failed (HTTP ${response.status})`
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail))
  }
  if (!raw.trim()) throw new Error(`PayrollGuard API returned an empty response (HTTP ${response.status}).`)
  return body
}
const labels: Record<string,string> = { employees:"Employees", pay_periods:"Pay periods", time_entries:"Time entries", leave_records:"Leave records", allowance_transactions:"Allowance transactions", deduction_transactions:"Deduction transactions", exceptions:"Exceptions", approvals:"Approvals", payroll_exports:"Payroll exports" }

export default function PayrollGuardView() {
  const [data,setData] = useState<Dashboard|null>(null)
  const [loading,setLoading] = useState(false)
  const [message,setMessage] = useState("Checking the local PayrollGuard API and MongoDB…")
  const [error,setError] = useState("")
  const [periods,setPeriods] = useState<Period[]>([])
  const [selectedPeriod,setSelectedPeriod] = useState("PP-2026-01")
  const [runs,setRuns] = useState<Run[]>([])
  const [calculating,setCalculating] = useState(false)
  const [phase3Message,setPhase3Message] = useState("")
  const [exceptions,setExceptions] = useState<ExceptionItem[]>([])
  const [exceptionStatus,setExceptionStatus] = useState("OPEN")
  const [exceptionSeverity,setExceptionSeverity] = useState("ALL")
  const [exceptionBusy,setExceptionBusy] = useState("")
  const [exceptionMessage,setExceptionMessage] = useState("")
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { const r=await fetch(`${API}/dashboard`, { headers: { Accept: "application/json" } }); setData(await readApiResponse(r)); setMessage("Live data loaded from the PayrollGuard database."); const [pr,rr,er]=await Promise.all([fetch(`${API}/periods`),fetch(`${API}/runs`),fetch(`${API}/exceptions?limit=100`)]); if(pr.ok){const ps=await readApiResponse(pr);setPeriods(ps);if(ps.length && !ps.some((p:Period)=>p.pay_period_id===selectedPeriod))setSelectedPeriod(ps[0].pay_period_id)} if(rr.ok)setRuns(await readApiResponse(rr)); if(er.ok){const ex=await readApiResponse(er);setExceptions(ex.items||[])} }
    catch(e) { setError(e instanceof Error?e.message:"Unable to connect"); setMessage("API request failed. Confirm the backend is running on port 8001 and MongoDB is running on port 27017."); setData(null) }
    finally { setLoading(false) }
  },[selectedPeriod])
  useEffect(()=>{ void load() },[load])
  const generate = async () => {
    const confirmed = window.confirm("Generate the deterministic PayrollGuard test dataset? This clears and replaces existing PayrollGuard demo records in the dedicated naxpayroll_guard database. It does not modify the other Naxpayroll modules.")
    if (!confirmed) return
    setLoading(true); setError(""); setMessage("Generating deterministic synthetic records. This may take a few minutes…")
    try { const r=await fetch(`${API}/generate?seed=20261022`,{method:"POST", headers:{Accept:"application/json"}}); const body=await readApiResponse(r); setMessage(body.message || "Synthetic dataset generated and verified. Refreshing live database counts…"); await load() }
    catch(e) { setError(e instanceof Error?e.message:"Generation failed"); setMessage("Generation did not complete. Check MongoDB, backend logs, and the API health endpoint.") }
    finally { setLoading(false) }
  }
  const format=(n:number)=>n.toLocaleString("en-IN")
  const calculate = async () => {
    if (!selectedPeriod) { setPhase3Message("Generate the Phase 2 dataset first."); return }
    if (!window.confirm(`Calculate payroll for ${selectedPeriod}? This creates a new immutable calculation run. Previous runs will not be overwritten.`)) return
    setCalculating(true); setPhase3Message("Calculating payroll and reconciling totals…")
    try { const response=await fetch(`${API}/calculate?pay_period_id=${encodeURIComponent(selectedPeriod)}`,{method:"POST",headers:{Accept:"application/json"}}); const result=await readApiResponse(response); setPhase3Message(`${result.message} Run: ${result.run_id}. Eligible: ${result.eligible_count}; on hold: ${result.held_count}; excluded unapproved time entries: ${result.unapproved_time_excluded}. Reconciliation: ${result.reconciliation.status}.`); const rr=await fetch(`${API}/runs`); if(rr.ok)setRuns(await readApiResponse(rr)); await load() }
    catch(e){setPhase3Message(e instanceof Error?e.message:"Payroll calculation failed.")}
    finally{setCalculating(false)}
  }
  const refreshExceptions = async () => {
    const params = new URLSearchParams({limit:"200"})
    if (exceptionStatus !== "ALL") params.set("status", exceptionStatus)
    if (exceptionSeverity !== "ALL") params.set("severity", exceptionSeverity)
    if (selectedPeriod) params.set("pay_period_id", selectedPeriod)
    const response = await fetch(`${API}/exceptions?${params.toString()}`)
    const result = await readApiResponse(response)
    setExceptions(result.items || [])
  }
  const updateException = async (item: ExceptionItem, action: "IN_REVIEW" | "RESOLVE" | "REOPEN") => {
    const note = action === "RESOLVE" ? window.prompt("Add a resolution note (optional):", "Reviewed and corrected/accepted") : ""
    if (note === null) return
    setExceptionBusy(item.exception_id); setExceptionMessage("")
    try {
      const response = await fetch(`${API}/exceptions/${encodeURIComponent(item.exception_id)}`, {method:"PATCH", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify({action,note,reviewed_by:"Payroll Admin"})})
      const result = await readApiResponse(response); setExceptionMessage(result.message); await refreshExceptions(); const dash=await fetch(`${API}/dashboard`); if(dash.ok)setData(await readApiResponse(dash))
    } catch(e) { setExceptionMessage(e instanceof Error ? e.message : "Unable to update exception.") }
    finally { setExceptionBusy("") }
  }
  const currency=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n||0)

  return <section className="pg-page">
    <div className="pg-heading"><div><div className="pg-eyebrow">PAYROLL INTELLIGENCE</div><h1>PayrollGuard AI</h1><p>Validate payroll inputs, identify exceptions and keep an auditable path to payroll export.</p></div><button className="pg-button secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
    <div className="pg-status"><span className={`pg-dot ${data?.database==="connected"?"online":"offline"}`}/><strong>{data?.database==="connected"?`MongoDB connected${data.database_name?` · ${data.database_name}`:""}`:"Database not connected"}</strong><span>{message}</span></div>
    {error && <div className="pg-error"><AlertTriangle size={17}/>{error}<span>Start MongoDB and the PayrollGuard API, then refresh.</span></div>}
    <div className="pg-cards">
      <article><div className="pg-card-icon"><Users/></div><span>Employees</span><strong>{format(data?.counts.employees??0)}</strong><small>Synthetic employee profiles</small></article>
      <article><div className="pg-card-icon"><Activity/></div><span>Time entries</span><strong>{format(data?.counts.time_entries??0)}</strong><small>Across three pay periods</small></article>
      <article><div className="pg-card-icon"><AlertTriangle/></div><span>Open exceptions</span><strong>{format(data?.open_exceptions??0)}</strong><small>Awaiting review</small></article>
      <article><div className="pg-card-icon"><ShieldCheck/></div><span>Validation rules</span><strong>{data?.rules??10}</strong><small>Deterministic rule checks</small></article>
    </div>
    <div className="pg-panel"><div className="pg-panel-head"><div><h2>Dataset & controls</h2><p>Generate reproducible test data using seed 20261022.</p></div><button className="pg-button" onClick={()=>void generate()} disabled={loading}><Play size={16}/>{loading?"Working…":"Generate synthetic data"}</button></div>
      <div className="pg-counts">{Object.entries(labels).map(([key,label])=><div key={key}><span>{label}</span><strong>{format(data?.counts[key]??0)}</strong></div>)}</div>
      <div className="pg-note"><Database size={17}/><div><strong>Local-only data generation</strong><p>Uses synthetic names, bank tokens and tax identifiers. Ground-truth test cases are stored separately and are not read by production validation logic. Generating again replaces the PayrollGuard demo records in its dedicated database.</p></div></div>
    </div>
    <div className="pg-panel"><div className="pg-panel-head"><div><h2>Phase 3 · Payroll calculation & reconciliation</h2><p>Calculate approved payroll inputs for a selected pay period. Each run is stored as immutable history.</p></div></div><div className="pg-phase3-controls"><select value={selectedPeriod} onChange={e=>setSelectedPeriod(e.target.value)} disabled={!periods.length || calculating}>{periods.length?periods.map(p=><option key={p.pay_period_id} value={p.pay_period_id}>{p.pay_period_id} · {p.status}</option>):<option value="">No pay periods found</option>}</select><button className="pg-button" onClick={()=>void calculate()} disabled={calculating || !periods.length}><Play size={16}/>{calculating?"Calculating…":"Calculate & reconcile payroll"}</button></div>{phase3Message && <div className="pg-note"><ShieldCheck size={17}/><div><strong>Calculation result</strong><p>{phase3Message}</p></div></div>}<div className="pg-rule-grid"><div><span>PAY RULE</span>Approved hours × monthly salary / 160; overtime above 160 hours at 1.5×</div><div><span>CONTROLS</span>Unapproved entries excluded; duplicate approved transactions counted once</div><div><span>HOLD POLICY</span>Over 200 hours, missing bank/tax details, inactive status or negative net pay</div><div><span>RECONCILIATION</span>Gross pay − deductions − net pay must equal zero</div></div>{runs.length>0 && <div className="pg-run-list"><h3>Recent calculation runs</h3>{runs.slice(0,5).map(run=><div className="pg-run-row" key={run.run_id}><div><strong>{run.pay_period_id}</strong><small>{run.run_id} · {new Date(run.created_at).toLocaleString()}</small></div><div><strong>{currency(run.net_total)}</strong><small>{run.eligible_count} eligible · {run.held_count} on hold</small></div><span className={run.reconciliation_status==="PASS"?"pg-pass":"pg-hold"}>{run.reconciliation_status}</span></div>)}</div>}</div>
    <div className="pg-panel"><div className="pg-panel-head"><div><h2>Phase 4 · Exception management</h2><p>Filter payroll exceptions, assign them for review, resolve with a note, or reopen when more work is needed. Every action is audit logged.</p></div><button className="pg-button secondary" onClick={()=>void refreshExceptions()}><RefreshCw size={15}/> Refresh exceptions</button></div>
      <div className="pg-phase3-controls"><select value={exceptionStatus} onChange={e=>setExceptionStatus(e.target.value)}><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option><option value="ALL">All statuses</option></select><select value={exceptionSeverity} onChange={e=>setExceptionSeverity(e.target.value)}><option value="ALL">All severities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><button className="pg-button" onClick={()=>void refreshExceptions()}>Apply filters</button></div>
      {exceptionMessage && <div className="pg-note"><ShieldCheck size={17}/><div><p>{exceptionMessage}</p></div></div>}
      <div className="pg-exception-list">{exceptions.length ? exceptions.map(item=><article className="pg-exception-row" key={item.exception_id}><div className="pg-exception-main"><div className="pg-exception-tags"><span className={`pg-severity ${item.severity.toLowerCase()}`}>{item.severity}</span><span className="pg-exception-status">{item.status.replace("_"," ")}</span><span>{item.rule_id}</span></div><strong>{item.title || item.details || item.rule_id}</strong><small>{item.employee_id} · {item.pay_period_id} · {item.exception_id}</small>{item.review_note && <small>Review note: {item.review_note}</small>}</div><div className="pg-exception-actions">{item.status==="OPEN" && <button className="pg-button secondary" disabled={exceptionBusy===item.exception_id} onClick={()=>void updateException(item,"IN_REVIEW")}>Start review</button>}{item.status!=="RESOLVED" && <button className="pg-button" disabled={exceptionBusy===item.exception_id} onClick={()=>void updateException(item,"RESOLVE")}>Resolve</button>}{item.status==="RESOLVED" && <button className="pg-button secondary" disabled={exceptionBusy===item.exception_id} onClick={()=>void updateException(item,"REOPEN")}>Reopen</button>}</div></article>) : <div className="pg-empty">No exceptions match the selected filters. Run payroll calculation to generate validation findings.</div>}</div>
    </div>
    <div className="pg-panel"><div className="pg-panel-head"><div><h2>Validation controls</h2><p>Phase 2 registers these rules; Phase 3 applies calculation controls; Phase 4 provides review and audit workflows.</p></div></div><div className="pg-rule-grid">{["Missing bank details","Missing tax identifier","Duplicate time entry","Hours exceed period maximum","Duplicate allowance","Unapproved time included","Duplicate leave deduction","Reconciliation failure","Negative net pay","Invalid employee status"].map((rule,i)=><div key={rule}><span>VR-{String(i+1).padStart(3,"0")}</span>{rule}</div>)}</div></div>
    <div className="pg-footnote"><Download size={15}/> CSV outputs, ground truth and SHA-256 manifest are written under the project <code>data/</code> directory.</div>
  </section>
}
