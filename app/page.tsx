"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity, BrainCircuit, CheckCircle2, ChevronRight, CircleAlert,
  Cpu, Gauge, LayoutDashboard, Menu, MessageSquare, Network,
  Radar, Search, Send, ShieldCheck, Sparkles, X, Zap,
  ArrowUpRight, Clock3, Database, Server, Wifi, ChartNoAxesCombined
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar
} from "recharts";

type Finding = {
  agent: string;
  observation: string;
  evidence: string[];
  limitations: string[];
};

type Hypothesis = {
  id: string;
  explanation: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  confidence: number;
};

type Verification = {
  hypothesis_id: string;
  verdict: "supported" | "challenged" | "inconclusive";
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  reasoning: string;
  confidence: number;
};

type Diagnosis = {
  incident_id: string;
  device: string;
  status: string;
  summary: string;
  findings: Finding[];
  evidence_catalog?: { id: string; agent: string; statement: string }[];
  hypotheses?: Hypothesis[];
  verifications?: Verification[];
  missing_evidence: string[];
  recommendations: string[];
  generated_at: string;
};

type MetricKey =
  | "latency_ms" | "packet_loss_percent" | "jitter_ms"
  | "cpu_utilization_percent" | "memory_utilization_percent"
  | "interface_errors" | "queue_drops";

const metricFields: { key: MetricKey; label: string; unit: string; icon: typeof Activity }[] = [
  { key: "latency_ms", label: "Latency", unit: "ms", icon: Activity },
  { key: "packet_loss_percent", label: "Packet loss", unit: "%", icon: Wifi },
  { key: "jitter_ms", label: "Jitter", unit: "ms", icon: Zap },
  { key: "cpu_utilization_percent", label: "CPU utilization", unit: "%", icon: Cpu },
  { key: "memory_utilization_percent", label: "Memory utilization", unit: "%", icon: Database },
  { key: "interface_errors", label: "Interface errors", unit: "count", icon: CircleAlert },
  { key: "queue_drops", label: "Queue drops", unit: "count", icon: Network },
];

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "diagnosis", label: "Network diagnosis", icon: Radar },
  { id: "investigation", label: "Investigations", icon: Search },
  { id: "agents", label: "Agent intelligence", icon: BrainCircuit },
  { id: "analyst", label: "AI analyst", icon: MessageSquare },
];

const chartTooltip = {
  contentStyle: {
    background: "#101c31",
    border: "1px solid #263b59",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
  },
  itemStyle: { color: "#93c5fd" },
};

type PanelProps = { children: React.ReactNode; className?: string };

function Panel({ children, className = "" }: PanelProps) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_18px_rgba(15,35,65,0.035)] ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[#14243d]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ title, value, unit, icon: Icon, note, tone = "blue", reduceMotion }: {
  title: string; value: string; unit: string; icon: typeof Activity;
  note: string; tone?: string; reduceMotion: boolean;
}) {
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -4 }}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_18px_rgba(15,35,65,0.035)]"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-[#14243d]">{value}</span>
        <span className="text-sm text-slate-400">{unit}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </motion.div>
  );
}
export default function Home() {
  const [activePage, setActivePage] = useState("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [incidentId, setIncidentId] = useState("NETCOOP-001");
  const [device, setDevice] = useState("Router-01");
  const [metrics, setMetrics] = useState<Record<MetricKey, string>>({
    latency_ms: "250",
    packet_loss_percent: "5",
    jitter_ms: "45",
    cpu_utilization_percent: "90",
    memory_utilization_percent: "70",
    interface_errors: "",
    queue_drops: "",
  });
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [apiHealth, setApiHealth] = useState<"checking" | "available" | "unavailable">("checking");

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const results = await Promise.all([
          fetch("/api/chat", { cache: "no-store" }),
          fetch("/api/diagnose", { cache: "no-store" }),
        ]);

        const payloads = await Promise.all(results.map(async (response) => {
          if (!response.ok) return false;
          const data = await response.json();
          return data.status === "ready";
        }));

        if (active) {
          setApiHealth(payloads.every(Boolean) ? "available" : "unavailable");
        }
      } catch {
        if (active) setApiHealth("unavailable");
      }
    };

    void checkHealth();
    const interval = window.setInterval(checkHealth, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [provider, setProvider] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Welcome to NetCoop AI. I can help explain network symptoms and investigate telemetry. What would you like to understand?" },
  ]);

  const reduceMotion = useReducedMotion();

  const latestMetrics = useMemo(() => {
    if (!diagnosis) return metrics;
    const values: Record<string, string> = { ...metrics };
    return values;
  }, [diagnosis, metrics]);

  async function runDiagnosis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiagnosing(true);
    setDiagnosisError("");
    setDiagnosis(null);

    const parsedMetrics: Partial<Record<MetricKey, number>> = {};
    for (const [key, value] of Object.entries(metrics)) {
      if (value.trim() !== "") {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          setDiagnosisError(`Invalid numeric value for ${key}.`);
          setDiagnosing(false);
          return;
        }
        parsedMetrics[key as MetricKey] = number;
      }
    }

    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: incidentId, device, metrics: parsedMetrics }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "Diagnosis failed.");
      const report = result.investigation?.report;
      if (!report || !Array.isArray(report.findings)) {
        throw new Error("The API response is missing a valid diagnosis report.");
      }
      setDiagnosis(report);
      setActivePage("investigation");
    } catch (error) {
      setDiagnosisError(error instanceof Error ? error.message : "Unable to run diagnosis.");
    } finally {
      setDiagnosing(false);
    }
  }

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = question.trim();
    if (!message || chatLoading) return;
    setMessages((old) => [...old, { role: "user", text: message }]);
    setQuestion("");
    setChatError("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation: messages.slice(-10),
          context: {
            incident_id: incidentId,
            device,
            metrics: latestMetrics,
            diagnosis,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "AI request failed.");
      if (typeof result.answer !== "string") throw new Error("Invalid AI response.");
      setProvider(result.provider || "Configured provider");
      setMessages((old) => [...old, { role: "assistant", text: result.answer }]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unable to contact AI.";
      setChatError(messageText);
      setMessages((old) => [...old, { role: "assistant", text: `I couldn't complete that request. ${messageText}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  const go = (id: string) => {
    setActivePage(id);
    setMobileMenu(false);
  };

  const pageTitle = navItems.find((item) => item.id === activePage)?.label ?? "Overview";
  const statusColor = (status: string) =>
    status === "probable_cause" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : status === "no_fault_detected" ? "text-sky-700 bg-sky-50 border-sky-200"
    : status === "multiple_plausible_causes" ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-orange-700 bg-orange-50 border-orange-200";

  const verdictColor = (verdict: string) =>
    verdict === "supported" ? "text-emerald-700 bg-emerald-50"
    : verdict === "challenged" ? "text-rose-700 bg-rose-50"
    : "text-amber-700 bg-amber-50";

  const agentRows = [
    { name: "Performance Agent", detail: "Latency, packet loss & jitter", state: diagnosing ? "Running" : diagnosis ? "Completed" : "Idle", icon: Activity },
    { name: "Infrastructure Agent", detail: "CPU, memory & interface signals", state: diagnosing ? "Running" : diagnosis ? "Completed" : "Idle", icon: Server },
    { name: "Hypothesis Agent", detail: "LLM-generated explanations", state: diagnosing ? "Running" : diagnosis ? "Completed" : "Idle", icon: BrainCircuit },
    { name: "Verification Agent", detail: "Independent evidence assessment", state: diagnosing ? "Running" : diagnosis ? "Completed" : "Idle", icon: ShieldCheck },
    { name: "Coordinator", detail: "Orchestrates investigation sequence", state: diagnosing ? "Running" : diagnosis ? "Completed" : "Idle", icon: Network },
  ];

  const metricChartData = [
    { metric: "Latency", value: Number(metrics.latency_ms) || 0, threshold: 150 },
    { metric: "Packet loss", value: Number(metrics.packet_loss_percent) || 0, threshold: 2 },
    { metric: "Jitter", value: Number(metrics.jitter_ms) || 0, threshold: 30 },
    { metric: "CPU", value: Number(metrics.cpu_utilization_percent) || 0, threshold: 85 },
    { metric: "Memory", value: Number(metrics.memory_utilization_percent) || 0, threshold: 90 },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#17263e]">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-[258px] flex-col rounded-[26px] border border-white/80 bg-white/75 text-slate-800 shadow-[0_18px_55px_rgba(91,132,190,0.13)] backdrop-blur-2xl lg:flex">
        <div className="flex h-[82px] items-center gap-3 rounded-t-[26px] border-b border-blue-100/70 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-white shadow-lg shadow-blue-300/40">
            <Network size={21} />
          </div>
          <div>
            <p className="text-[16px] font-bold tracking-wide">NetCoop <span className="text-cyan-600">AI</span></p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-400">Network intelligence</p>
          </div>
        </div>

        <div className="px-4 pt-8">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => go(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-medium transition-all ${
                    activePage === item.id
                      ? "bg-gradient-to-r from-blue-50 via-cyan-50 to-violet-50 text-blue-700 shadow-sm ring-1 ring-blue-100/80"
                      : "text-slate-500 hover:bg-blue-50/80 hover:text-blue-700"
                  }`}>
                  <Icon size={18} className={activePage === item.id ? "text-blue-600" : "text-slate-400 group-hover:text-cyan-600"} />
                  {item.label}
                  {activePage === item.id && <ChevronRight size={15} className="ml-auto" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-white/90 to-violet-50/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${apiHealth === "available" ? "bg-emerald-400 shadow-[0_0_9px_#34d399]" : apiHealth === "checking" ? "bg-amber-400" : "bg-rose-400"}`} />
              <span className="text-xs font-semibold text-slate-700">Backend · {apiHealth === "checking" ? "Checking" : apiHealth === "available" ? "Available" : "Unavailable"}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{apiHealth === "available" ? "Diagnosis and analyst APIs are responding. Live device telemetry is not connected." : apiHealth === "checking" ? "Checking diagnosis and analyst API health..." : "One or more APIs are unavailable. Check the development server."}</p>
          </div>
          <p className="px-2 pt-4 text-[10px] text-slate-400">NETCOOP AI · INVESTIGATION WORKSPACE</p>
        </div>
      </aside>

      {mobileMenu && (
        <div className="fixed inset-0 z-50 bg-[#101c31] p-5 text-white lg:hidden">
          <div className="mb-8 flex items-center justify-between">
            <span className="text-lg font-bold">NetCoop AI</span>
            <button onClick={() => setMobileMenu(false)} aria-label="Close menu"><X /></button>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} onClick={() => go(item.id)} className="flex w-full items-center gap-3 rounded-xl p-4 text-left hover:bg-white/10"><Icon size={19} />{item.label}</button>;
            })}
          </nav>
        </div>
      )}

      <section className="min-h-screen lg:ml-[282px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/80 bg-white/65 px-5 shadow-[0_8px_30px_rgba(100,140,190,0.06)] backdrop-blur-2xl md:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-blue-600">Network operations center</p>
              <h1 className="mt-1 text-[17px] font-bold tracking-tight text-[#14243d]">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-semibold text-slate-600">API interface</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf0ff] text-xs font-bold text-blue-700">NC</div>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={activePage}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-[1500px] space-y-7 p-5 pb-24 md:p-8">

            {activePage === "overview" && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-600">NETCOOP INTELLIGENCE</p>
                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#14243d] md:text-[36px]">Network overview<span className="text-blue-600">.</span></h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">A unified workspace for telemetry analysis, autonomous investigation and evidence-backed network insights.</p>
                  </div>
                  <button onClick={() => go("diagnosis")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700">
                    <Radar size={17} /> New investigation <ArrowUpRight size={16} />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard reduceMotion={!!reduceMotion} title="Latency" value={metrics.latency_ms || "—"} unit="ms" icon={Activity} note="Sample input · threshold 150 ms" tone="amber" />
                  <MetricCard reduceMotion={!!reduceMotion} title="Packet loss" value={metrics.packet_loss_percent || "—"} unit="%" icon={Wifi} note="Sample input · threshold 2%" tone="amber" />
                  <MetricCard reduceMotion={!!reduceMotion} title="CPU utilization" value={metrics.cpu_utilization_percent || "—"} unit="%" icon={Cpu} note="Sample input · threshold 85%" tone="amber" />
                  <MetricCard reduceMotion={!!reduceMotion} title="Jitter" value={metrics.jitter_ms || "—"} unit="ms" icon={Zap} note="Sample input · threshold 30 ms" tone="amber" />
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
                  <Panel className="p-5 md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[#17263e]">Telemetry snapshot</h3>
                        <p className="mt-1 text-xs text-slate-500">Sample/input telemetry · measurements compared with investigation thresholds</p>
                      </div>
                      <span className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700">Sample input</span>
                    </div>
                    <div className="mt-5 h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metricChartData} margin={{ top: 8, right: 8, left: -18, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f6" />
                          <XAxis dataKey="metric" tick={{ fill: "#8491a5", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#8491a5", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip {...chartTooltip} />
                          <Bar dataKey="value" name="Measured value" fill="#3977ed" radius={[6, 6, 0, 0]} maxBarSize={38} />
                          <Bar dataKey="threshold" name="Threshold" fill="#d7e2f3" radius={[6, 6, 0, 0]} maxBarSize={38} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">Different metrics use different units. Compare each measurement with its own threshold, not across metrics.</p>
                  </Panel>

                  <Panel className="p-5 md:p-6">
                    <h3 className="font-bold text-[#17263e]">Agent ecosystem</h3>
                    <p className="mt-1 text-xs text-slate-500">Current implementation components</p>
                    <div className="mt-5 space-y-4">
                      {agentRows.map((agent, index) => {
                        const Icon = agent.icon;
                        return (
                          <motion.div key={agent.name} initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={17} /></div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800">{agent.name}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{agent.detail}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${agent.state === "Completed" ? "bg-emerald-50 text-emerald-700" : agent.state === "Running" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{agent.state}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                    <button onClick={() => go("agents")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Explore architecture <ChevronRight size={14} /></button>
                  </Panel>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Panel className="p-5 md:p-6">
                    <div className="flex items-center gap-2"><ShieldCheck className="text-blue-600" size={19} /><h3 className="font-bold">Investigation integrity</h3></div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">NetCoop AI distinguishes observed anomalies from confirmed root causes. It reports insufficient evidence when the available telemetry cannot support a reliable conclusion.</p>
                    <div className="mt-4 rounded-xl bg-blue-50/80 p-4">
                      <p className="text-xs font-semibold text-blue-800">Evidence-first approach</p>
                      <p className="mt-1 text-xs leading-5 text-blue-700">No automatic production remediation. Recommendations require analyst review.</p>
                    </div>
                  </Panel>
                  <Panel className="p-5 md:p-6">
                    <div className="flex items-center gap-2"><ChartNoAxesCombined className="text-blue-600" size={19} /><h3 className="font-bold">Latest investigation</h3></div>
                    {diagnosis ? (
                      <>
                        <p className="mt-3 text-lg font-bold">{diagnosis.incident_id}</p>
                        <p className="mt-1 text-sm text-slate-500">{diagnosis.device} · {diagnosis.status.replaceAll("_", " ")}</p>
                        <button onClick={() => go("investigation")} className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800">View report <ChevronRight className="inline" size={14} /></button>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm text-slate-500">No report has been generated in this session yet.</p>
                        <button onClick={() => go("diagnosis")} className="mt-4 text-xs font-semibold text-blue-600">Start an investigation <ChevronRight className="inline" size={14} /></button>
                      </>
                    )}
                  </Panel>
                </div>
              </>
            )}

            {activePage === "diagnosis" && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-600">DIAGNOSTIC WORKSPACE</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight">Run an investigation<span className="text-blue-600">.</span></h2>
                  <p className="mt-2 text-sm text-slate-500">Provide available device telemetry. Unknown measurements should remain empty.</p>
                </div>
                <Panel className="p-5 md:p-7">
                  <form onSubmit={runDiagnosis} className="space-y-7">
                    <div>
                      <h3 className="font-bold">Incident details</h3>
                      <p className="mt-1 text-xs text-slate-500">Identify the device and investigation context.</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Incident ID</span><input className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" value={incidentId} onChange={(e) => setIncidentId(e.target.value)} required /></label>
                        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Device name</span><input className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" value={device} onChange={(e) => setDevice(e.target.value)} required /></label>
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div><h3 className="font-bold">Telemetry measurements</h3><p className="mt-1 text-xs text-slate-500">Use the correct unit for every measurement.</p></div>
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-medium text-slate-500">Optional fields may be left empty</span>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {metricFields.map((field) => {
                          const Icon = field.icon;
                          return (
                            <label key={field.key} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/20">
                              <span className="flex items-center justify-between text-xs font-semibold text-slate-600">{field.label}<Icon size={16} className="text-slate-400" /></span>
                              <span className="mt-3 flex items-center gap-2"><input type="number" step="any" min="0" max={field.key.includes("percent") ? 100 : undefined} placeholder="Not provided" value={metrics[field.key]} onChange={(e) => setMetrics((old) => ({ ...old, [field.key]: e.target.value }))} className="min-w-0 flex-1 bg-transparent text-xl font-bold text-[#17263e] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-slate-300" /><span className="text-xs text-slate-400">{field.unit}</span></span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {diagnosisError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{diagnosisError}</div>}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                      <p className="max-w-md text-[11px] leading-5 text-slate-400">Only the values you enter are submitted. NetCoop AI will report missing evidence rather than assuming unavailable measurements.</p>
                      <button disabled={diagnosing} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50">{diagnosing ? <><Activity className="animate-pulse" size={17} /> Investigating...</> : <><Radar size={17} /> Run investigation <ArrowUpRight size={16} /></>}</button>
                    </div>
                  </form>
                </Panel>
              </>
            )}

            {activePage === "investigation" && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-600">EVIDENCE & ANALYSIS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Investigation report<span className="text-blue-600">.</span></h2><p className="mt-2 text-sm text-slate-500">Findings, hypotheses and independent verification from the diagnosis API.</p></div>
                  <button onClick={() => go("diagnosis")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">New investigation</button>
                </div>
                {!diagnosis ? (
                  <Panel className="p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Search size={25} /></div><h3 className="mt-4 font-bold">No investigation report yet</h3><p className="mt-2 text-sm text-slate-500">Run a diagnosis to view the agent findings and evidence.</p><button onClick={() => go("diagnosis")} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Start diagnosis</button></Panel>
                ) : (
                  <>
                    <Panel className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 md:p-6">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">{diagnosis.incident_id}</p><h3 className="mt-2 text-xl font-bold">{diagnosis.device}</h3><p className="mt-1 text-xs text-slate-400">Generated {new Date(diagnosis.generated_at).toLocaleString()}</p></div>
                        <span className={`rounded-full border px-3 py-2 text-xs font-bold ${statusColor(diagnosis.status)}`}>{diagnosis.status.replaceAll("_", " ")}</span>
                      </div>
                      <div className="p-5 md:p-6"><p className="text-sm leading-7 text-slate-600">{diagnosis.summary}</p></div>
                    </Panel>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <Panel className="p-5 md:p-6">
                        <SectionTitle title="Agent findings" subtitle={`${diagnosis.findings.length} contributing agent reports`} />
                        <div className="space-y-4">
                          {diagnosis.findings.map((finding, index) => (
                            <motion.div key={`${finding.agent}-${index}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }} className="rounded-xl border border-slate-200 p-4">
                              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BrainCircuit size={16} /></span><p className="text-sm font-bold capitalize">{finding.agent.replaceAll("-", " ")}</p></div>
                              <p className="mt-3 text-sm leading-6 text-slate-600">{finding.observation}</p>
                              {finding.evidence.length > 0 && <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Supporting evidence</p><ul className="mt-2 space-y-2">{finding.evidence.map((item, i) => <li key={i} className="flex gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />{item}</li>)}</ul></div>}
                              {finding.limitations.length > 0 && <div className="mt-4 rounded-lg bg-amber-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Limitations</p><ul className="mt-2 space-y-1">{finding.limitations.map((item, i) => <li key={i} className="text-xs leading-5 text-amber-900/80">• {item}</li>)}</ul></div>}
                            </motion.div>
                          ))}
                        </div>
                      </Panel>

                      <Panel className="p-5 md:p-6">
                        <SectionTitle title="Hypothesis analysis" subtitle="Possible explanations generated by the hypothesis agent" />
                        {diagnosis.hypotheses?.length ? (
                          <div className="space-y-4">{diagnosis.hypotheses.map((hypothesis) => (
                            <div key={hypothesis.id} className="rounded-xl border border-slate-200 p-4">
                              <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-blue-700">{hypothesis.id}</span><span className="text-xs font-bold text-slate-600">{Math.round(hypothesis.confidence * 100)}% confidence</span></div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, hypothesis.confidence * 100))}%` }} /></div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">{hypothesis.explanation}</p>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-emerald-50/70 p-3"><p className="text-[10px] font-bold uppercase text-emerald-800">Supporting</p><p className="mt-1 text-xs text-emerald-900">{hypothesis.supporting_evidence.join(", ") || "None supplied"}</p></div>
                                <div className="rounded-lg bg-rose-50/70 p-3"><p className="text-[10px] font-bold uppercase text-rose-800">Contradicting</p><p className="mt-1 text-xs text-rose-900">{hypothesis.contradicting_evidence.join(", ") || "None supplied"}</p></div>
                              </div>
                              {hypothesis.missing_evidence.length > 0 && <p className="mt-3 text-xs leading-5 text-amber-800">Missing: {hypothesis.missing_evidence.join("; ")}</p>}
                            </div>
                          ))}</div>
                        ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hypothesis details were included in this API response.</p>}
                      </Panel>
                    </div>

                    <Panel className="p-5 md:p-6">
                      <SectionTitle title="Independent verification" subtitle="The verification agent's assessment of each hypothesis" />
                      {diagnosis.verifications?.length ? (
                        <div className="grid gap-4 lg:grid-cols-2">{diagnosis.verifications.map((verification) => (
                          <div key={verification.hypothesis_id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{verification.hypothesis_id}</p><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${verdictColor(verification.verdict)}`}>{verification.verdict}</span></div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{verification.reasoning}</p>
                            <p className="mt-3 text-xs font-semibold text-slate-600">Verification confidence: {Math.round(verification.confidence * 100)}%</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">Supporting: {verification.supporting_evidence.join(", ") || "None"}</div><div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-900">Contradicting: {verification.contradicting_evidence.join(", ") || "None"}</div></div>
                            {verification.missing_evidence.length > 0 && <p className="mt-3 text-xs text-amber-800">Missing: {verification.missing_evidence.join("; ")}</p>}
                          </div>
                        ))}</div>
                      ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No separate verification details were included in this API response. The summary alone is not treated as a verification record.</p>}
                    </Panel>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <Panel className="p-5 md:p-6">
                        <SectionTitle title="Missing evidence" subtitle="Data and context still needed" />
                        {diagnosis.missing_evidence.length ? <ul className="space-y-3">{diagnosis.missing_evidence.map((item, i) => <li key={i} className="flex gap-3 text-sm leading-6 text-slate-600"><CircleAlert size={16} className="mt-1 shrink-0 text-amber-500" />{item}</li>)}</ul> : <p className="text-sm text-slate-500">No missing evidence was reported.</p>}
                      </Panel>
                      <Panel className="p-5 md:p-6">
                        <SectionTitle title="Recommended next actions" subtitle="Evidence-led investigation guidance" />
                        {diagnosis.recommendations.length ? <ul className="space-y-3">{diagnosis.recommendations.map((item, i) => <li key={i} className="flex gap-3 text-sm leading-6 text-slate-600"><ChevronRight size={16} className="mt-1 shrink-0 text-blue-600" />{item}</li>)}</ul> : <p className="text-sm text-slate-500">No recommendations were returned.</p>}
                      </Panel>
                    </div>

                    {diagnosis.evidence_catalog && diagnosis.evidence_catalog.length > 0 && (
                      <Panel className="p-5 md:p-6">
                        <SectionTitle title="Evidence catalogue" subtitle="Traceable references used by the investigation" />
                        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-slate-100 text-slate-400"><th className="pb-3 pr-4">ID</th><th className="pb-3 pr-4">Agent</th><th className="pb-3">Evidence statement</th></tr></thead><tbody>{diagnosis.evidence_catalog.map((item) => <tr key={item.id} className="border-b border-slate-50"><td className="py-3 pr-4 font-bold text-blue-700">{item.id}</td><td className="py-3 pr-4 text-slate-500">{item.agent}</td><td className="py-3 text-slate-700">{item.statement}</td></tr>)}</tbody></table></div>
                      </Panel>
                    )}
                  </>
                )}
              </>
            )}

            {activePage === "agents" && (
              <>
                <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-600">SYSTEM DESIGN</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Agent intelligence<span className="text-blue-600">.</span></h2><p className="mt-2 text-sm text-slate-500">The collaborating components in the current investigation pipeline.</p></div>
                <Panel className="p-5 md:p-7">
                  <SectionTitle title="Investigation workflow" subtitle="Conceptual execution sequence based on the current coordinator implementation" />
                  <div className="grid gap-3 md:grid-cols-5">
                    {agentRows.map((agent, index) => {
                      const Icon = agent.icon;
                      return <div key={agent.name} className="relative rounded-xl border border-slate-200 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19} /></div>
                        <p className="mt-3 text-sm font-bold">{agent.name}</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">{agent.detail}</p>
                        <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${agent.state === "Completed" ? "bg-emerald-50 text-emerald-700" : agent.state === "Running" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{agent.state}</span>
                        {index < agentRows.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-slate-400 md:block" size={20} />}
                      </div>;
                    })}
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-slate-400">This is an architecture view, not a live execution trace. Individual agent completion is not inferred from this diagram.</p>
                </Panel>
                <div className="grid gap-4 md:grid-cols-2">
                  {agentRows.map((agent) => {
                    const Icon = agent.icon;
                    return <Panel key={agent.name} className="p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19} /></div><div><h3 className="text-sm font-bold">{agent.name}</h3><p className="text-xs text-slate-500">{agent.state}</p></div></div><p className="mt-3 text-sm leading-6 text-slate-500">{agent.detail}</p></Panel>;
                  })}
                </div>
              </>
            )}

            {activePage === "analyst" && (
              <>
                <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-600">AI ASSISTANT</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Network analyst<span className="text-blue-600">.</span></h2><p className="mt-2 text-sm text-slate-500">Ask questions about network symptoms, protocols and diagnostic findings.</p></div>
                <Panel className="mx-auto flex min-h-[620px] max-w-4xl flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 p-5">
                    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white"><Sparkles size={19} /></div><div><p className="text-sm font-bold">NetCoop AI Analyst</p><p className="text-[11px] text-slate-500">Language model assistant · API connected</p></div></div>
                    {provider && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-700">{provider}</span>}
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto bg-[#f8fafd] p-5 md:p-7">
                    {messages.map((message, index) => (
                      <motion.div key={index} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[88%] rounded-2xl p-4 text-sm leading-7 ${message.role === "user" ? "ml-auto bg-blue-600 text-white shadow-md shadow-blue-600/10" : "border border-slate-200 bg-white text-slate-700"}`}>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider opacity-60">{message.role === "user" ? "You" : "NetCoop AI"}</p><p className="whitespace-pre-wrap">{message.text}</p>
                      </motion.div>
                    ))}
                    {chatLoading && <div className="flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />NetCoop AI is thinking...</div>}
                  </div>
                  <div className="border-t border-slate-100 p-4 md:p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {["Explain packet loss", "How does DNS work?", "Investigate high latency"].map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{prompt}</button>)}
                    </div>
                    {chatError && <p className="mb-3 text-xs text-rose-600">{chatError}</p>}
                    <form onSubmit={sendChat} className="flex gap-2">
                      <input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={chatLoading} placeholder="Ask about network diagnostics..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white" />
                      <button type="submit" disabled={chatLoading || !question.trim()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"><Send size={16} /><span className="hidden sm:inline">Send</span></button>
                    </form>
                    <p className="mt-3 text-[10px] text-slate-400">The analyst answers through the configured LLM. It does not automatically access live network devices.</p>
                  </div>
                </Panel>
              </>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-[10px] text-slate-400">
              <span>NetCoop AI · Network intelligence platform</span>
              <span>Evidence-backed analysis · Analyst-controlled remediation</span>
            </footer>
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}


