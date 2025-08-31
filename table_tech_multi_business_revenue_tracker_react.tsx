import React, { useEffect, useMemo, useState } from "react";
// import { useDatabase } from "./src/hooks/useDatabase";

/**********************
 * Table Tech – Multi‑business Revenue Tracker (React, no external UI libs)
 * - Cash vs MRR view
 * - Recurring (monthly/yearly), One‑time, and Variable monthly income
 * - Inline SVG bar chart with month labels + hover tooltip
 * - LocalStorage persistence
 * - Simple editable table + modals
 * - Lightweight runtime tests at the bottom (console.assert)
 **********************/

// ------------------------------
// Types
// ------------------------------

type Cadence = "monthly" | "yearly";

type BillingType = "recurring" | "onetime" | "variable";

type Company = {
  id: string;
  name: string;
};

type VariableMap = Record<string, number>; // YYYY-MM -> amount

type Subscription = {
  id: string;
  companyId: string | null;
  productId: string | null;
  customer: string;
  planName: string;
  price: number; // base price in EUR
  billingType: BillingType;
  cadence: Cadence; // used only when billingType === "recurring"
  startDate: string; // yyyy-mm-dd (for onetime: payment date)
  cancelDate: string | null; // yyyy-mm-dd or null (recurring only)
  variableAmounts?: VariableMap; // when billingType === "variable"
  notes?: string;
};

// ------------------------------
// Utils
// ------------------------------
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const STORAGE_KEY = "income-tracker-data-v6"; // bump key to avoid corrupt caches

function loadState(): { companies: Company[]; subs: Subscription[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/** Currency formatter – USED by chart tooltip and KPIs */
function fmtEUR(n: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function monthKey(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
}

function monthsBetweenInclusive(startYYYYMM: string, endYYYYMM: string) {
  const [sy, sm] = startYYYYMM.split("-").map(Number);
  const [ey, em] = endYYYYMM.split("-").map(Number);
  const cur = new Date(sy, sm - 1, 1);
  const last = new Date(ey, em - 1, 1);
  const out: string[] = [];
  while (cur <= last) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function isActiveInMonth(sub: Subscription, year: number, month: number) {
  if (sub.billingType === "onetime") {
    const mk = `${year}-${String(month).padStart(2, "0")}`;
    return mk === monthKey(sub.startDate);
  }
  if (sub.billingType === "variable") {
    const mk = `${year}-${String(month).padStart(2, "0")}`;
    return !!sub.variableAmounts && sub.variableAmounts[mk] != null;
  }
  const mStart = new Date(year, month - 1, 1);
  const mEnd = new Date(year, month, 0);
  const start = new Date(sub.startDate);
  const cancel = sub.cancelDate ? new Date(sub.cancelDate) : null;
  const activeStart = start <= mEnd;
  const activeEnd = !cancel || cancel >= mStart;
  return activeStart && activeEnd;
}

function billMonthsCash(sub: Subscription, fromYYYYMM: string, toYYYYMM: string) {
  const out = new Set<string>();
  const months = monthsBetweenInclusive(fromYYYYMM, toYYYYMM);

  if (sub.billingType === "onetime") {
    const mk = monthKey(sub.startDate);
    if (months.includes(mk)) out.add(mk);
    return out;
  }

  if (sub.billingType === "variable") {
    for (const mk of months) {
      if (sub.variableAmounts && sub.variableAmounts[mk] != null) out.add(mk);
    }
    return out;
  }

  // Recurring: Monthly -> each active month; Yearly -> only anniversary month
  const start = new Date(sub.startDate);
  const annMonth = start.getMonth() + 1;
  for (const mk of months) {
    const [y, m] = mk.split("-").map(Number);
    if (!isActiveInMonth(sub, y, m)) continue;
    if (sub.cadence === "monthly") out.add(mk);
    else if (m === annMonth) out.add(mk);
  }
  return out;
}

function monthlyMRR(sub: Subscription) {
  if (sub.billingType === "onetime") return 0; // excluded from MRR by default
  if (sub.billingType === "variable") return 0; // default: don't convert variable to MRR
  return sub.cadence === "monthly" ? sub.price : sub.price / 12;
}

function calcSeries(
  subs: Subscription[],
  mode: "cash" | "mrr",
  months: string[]
) {
  const map: Record<string, number> = Object.fromEntries(months.map((k) => [k, 0]));
  for (const sub of subs) {
    if (mode === "cash") {
      if (sub.billingType === "variable") {
        for (const mk of months) {
          const v = sub.variableAmounts?.[mk];
          if (v != null) map[mk] += v;
        }
        continue;
      }
      const cashMonths = billMonthsCash(sub, months[0], months[months.length - 1]);
      for (const mk of cashMonths) map[mk] += sub.price;
    } else {
      if (sub.billingType === "variable") {
        // no MRR impact by default
        continue;
      }
      for (const mk of months) {
        const [y, m] = mk.split("-").map(Number);
        if (isActiveInMonth(sub, y, m)) map[mk] += monthlyMRR(sub);
      }
    }
  }
  // Integer bars for visual cleanliness (keep existing behavior)
  return months.map((mk) => ({ month: mk, amount: Math.round(map[mk]) }));
}

// ------------------------------
// Seed data
// ------------------------------
const seed = {
  companies: [
    { id: uid(), name: "TableTech" },
    { id: uid(), name: "WishWeb" },
    { id: uid(), name: "Carlendify" },
  ] as Company[],
  subs: [
    // recurring monthly
    {
      id: uid(),
      companyId: null,
      productId: null,
      customer: "Cafe de Markt",
      planName: "QR Basic",
      price: 80,
      billingType: "recurring" as BillingType,
      cadence: "monthly" as Cadence,
      startDate: "2025-05-10",
      cancelDate: null,
      notes: "Start in mei",
    },
    // recurring yearly
    {
      id: uid(),
      companyId: null,
      productId: null,
      customer: "Bistro Noord",
      planName: "QR Pro (jaar)",
      price: 900,
      billingType: "recurring" as BillingType,
      cadence: "yearly" as Cadence,
      startDate: "2025-02-21",
      cancelDate: null,
      notes: "Jaar vooruitbetaald",
    },
    // one-time
    {
      id: uid(),
      companyId: null,
      productId: null,
      customer: "Losse factuur",
      planName: "Setup kosten",
      price: 250,
      billingType: "onetime" as BillingType,
      cadence: "monthly" as Cadence, // ignored
      startDate: "2025-06-05",
      cancelDate: null,
      notes: "Eenmalige onboarding",
    },
    // variable example
    {
      id: uid(),
      companyId: null,
      productId: null,
      customer: "App met variabele omzet",
      planName: "Ad revenue",
      price: 0,
      billingType: "variable" as BillingType,
      cadence: "monthly" as Cadence, // ignored
      startDate: "2025-01-01",
      cancelDate: null,
      variableAmounts: {
        "2025-01": 120,
        "2025-02": 260,
        "2025-05": 90,
      },
      notes: "Vul per maand in",
    },
  ] as Subscription[],
};

// ------------------------------
// Simple UI primitives (pure React + Tailwind classes only)
// ------------------------------
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</div>
);

const CardContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", children, ...props }) => (
  <button
    className={`rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition active:scale-[0.98] disabled:opacity-60 bg-zinc-900 text-white hover:bg-zinc-800 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const ButtonOutline: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", children, ...props }) => (
  <button
    className={`rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition active:scale-[0.98] disabled:opacity-60 border border-zinc-300 bg-white hover:bg-zinc-50 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = "", ...props }) => (
  <input
    className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 ${className}`}
    {...props}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = "", children, ...props }) => (
  <select
    className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Badge: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <span
    onClick={onClick}
    className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
  >
    {children}
  </span>
);

const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }> = ({ open, onClose, title, children, className = "" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 w-[min(860px,92vw)] rounded-2xl bg-white p-4 shadow-xl ${className}`}>
        <div className="mb-3 text-lg font-semibold">{title}</div>
        {children}
      </div>
    </div>
  );
};

// Minimal inline icons (avoid external libs)
const IconWallet = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}><path d="M3 7h14a4 4 0 1 1 0 8H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M17 9h2a2 2 0 1 1 0 4h-2V9z" stroke="currentColor" strokeWidth="2"/></svg>
);
const IconTrend = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}><path d="M3 17l6-6 4 4 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const IconPlus = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);
const IconCalendar = (props: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 10h18" stroke="currentColor" strokeWidth="2"/><path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2"/></svg>
);

// ------------------------------
// Chart with labels + hover tooltip
// ------------------------------
const MiniBarChartLabeled: React.FC<{ data: { month: string; amount: number }[] }> = ({ data }) => {
  const width = 800;
  const height = 260;
  const pad = 36;
  const max = Math.max(1, ...data.map((d) => d.amount));
  const step = (width - pad * 2) / data.length;
  const barW = Math.max(6, step * 0.6);

  const MONTHS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const monthLabel = (mk: string) => {
    const m = Number(mk.slice(5)) - 1;
    return MONTHS_NL[m] ?? mk;
  };

  const [tip, setTip] = React.useState<null | { x: number; y: number; text: string }>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent, text: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: e.clientX - rect.left + 8, y: e.clientY - rect.top - 28, text });
  };

  return (
    <div className="relative w-full h-64" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 w-full h-full">
        <rect x={0} y={0} width={width} height={height} fill="white" />
        {/* grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={pad} x2={width - pad} y1={pad + (height - pad * 2) * p} y2={pad + (height - pad * 2) * p} stroke="#e5e7eb" />
        ))}
        {data.map((d, i) => {
          const x = pad + i * step + (step - barW) / 2;
          const h = (d.amount / max) * (height - pad * 2);
          const y = height - pad - h;
          const label = `${monthLabel(d.month)} ${d.month.slice(0, 4)} — ${fmtEUR(d.amount)}`;
          return (
            <g
              key={d.month}
              onMouseEnter={(e) => handleMove(e, label)}
              onMouseMove={(e) => handleMove(e, label)}
              onMouseLeave={() => setTip(null)}
            >
              <rect x={x} y={y} width={barW} height={h} fill="#f5d38b" rx={4} />
              <text x={x + barW / 2} y={height - pad + 16} textAnchor="middle" fontSize="12" fill="#71717a">
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#d4d4d8" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#d4d4d8" />
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-md"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
};

// ------------------------------
// App Component
// ------------------------------
export default function App() {
  // const db = useDatabase();
  const [state, setState] = useState(() => loadState() || seed);
  const [mode, setMode] = useState<"cash" | "mrr">("cash");
  const [year, setYear] = useState(new Date().getFullYear());
  const [companyFilter, setCompanyFilter] = useState<string>("");

  useEffect(() => saveState(state), [state]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`), [year]);
  const subsFiltered = useMemo(
    () => state.subs.filter((s: Subscription) => !companyFilter || s.companyId === companyFilter),
    [state.subs, companyFilter]
  );
  const series = useMemo(() => calcSeries(state.subs, mode, months), [state.subs, mode, months]);

  const totalYear = useMemo(() => series.reduce((s, x) => s + x.amount, 0), [series]);
  const currentMonthKey = monthKey(new Date());
  const currentAmount = series.find((x) => x.month === currentMonthKey)?.amount || 0;
  const mrrNow = useMemo(() => calcSeries(state.subs, "mrr", [currentMonthKey])[0].amount, [state.subs, currentMonthKey]);

  // Form state
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [variableEditId, setVariableEditId] = useState<string | null>(null);
  const [variableYear, setVariableYear] = useState(year);

  const [newCompany, setNewCompany] = useState("");

  const [form, setForm] = useState({
    billingType: "recurring" as BillingType,
    companyId: "",
    customer: "",
    planName: "",
    price: "",
    cadence: "monthly" as Cadence,
    startDate: new Date().toISOString().slice(0, 10),
    cancelDate: "",
    notes: "",
  });
  const canSave = form.customer && form.planName && form.price !== "" && form.startDate;

  function addCompany(name: string) {
    const c: Company = { id: uid(), name };
    setState((prev: any) => ({ ...prev, companies: [...prev.companies, c] }));
  }

  function addItem() {
    const payload: Subscription = {
      id: uid(),
      companyId: form.companyId || null,
      productId: null,
      customer: form.customer.trim(),
      planName: form.planName.trim(),
      price: Number(form.price || 0),
      billingType: form.billingType,
      cadence: form.cadence,
      startDate: form.startDate,
      cancelDate: form.billingType === "recurring" ? (form.cancelDate || null) : null,
      notes: form.notes.trim(),
      variableAmounts: form.billingType === "variable" ? {} : undefined,
    };
    setState((prev: any) => ({ ...prev, subs: [payload, ...prev.subs] }));
  }

  function updateSub(id: string, patch: Partial<Subscription>) {
    setState((prev: any) => ({ ...prev, subs: prev.subs.map((s: Subscription) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  function updateVariableAmount(id: string, mk: string, value: number) {
    setState((prev: any) => ({
      ...prev,
      subs: prev.subs.map((s: Subscription) => {
        if (s.id !== id) return s;
        const next = { ...(s.variableAmounts || {}) } as VariableMap;
        if (Number.isFinite(value) && value !== 0) next[mk] = value; else delete next[mk];
        return { ...s, variableAmounts: next };
      })
    }));
  }

  function removeSub(id: string) {
    setState((prev: any) => ({ ...prev, subs: prev.subs.filter((s: Subscription) => s.id !== id) }));
  }

  const editingSub: Subscription | null = useMemo(
    () => state.subs.find((s: Subscription) => s.id === variableEditId) || null,
    [state.subs, variableEditId]
  );
  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${variableYear}-${String(i + 1).padStart(2, "0")}`),
    [variableYear]
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-white text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revenue Tracker</h1>
            <p className="text-sm text-zinc-600">Handmatig inkomsten bijhouden per bedrijf en item (abonnement, eenmalig of variabel).</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Badge active={mode === "cash"} onClick={() => setMode("cash")}>Cash</Badge>
              <Badge active={mode === "mrr"} onClick={() => setMode("mrr")}>MRR</Badge>
            </div>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">Alle bedrijven</option>
              {state.companies.map((c: Company) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Button onClick={() => setShowItemModal(true)} className="flex items-center gap-2"><IconPlus />
              <span>Nieuw item</span>
            </Button>
            <ButtonOutline onClick={() => setShowCompanyModal(true)} className="flex items-center gap-2"><IconPlus />
              <span>Nieuw bedrijf</span>
            </ButtonOutline>
          </div>
        </header>

        {/* KPIs */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">{mode === "cash" ? "Inkomen deze maand (cash)" : "MRR (huidige maand)"}</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtEUR(mode === "cash" ? currentAmount : mrrNow)}</p>
                </div>
                <IconWallet className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">Totaal {year} ({mode.toUpperCase()})</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtEUR(totalYear)}</p>
                </div>
                <IconTrend className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">Actieve items</p>
                  <p className="mt-1 text-2xl font-semibold">{state.subs.length}</p>
                </div>
                <IconPlus className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Chart */}
        <Card className="mb-6">
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{mode === "cash" ? "Maandelijkse inkomsten (cash)" : "Maandelijkse terugkerende omzet (MRR)"}</h2>
              <span className="text-sm text-zinc-600">{year}</span>
            </div>
            <MiniBarChartLabeled data={series} />
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Items (abonnementen, eenmalig, variabel)</h2>
              <p className="text-sm text-zinc-600">Klik op velden om te bewerken. Verwijder met de X. Voor variabel: bewerk per maand.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-600">
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Bedrijf</th>
                    <th className="px-2 py-2">Klant</th>
                    <th className="px-2 py-2">Plan</th>
                    <th className="px-2 py-2">Frequentie</th>
                    <th className="px-2 py-2">Prijs</th>
                    <th className="px-2 py-2">Datum / Start</th>
                    <th className="px-2 py-2">Eind</th>
                    <th className="px-2 py-2">Notities</th>
                    <th className="px-2 py-2">Variabel</th>
                    <th className="px-2 py-2">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {subsFiltered.map((s: Subscription) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-2">
                        <Select value={s.billingType} onChange={(e) => updateSub(s.id, { billingType: e.target.value as BillingType })}>
                          <option value="recurring">Abonnement</option>
                          <option value="onetime">Eenmalig</option>
                          <option value="variable">Variabel</option>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Select value={s.companyId || ""} onChange={(e) => updateSub(s.id, { companyId: e.target.value || null })}>
                          <option value="">-</option>
                          {state.companies.map((c: Company) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-2"><Input value={s.customer} onChange={(e) => updateSub(s.id, { customer: e.target.value })} /></td>
                      <td className="px-2 py-2"><Input value={s.planName} onChange={(e) => updateSub(s.id, { planName: e.target.value })} /></td>
                      <td className="px-2 py-2">
                        {s.billingType === "recurring" ? (
                          <Select value={s.cadence} onChange={(e) => updateSub(s.id, { cadence: e.target.value as Cadence })}>
                            <option value="monthly">Maandelijks</option>
                            <option value="yearly">Jaarlijks</option>
                          </Select>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 w-[120px]"><Input type="number" value={String(s.price)} onChange={(e) => updateSub(s.id, { price: Number(e.target.value || 0) })} /></td>
                      <td className="px-2 py-2"><Input type="date" value={s.startDate} onChange={(e) => updateSub(s.id, { startDate: e.target.value })} /></td>
                      <td className="px-2 py-2">
                        {s.billingType === "recurring" ? (
                          <Input type="date" value={s.cancelDate || ""} onChange={(e) => updateSub(s.id, { cancelDate: e.target.value || null })} />
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2"><Input value={s.notes || ""} onChange={(e) => updateSub(s.id, { notes: e.target.value })} /></td>
                      <td className="px-2 py-2">
                        {s.billingType === "variable" ? (
                          <ButtonOutline onClick={() => { setVariableEditId(s.id); setVariableYear(year); setShowVariableModal(true); }}>Bewerk maanden…</ButtonOutline>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2"><ButtonOutline onClick={() => removeSub(s.id)}>X</ButtonOutline></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-xs text-zinc-600">
          <p>
            Tip: Eenmalig telt alleen mee in Cash (in de betaalmaand). Variabel kun je per maand invullen (Cash). Wil je variabel óók middelen naar MRR? Laat het weten — dan voeg ik een toggle toe.
          </p>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title="Nieuw item toevoegen">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-600">Type</label>
            <Select value={form.billingType} onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value as BillingType }))}>
              <option value="recurring">Abonnement</option>
              <option value="onetime">Eenmalig</option>
              <option value="variable">Variabel</option>
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-600">Bedrijf</label>
            <Select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}>
              <option value="">-</option>
              {state.companies.map((c: Company) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-600">Klantnaam</label>
            <Input value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} placeholder="Cafe de Markt" />
          </div>
          <div>
            <label className="text-xs text-zinc-600">Plan / omschrijving</label>
            <Input value={form.planName} onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))} placeholder="QR Basic / Setup kosten / Ad revenue" />
          </div>
          <div>
            <label className="text-xs text-zinc-600">Prijs (EUR)</label>
            <Input type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            <p className="mt-1 text-[10px] text-zinc-500">Bij variabel vul je bedragen per maand in na opslaan.</p>
          </div>
          {form.billingType === "recurring" && (
            <div>
              <label className="text-xs text-zinc-600">Betalingsfrequentie</label>
              <Select value={form.cadence} onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}>
                <option value="monthly">Maandelijks</option>
                <option value="yearly">Jaarlijks</option>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-600">{form.billingType === "onetime" ? "Betaaldatum" : "Startdatum"}</label>
            <div className="flex items-center gap-2">
              <IconCalendar />
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
          </div>
          {form.billingType === "recurring" && (
            <div>
              <label className="text-xs text-zinc-600">Einddatum (optioneel)</label>
              <Input type="date" value={form.cancelDate} onChange={(e) => setForm((f) => ({ ...f, cancelDate: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-600">Notities</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Korting eerste maand of extra info" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <ButtonOutline onClick={() => setShowItemModal(false)}>Sluiten</ButtonOutline>
          <Button disabled={!canSave} onClick={() => { addItem(); setShowItemModal(false); }}>Opslaan</Button>
        </div>
      </Modal>

      {/* Add Company Modal */}
      <Modal open={showCompanyModal} onClose={() => setShowCompanyModal(false)} title="Bedrijf toevoegen">
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-zinc-600">Naam</label>
            <Input placeholder="TableTech" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { if (newCompany.trim()) addCompany(newCompany.trim()); setNewCompany(""); setShowCompanyModal(false); }}>Opslaan</Button>
            <ButtonOutline onClick={() => setShowCompanyModal(false)}>Annuleren</ButtonOutline>
          </div>
        </div>
      </Modal>

      {/* Variable Months Modal */}
      <Modal open={showVariableModal} onClose={() => setShowVariableModal(false)} title={`Variabele bedragen bewerken (${variableYear})`}>
        {editingSub && (
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Jaar</span>
              <Select value={String(variableYear)} onChange={(e) => setVariableYear(Number(e.target.value))}>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {yearMonths.map((mk) => (
                <div key={mk} className="rounded-xl border border-zinc-200 p-3">
                  <div className="mb-1 text-xs text-zinc-600">{mk}</div>
                  <Input
                    type="number"
                    min={0}
                    value={String(editingSub.variableAmounts?.[mk] ?? "")}
                    onChange={(e) => updateVariableAmount(editingSub.id, mk, Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <ButtonOutline onClick={() => setShowVariableModal(false)}>Klaar</ButtonOutline>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/**********************
 * Lightweight Runtime Tests (console.assert)
 **********************/
(function runLightTests() {
  try {
    const y = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);

    // --- Test: fmtEUR exists and returns a string
    console.assert(typeof fmtEUR === "function" && typeof fmtEUR(1) === "string", "fmtEUR should be defined and return a string");

    // monthly sub active all year
    const m: Subscription = {
      id: "t1", companyId: null, productId: null, customer: "A", planName: "M", price: 100, billingType: "recurring", cadence: "monthly", startDate: `${y}-01-01`, cancelDate: null
    };
    const s1 = calcSeries([m], "cash", months);
    console.assert(s1.reduce((a, b) => a + b.amount, 0) === 1200, "Monthly cash sum should be 1200");

    // yearly sub starting March (cash only in March)
    const ysub: Subscription = {
      id: "t2", companyId: null, productId: null, customer: "B", planName: "Y", price: 1200, billingType: "recurring", cadence: "yearly", startDate: `${y}-03-15`, cancelDate: null
    };
    const s2 = calcSeries([ysub], "cash", months);
    const march = s2.find((d) => d.month.endsWith("-03"))?.amount || 0;
    const other = s2.filter((d) => !d.month.endsWith("-03")).reduce((a, b) => a + b.amount, 0);
    console.assert(march === 1200 && other === 0, "Yearly cash should hit in March only");

    // MRR split produces integers (current behavior)
    const s3 = calcSeries([ysub], "mrr", months);
    console.assert(s3.every((d) => Number.isInteger(d.amount)), "MRR amounts are rounded to integers");

    // Cancel: no cash after cancel month window
    const csub: Subscription = {
      id: "t3", companyId: null, productId: null, customer: "C", planName: "C", price: 120, billingType: "recurring", cadence: "monthly", startDate: `${y}-01-01`, cancelDate: `${y}-06-10`
    };
    const s4 = calcSeries([csub], "cash", months);
    const afterJune = s4.filter((d) => Number(d.month.slice(-2)) > 6).reduce((a, b) => a + b.amount, 0);
    console.assert(afterJune === 0, "Cancelled sub should not produce cash after cancel month window");

    // One‑time: cash in the payment month only; MRR zero
    const one: Subscription = {
      id: "t5", companyId: null, productId: null, customer: "D", planName: "Setup", price: 250, billingType: "onetime", cadence: "monthly", startDate: `${y}-05-10`, cancelDate: null
    };
    const s5 = calcSeries([one], "cash", months);
    const may = s5.find((d) => d.month.endsWith("-05"))?.amount || 0;
    const others = s5.filter((d) => !d.month.endsWith("-05")).reduce((a, b) => a + b.amount, 0);
    console.assert(may === 250 && others === 0, "Onetime cash should land only in payment month");
    const s6 = calcSeries([one], "mrr", months);
    console.assert(s6.reduce((a, b) => a + b.amount, 0) === 0, "Onetime should not contribute to MRR by default");

    // Variable: amounts only where provided; MRR zero
    const v: Subscription = {
      id: "t6", companyId: null, productId: null, customer: "E", planName: "Var", price: 0, billingType: "variable", cadence: "monthly", startDate: `${y}-01-01`, cancelDate: null,
      variableAmounts: { [`${y}-01`]: 100, [`${y}-03`]: 300 }
    };
    const s7 = calcSeries([v], "cash", months);
    const sumVar = s7.reduce((a, b) => a + b.amount, 0);
    console.assert(sumVar === 400, "Variable cash sum should equal filled months total");
    const s8 = calcSeries([v], "mrr", months);
    console.assert(s8.reduce((a, b) => a + b.amount, 0) === 0, "Variable default has no MRR");

    // fmtEUR formatting check on a few values (non-throwing)
    console.assert(fmtEUR(0).includes("€"), "fmtEUR should include euro sign");
  } catch (err) {
    // console.error("Runtime tests failed", err);
  }
})();
