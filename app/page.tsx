
"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Finding = {
  agent: string;
  observation: string;
  evidence: string[];
  limitations: string[];
};

type Diagnosis = {
  incident_id: string;
  device: string;
  status: string;
  summary: string;
  findings: Finding[];
  missing_evidence: string[];
  recommendations: string[];
  generated_at: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type MetricKey =
  | "latency_ms"
  | "packet_loss_percent"
  | "jitter_ms"
  | "cpu_utilization_percent"
  | "memory_utilization_percent"
  | "interface_errors"
  | "queue_drops";

const metricFields: {
  key: MetricKey;
  label: string;
  unit: string;
}[] = [
  { key: "latency_ms", label: "Latency", unit: "ms" },
  { key: "packet_loss_percent", label: "Packet loss", unit: "%" },
  { key: "jitter_ms", label: "Jitter", unit: "ms" },
  { key: "cpu_utilization_percent", label: "CPU utilization", unit: "%" },
  { key: "memory_utilization_percent", label: "Memory utilization", unit: "%" },
  { key: "interface_errors", label: "Interface errors", unit: "count" },
  { key: "queue_drops", label: "Queue drops", unit: "count" },
];

const navigation = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "diagnosis", label: "Network diagnosis", icon: "⌕" },
  { id: "investigation", label: "Investigation results", icon: "⌘" },
  { id: "agents", label: "AI architecture", icon: "◇" },
  { id: "analyst", label: "AI analyst", icon: "✳" },
];

export default function Home() {
  const [activePage, setActivePage] = useState("overview");

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
  const [diagnosisError, setDiagnosisError] = useState("");

  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [provider, setProvider] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Welcome to NetCoop AI. I can help explain network symptoms and investigate telemetry. Ask me a question to get started.",
    },
  ]);

  const shouldReduceMotion = useReducedMotion();

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
        body: JSON.stringify({
          incident_id: incidentId,
          device,
          metrics: parsedMetrics,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Diagnosis failed.");
      }

      const report = result.investigation?.report;

      if (!report || !Array.isArray(report.findings)) {
        throw new Error(
          "The API response is missing a valid diagnosis report."
        );
      }

      setDiagnosis(report);
      setActivePage("investigation");
    } catch (error) {
      setDiagnosisError(
        error instanceof Error ? error.message : "Unable to run diagnosis."
      );
    } finally {
      setDiagnosing(false);
    }
  }

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = question.trim();
    if (!message || chatLoading) return;

    setChatMessages((previous) => [
      ...previous,
      { role: "user", text: message },
    ]);
    setQuestion("");
    setChatError("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "AI request failed.");
      }

      if (typeof result.answer !== "string") {
        throw new Error("The AI endpoint returned an invalid response.");
      }

      setProvider(result.provider || "Configured provider");
      setChatMessages((previous) => [
        ...previous,
        { role: "assistant", text: result.answer },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to contact AI.";

      setChatError(errorMessage);
      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: `I couldn't complete that request. ${errorMessage}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function navigate(id: string) {
    setActivePage(id);
  }

  const card =
    "rounded-2xl border border-slate-200 bg-white shadow-sm";
  const label = "mb-2 block text-sm font-medium text-slate-700";
  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const button =
    "rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-[#F4F7FC] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-[#101D38] text-white lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-xl font-black">
            N
          </div>
          <div>
            <h1 className="font-bold tracking-wide">NetCoop AI</h1>
            <p className="text-xs text-slate-400">Network intelligence</p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Workspace
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activePage === item.id
                    ? "bg-blue-500/20 font-semibold text-blue-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 p-5">
          <p className="text-xs font-semibold text-blue-300">
            Development environment
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Only connected backend features are shown as functional. No live
            network source is currently assumed.
          </p>
        </div>
      </aside>

      <section className="min-h-screen lg:ml-64">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
              Network operations center
            </p>
            <h2 className="mt-1 text-lg font-bold">
              {navigation.find((item) => item.id === activePage)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Backend interface
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={activePage}
    initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
    className="space-y-7 p-5 md:p-8"
  >
          {activePage === "overview" && (
            <>
              <section>
                <p className="text-sm font-semibold text-blue-600">
                  NETCOOP INTELLIGENCE
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#14213D] md:text-4xl">
                  Understand your network.
                  <span className="block text-blue-600">
                    Investigate with evidence.
                  </span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  A network investigation workspace connecting telemetry,
                  diagnostic agents and AI-powered analysis.
                </p>
              </section>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Diagnosis API", "Connected interface", "Uses /api/diagnose"],
                  ["AI Analyst", "Connected interface", "Uses /api/chat"],
                  ["Live telemetry", "Not connected", "No live source configured"],
                  ["Verified causes", "Not available", "Verification agent pending"],
                ].map(([title, value, detail], index) => (
                  <motion.div
                    key={title}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={shouldReduceMotion ? undefined : { y: -5, scale: 1.015 }}
                    transition={{
                      duration: 0.35,
                      delay: shouldReduceMotion ? 0 : index * 0.08,
                      ease: "easeOut"
                    }}
                    className={`${card} p-5`}
                  >
                    <p className="text-xs font-medium text-slate-500">{title}</p>
                    <p className="mt-3 text-lg font-bold text-[#172B4D]">
                      {value}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{detail}</p>
                  </motion.div>
                ))}
              </div>

              <section className={`${card} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Start an investigation</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Submit actual telemetry values to your diagnosis API.
                    </p>
                  </div>
                  <button
                    className={button}
                    onClick={() => navigate("diagnosis")}
                  >
                    Open diagnosis →
                  </button>
                </div>
              </section>

              <section className={`${card} p-6`}>
                <h3 className="font-bold">Investigation pipeline</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Current implementation and planned components.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Performance Agent", "Implemented", "Latency, loss and jitter"],
                    ["Infrastructure Agent", "Implemented", "CPU, memory and interfaces"],
                    ["Coordinator", "Partial", "Routes current findings"],
                    ["Hypothesis Agent", "Integration pending", "Dynamic LLM hypotheses"],
                    ["Verification Agent", "Pending", "Independent evidence checks"],
                    ["Live telemetry", "Pending", "Real device data integration"],
                  ].map(([name, status, description]) => (
                    <div
                      key={name}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="font-semibold">{name}</p>
                      <p className="mt-2 text-xs text-blue-600">{status}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activePage === "diagnosis" && (
            <section className={`${card} p-5 md:p-7`}>
              <h2 className="text-xl font-bold">Network diagnosis</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter measurements from a real or explicitly identified test
                scenario. Empty fields are treated as missing evidence.
              </p>

              <form onSubmit={runDiagnosis} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Incident ID</label>
                    <input
                      className={input}
                      value={incidentId}
                      onChange={(e) => setIncidentId(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={label}>Device name</label>
                    <input
                      className={input}
                      value={device}
                      onChange={(e) => setDevice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Telemetry measurements</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Use the units displayed beside each field. Leave unknown
                    measurements empty.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {metricFields.map((field) => (
                    <div key={field.key}>
                      <label className={label}>
                        {field.label} ({field.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={
                          field.key.includes("percent")
                            ? 100
                            : undefined
                        }
                        className={input}
                        placeholder="Not provided"
                        value={metrics[field.key]}
                        onChange={(e) =>
                          setMetrics((previous) => ({
                            ...previous,
                            [field.key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                {diagnosisError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {diagnosisError}
                  </div>
                )}

                <button className={button} type="submit" disabled={diagnosing}>
                  {diagnosing ? "Running diagnosis..." : "Run network diagnosis →"}
                </button>
              </form>
            </section>
          )}

          {activePage === "investigation" && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold">Investigation results</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Results returned by the actual diagnosis endpoint.
                </p>
              </div>

              {!diagnosis ? (
                <div className={`${card} p-8 text-center`}>
                  <p className="font-semibold">No investigation report yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Run a diagnosis to see evidence and findings here.
                  </p>
                  <button
                    className={`${button} mt-5`}
                    onClick={() => navigate("diagnosis")}
                  >
                    Start diagnosis
                  </button>
                </div>
              ) : (
                <>
                  <div className={`${card} p-6`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                          {diagnosis.incident_id}
                        </p>
                        <h3 className="mt-2 text-xl font-bold">
                          {diagnosis.device}
                        </h3>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                        {diagnosis.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-slate-600">
                      {diagnosis.summary}
                    </p>
                    <p className="mt-4 text-xs text-slate-400">
                      Generated: {new Date(diagnosis.generated_at).toLocaleString()}
                    </p>
                  </div>

                  <div className={`${card} p-6`}>
                    <h3 className="font-bold">Agent findings</h3>
                    <div className="mt-4 space-y-4">
                      {diagnosis.findings.map((finding, index) => (
                        <motion.div
                          key={`${finding.agent}-${index}`}
                          initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={shouldReduceMotion ? undefined : { x: 4 }}
                          transition={{
                            duration: 0.35,
                            delay: shouldReduceMotion ? 0 : index * 0.12,
                            ease: "easeOut"
                          }}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="font-semibold capitalize">
                            {finding.agent.replaceAll("-", " ")}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {finding.observation}
                          </p>
                          {finding.evidence.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-semibold text-emerald-700">
                                Supporting evidence
                              </p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                {finding.evidence.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {finding.limitations.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-semibold text-amber-700">
                                Limitations
                              </p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                {finding.limitations.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className={`${card} p-6`}>
                    <h3 className="font-bold">Missing evidence</h3>
                    {diagnosis.missing_evidence.length ? (
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                        {diagnosis.missing_evidence.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        No missing evidence was reported by the API.
                      </p>
                    )}
                  </div>

                  <div className={`${card} p-6`}>
                    <h3 className="font-bold">Recommendations</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                      {diagnosis.recommendations.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          )}

          {activePage === "agents" && (
            <section className={`${card} p-6`}>
              <h2 className="text-xl font-bold">Multi-agent architecture</h2>
              <p className="mt-2 text-sm text-slate-500">
                Implementation status, not simulated live activity.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  ["Performance Agent", "Implemented", "Latency, packet loss and jitter"],
                  ["Infrastructure Agent", "Implemented", "CPU, memory and network interfaces"],
                  ["Coordinator", "Partial", "Collects findings through the in-memory message bus"],
                  ["Hypothesis Agent", "Integration pending", "LLM-generated competing explanations"],
                  ["Verification Agent", "Pending", "Independent hypothesis evaluation"],
                  ["Congestion Agent", "Pending", "Additional congestion evidence"],
                  ["Interface Agent", "Pending", "Dedicated interface diagnostics"],
                ].map(([name, status, description]) => (
                  <div
                    key={name}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <p className="font-semibold">{name}</p>
                      <p className="mt-1 text-xs text-slate-500">{description}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activePage === "analyst" && (
            <section className={`${card} p-5 md:p-7`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">NetCoop AI Analyst</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Ask questions about network problems using your configured
                    language model.
                  </p>
                </div>
                {provider && (
                  <span className="rounded-full bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Provider: {provider}
                  </span>
                )}
              </div>

              <div className="my-6 max-h-[480px] space-y-4 overflow-y-auto rounded-xl bg-[#F4F7FC] p-4">
                {chatMessages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`max-w-[90%] rounded-2xl p-4 text-sm leading-7 ${
                      message.role === "user"
                        ? "ml-auto bg-blue-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {message.role === "user" ? "You" : "NetCoop AI"}
                    </p>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </motion.div>
                ))}
                {chatLoading && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500"
                    role="status"
                    aria-label="AI is generating a response"
                  >
                    <span>NetCoop AI is thinking</span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="h-2 w-2 rounded-full bg-blue-500"
                          animate={shouldReduceMotion ? undefined : { y: [0, -5, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: dot * 0.15
                          }}
                        />
                      ))}
                    </span>
                  </motion.div>
                )}
              </div>

              {chatError && (
                <p className="mb-3 text-sm text-rose-600">{chatError}</p>
              )}

              <form onSubmit={sendChat} className="flex flex-col gap-3 sm:flex-row">
                <input
                  className={input}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about latency, packet loss, routing..."
                  disabled={chatLoading}
                />
                <button
                  className={button}
                  type="submit"
                  disabled={chatLoading || !question.trim()}
                >
                  {chatLoading ? "Thinking..." : "Send ↗"}
                </button>
              </form>
              <p className="mt-3 text-xs text-slate-400">
                The analyst explains network concepts. It does not automatically
                access live network devices.
              </p>
            </section>
          )}

          <footer className="border-t border-slate-200 pt-5 text-xs text-slate-400">
            NetCoop AI · Network intelligence platform · Evidence-backed
            investigation · No automatic production remediation
          </footer>
        </motion.div>
        </AnimatePresence>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200 bg-white px-1 py-2 lg:hidden">
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={`flex flex-col items-center gap-1 px-2 py-2 text-[10px] ${
              activePage === item.id
                ? "font-bold text-blue-600"
                : "text-slate-500"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="h-16 lg:hidden" />
    </main>
  );
}
