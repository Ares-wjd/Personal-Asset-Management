import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Upload, Plus, Trash2, TrendingUp, Settings, PieChart as PieChartIcon, Target, Wallet, BarChart2, RefreshCw, AlertTriangle, Save } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, LineChart, Line, CartesianGrid, Legend } from "recharts";

/**
 * ASSET MANAGEMENT PORTFOLIO — React Single-File MVP
 * Features
 * - Dashboard: Net worth, asset mix, recent activity, alerts
 * - Assets: CRUD by account (cash, brokerage, crypto, real estate, etc.)
 * - Transactions: deposits/withdrawals/buys/sells with fees & tax; running balances
 * - Goals: target amount/date, progress, funding gap suggestion
 * - Allocation: target vs actual, rebalancing suggestions
 * - Reports: net-worth timeline, income/expense, realized P/L (basic)
 * - Settings: currency, FX rates, risk preference, data import/export
 * - Persistence: localStorage (JSON import/export)
 * - KRW-centric with optional USD via manual FX
 */

// ---------- Types ----------
const CURRENCIES = ["KRW", "USD"] as const;
const ASSET_TYPES = [
  "Cash",
  "Stock",
  "ETF",
  "Bond",
  "Crypto",
  "Real Estate",
  "Other",
] as const;
const TX_TYPES = ["Deposit", "Withdraw", "Buy", "Sell", "Income", "Expense"] as const;

// ---------- Helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

function krw(n: number) {
  return n.toLocaleString("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
}
function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function sum(arr: number[]) { return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0); }

function deepClone(v: any) { return JSON.parse(JSON.stringify(v)); }

function ensureNumber(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// ---------- Storage ----------
const STORAGE_KEY = "asset-portfolio-mvp-v1";

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveState(state: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Seed Data ----------
const seed = {
  settings: {
    baseCurrency: "KRW" as typeof CURRENCIES[number],
    usdKrw: 1350,
    riskProfile: "Neutral" as "Conservative" | "Neutral" | "Aggressive",
    showAdvanced: true,
  },
  accounts: [
    { id: uid(), name: "입출금통장", type: "Cash", currency: "KRW", openingBalance: 2_000_000 },
    { id: uid(), name: "증권사-국내", type: "Stock", currency: "KRW", openingBalance: 10_000_000 },
    { id: uid(), name: "증권사-해외", type: "ETF", currency: "USD", openingBalance: 5_000 },
    { id: uid(), name: "코인거래소", type: "Crypto", currency: "KRW", openingBalance: 1_000_000 },
  ],
  transactions: [
    // type: Deposit/Withdraw/Buy/Sell/Income/Expense
    { id: uid(), date: todayISO(), accountId: "", type: "Deposit", amount: 1_000_000, fee: 0, tax: 0, note: "시드 추가" },
  ] as any[],
  positions: [
    // Simple live positions (manual mark-to-market; price tracked via manual updates)
    { id: uid(), accountId: "", symbol: "005930.KS", name: "삼성전자", assetType: "Stock", qty: 20, avgPrice: 70000, currency: "KRW", lastPrice: 81000 },
    { id: uid(), accountId: "", symbol: "VOO", name: "Vanguard S&P500", assetType: "ETF", qty: 5, avgPrice: 400, currency: "USD", lastPrice: 530 },
  ],
  goals: [
    { id: uid(), name: "비상금", target: 3_000_000, deadline: "2026-06-30", accountIds: [], note: "생활비 3~6개월치" },
    { id: uid(), name: "대학 등록금", target: 10_000_000, deadline: "2026-02-28", accountIds: [], note: "등록금 준비" },
  ],
  targets: {
    allocation: {
      Cash: 20,
      Stock: 45,
      ETF: 15,
      Bond: 10,
      Crypto: 5,
      "Real Estate": 5,
      Other: 0,
    } as Record<(typeof ASSET_TYPES)[number], number>,
    driftThreshold: 5, // % deviation that triggers rebalance alert
  },
};

// Backfill dynamic ids from seed
seed.transactions[0].accountId = seed.accounts[0].id;
seed.positions[0].accountId = seed.accounts[1].id;
seed.positions[1].accountId = seed.accounts[2].id;

// ---------- Core Component ----------
export default function AssetPortfolioApp() {
  const [state, setState] = useState(() => loadState() ?? seed);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => { saveState(state); }, [state]);

  // ---------- Derived Data ----------
  const fx = useMemo(() => ({ USD_KRW: ensureNumber(state.settings.usdKrw, 1350) }), [state.settings.usdKrw]);

  const accountsById = useMemo(() => Object.fromEntries(state.accounts.map((a: any) => [a.id, a])), [state.accounts]);

  function toBase(amount: number, currency: string) {
    if (state.settings.baseCurrency === currency) return amount;
    if (currency === "USD" && state.settings.baseCurrency === "KRW") return amount * fx.USD_KRW;
    if (currency === "KRW" && state.settings.baseCurrency === "USD") return amount / fx.USD_KRW;
    return amount;
  }

  // Accounts balances = opening + deposits - withdraw ± income/expense + manual cash from sells/buys (net)
  const cashFlows = useMemo(() => {
    const flows: Record<string, number> = {};
    for (const a of state.accounts) flows[a.id] = ensureNumber(a.openingBalance);
    for (const t of state.transactions) {
      const s = Math.sign(1);
      const amt = ensureNumber(t.amount) - ensureNumber(t.fee) - ensureNumber(t.tax);
      if (!flows[t.accountId]) flows[t.accountId] = 0;
      if (t.type === "Deposit" || t.type === "Income" || t.type === "Sell") flows[t.accountId] += amt * s;
      if (t.type === "Withdraw" || t.type === "Expense" || t.type === "Buy") flows[t.accountId] -= amt * s;
    }
    return flows;
  }, [state.transactions, state.accounts]);

  const accountBalances = useMemo(() => {
    return state.accounts.map((a: any) => ({
      ...a,
      balance: ensureNumber(cashFlows[a.id]),
      balanceBase: toBase(ensureNumber(cashFlows[a.id]), a.currency),
    }));
  }, [cashFlows, state.accounts]);

  // Position market values
  const positionsMV = useMemo(() => state.positions.map((p: any) => ({
    ...p,
    marketValue: ensureNumber(p.qty) * ensureNumber(p.lastPrice),
    marketValueBase: toBase(ensureNumber(p.qty) * ensureNumber(p.lastPrice), p.currency),
    pnl: (ensureNumber(p.lastPrice) - ensureNumber(p.avgPrice)) * ensureNumber(p.qty),
    pnlPct: (ensureNumber(p.lastPrice) / ensureNumber(p.avgPrice) - 1) * 100,
  })), [state.positions]);

  // Totals by asset type (accounts cash counted as Cash type of that account)
  const totalsByType = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const a of accountBalances) {
      const t = a.type;
      totals[t] = (totals[t] ?? 0) + a.balanceBase;
    }
    for (const p of positionsMV) {
      const t = p.assetType;
      totals[t] = (totals[t] ?? 0) + p.marketValueBase;
    }
    return totals;
  }, [accountBalances, positionsMV]);

  const totalAssetsBase = useMemo(() => sum(Object.values(totalsByType)), [totalsByType]);

  const allocationActual = useMemo(() => {
    const obj: Record<string, number> = {};
    for (const t of ASSET_TYPES) {
      const v = totalsByType[t] ?? 0;
      obj[t] = totalAssetsBase > 0 ? (v / totalAssetsBase) * 100 : 0;
    }
    return obj;
  }, [totalsByType, totalAssetsBase]);

  const drift = useMemo(() => {
    const out: { type: string; target: number; actual: number; diff: number }[] = [];
    for (const t of ASSET_TYPES) {
      const target = state.targets.allocation[t] ?? 0;
      const actual = allocationActual[t] ?? 0;
      out.push({ type: t, target, actual, diff: (actual - target) });
    }
    return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [state.targets, allocationActual]);

  const rebalanceAlerts = drift.filter(d => Math.abs(d.diff) >= (state.targets.driftThreshold ?? 5));

  // Net worth series (by month) from transactions + positions snapshot today
  const netWorthSeries = useMemo(() => {
    // Build monthly buckets from earliest transaction year
    const txs = deepClone(state.transactions).sort((a: any, b: any) => a.date.localeCompare(b.date));
    if (txs.length === 0) return [] as any[];
    const start = new Date(txs[0].date);
    const end = new Date();
    const months: string[] = [];
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
      d.setMonth(d.getMonth() + 1);
    }
    // Approximate cash balances cumulatively; positions valued at lastPrice on last month only (simplified)
    let cashBase = 0;
    const monthly: Record<string, number> = {};
    for (const m of months) monthly[m] = 0;
    for (const a of state.accounts) cashBase += toBase(ensureNumber(a.openingBalance), a.currency);
    for (const t of txs) {
      const m = t.date.slice(0, 7);
      let delta = 0;
      const amt = ensureNumber(t.amount) - ensureNumber(t.fee) - ensureNumber(t.tax);
      const acc = accountsById[t.accountId];
      const baseAmt = toBase(amt, acc?.currency ?? state.settings.baseCurrency);
      if (["Deposit","Income","Sell"].includes(t.type)) delta = baseAmt;
      if (["Withdraw","Expense","Buy"].includes(t.type)) delta = -baseAmt;
      monthly[m] = (monthly[m] ?? 0) + delta;
    }
    let running = cashBase;
    const data: any[] = [];
    for (const m of months) {
      running += monthly[m] ?? 0;
      data.push({ month: m, cash: running });
    }
    const positionsBase = sum(positionsMV.map(p => p.marketValueBase));
    if (data.length) data[data.length - 1].cash += positionsBase; // approximate snapshot
    return data;
  }, [state.transactions, state.accounts, positionsMV, accountsById, state.settings.baseCurrency]);

  // ---------- Mutators ----------
  function addAccount(payload: any) {
    setState((s: any) => ({ ...s, accounts: [...s.accounts, { id: uid(), ...payload }] }));
  }
  function removeAccount(id: string) {
    setState((s: any) => ({
      ...s,
      accounts: s.accounts.filter((a: any) => a.id !== id),
      transactions: s.transactions.filter((t: any) => t.accountId !== id),
      positions: s.positions.filter((p: any) => p.accountId !== id),
    }));
  }
  function addTransaction(payload: any) {
    setState((s: any) => ({ ...s, transactions: [...s.transactions, { id: uid(), ...payload }] }));
  }
  function removeTransaction(id: string) {
    setState((s: any) => ({ ...s, transactions: s.transactions.filter((t: any) => t.id !== id) }));
  }
  function addPosition(payload: any) {
    setState((s: any) => ({ ...s, positions: [...s.positions, { id: uid(), ...payload }] }));
  }
  function updatePosition(id: string, patch: any) {
    setState((s: any) => ({ ...s, positions: s.positions.map((p: any) => p.id === id ? { ...p, ...patch } : p) }));
  }
  function removePosition(id: string) {
    setState((s: any) => ({ ...s, positions: s.positions.filter((p: any) => p.id !== id) }));
  }
  function addGoal(payload: any) {
    setState((s: any) => ({ ...s, goals: [...s.goals, { id: uid(), ...payload }] }));
  }
  function removeGoal(id: string) {
    setState((s: any) => ({ ...s, goals: s.goals.filter((g: any) => g.id !== id) }));
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `asset-portfolio-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result));
        setState(next);
      } catch (e) {
        alert("JSON 파싱 실패: 파일 형식을 확인하세요.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- UI Subcomponents ----------
  function Stat({ title, value, sub }: any) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </CardContent>
      </Card>
    );
  }

  function SectionTitle({ icon: Icon, title, actions }: any) {
    return (
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5" />}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    );
  }

  // ---------- Forms (Dialogs) ----------
  function AddAccountDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", type: "Cash", currency: state.settings.baseCurrency, openingBalance: 0 });
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm"><Plus className="w-4 h-4 mr-1"/>계좌 추가</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>계좌 추가</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>계좌명</Label>
              <Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="예: 토스뱅크 입출금" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>유형</Label>
                <Select value={form.type} onValueChange={v=>setForm({...form, type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>통화</Label>
                <Select value={form.currency} onValueChange={v=>setForm({...form, currency:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>개시 잔액</Label>
                <Input type="number" value={form.openingBalance} onChange={e=>setForm({...form, openingBalance:Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={()=>{ addAccount(form); setOpen(false); }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function AddTxDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<any>({ date: todayISO(), accountId: state.accounts[0]?.id, type: "Deposit", amount: 0, fee: 0, tax: 0, note: "" });
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="w-4 h-4 mr-1"/>거래 추가</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader><DialogTitle>거래 추가</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>날짜</Label>
                <Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
              </div>
              <div>
                <Label>계좌</Label>
                <Select value={form.accountId} onValueChange={v=>setForm({...form, accountId:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.accounts.map((a:any)=> <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>유형</Label>
                <Select value={form.type} onValueChange={v=>setForm({...form, type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TX_TYPES.map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>금액</Label>
                <Input type="number" value={form.amount} onChange={e=>setForm({...form, amount:Number(e.target.value)})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>수수료</Label>
                <Input type="number" value={form.fee} onChange={e=>setForm({...form, fee:Number(e.target.value)})} />
              </div>
              <div>
                <Label>세금</Label>
                <Input type="number" value={form.tax} onChange={e=>setForm({...form, tax:Number(e.target.value)})} />
              </div>
              <div>
                <Label>비고</Label>
                <Input value={form.note} onChange={e=>setForm({...form, note:e.target.value})} placeholder="메모" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={()=>{ addTransaction(form); setOpen(false); }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function AddPositionDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<any>({ accountId: state.accounts.find((a:any)=>a.type!=="Cash")?.id, symbol: "", name: "", assetType: "Stock", qty: 0, avgPrice: 0, lastPrice: 0, currency: state.settings.baseCurrency });
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm"><Plus className="w-4 h-4 mr-1"/>포지션 추가</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>포지션 추가</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>계좌</Label>
                <Select value={form.accountId} onValueChange={v=>setForm({...form, accountId:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.accounts.map((a:any)=> <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>유형</Label>
                <Select value={form.assetType} onValueChange={v=>setForm({...form, assetType:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>통화</Label>
                <Select value={form.currency} onValueChange={v=>setForm({...form, currency:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>종목코드</Label>
                <Input value={form.symbol} onChange={e=>setForm({...form, symbol:e.target.value})} placeholder="예: 005930.KS / VOO" />
              </div>
              <div>
                <Label>종목명</Label>
                <Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="예: 삼성전자" />
              </div>
              <div>
                <Label>수량</Label>
                <Input type="number" value={form.qty} onChange={e=>setForm({...form, qty:Number(e.target.value)})} />
              </div>
              <div>
                <Label>평단가</Label>
                <Input type="number" value={form.avgPrice} onChange={e=>setForm({...form, avgPrice:Number(e.target.value)})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>현재가</Label>
                <Input type="number" value={form.lastPrice} onChange={e=>setForm({...form, lastPrice:Number(e.target.value)})} />
              </div>
              <div>
                <Label>비고</Label>
                <Input placeholder="메모 (선택)" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={()=>{ addPosition(form); setOpen(false); }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------- Views ----------
  function DashboardView() {
    const base = state.settings.baseCurrency;
    const fmt = base === "KRW" ? krw : usd;
    const allocationData = ASSET_TYPES.map(t => ({ name: t, value: Math.max(0, totalsByType[t] ?? 0) })).filter(d=>d.value>0);
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Stat title="총 자산" value={fmt(totalAssetsBase)} sub={`기준 통화: ${base}`} />
          <Stat title="계좌 수" value={state.accounts.length} />
          <Stat title="보유 포지션" value={state.positions.length} />
          <Stat title="미해결 리밸런싱" value={rebalanceAlerts.length} />
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <SectionTitle icon={PieChartIcon} title="자산 구성" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3 shadow-sm">
            <CardContent className="p-4">
              <SectionTitle icon={BarChart2} title="순자산 추이 (월)" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={netWorthSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RTooltip />
                    <Line type="monotone" dataKey="cash" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm">
            <CardContent className="p-4">
              <SectionTitle icon={AlertTriangle} title="리밸런싱 경고" />
              {rebalanceAlerts.length === 0 ? (
                <div className="text-sm text-muted-foreground">임계치 내에서 잘 유지되고 있어요.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {rebalanceAlerts.map((d, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span>{d.type}: 목표 {d.target.toFixed(1)}% → 실제 {d.actual.toFixed(1)}% (<b className={Math.sign(d.diff)>0?"text-red-600":"text-blue-600"}>{d.diff>0?"+":""}{d.diff.toFixed(1)}%</b>)</span>
                      <Button size="xs" variant="outline" onClick={()=>setActiveTab("allocation")}>조정</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function AccountsView() {
    const base = state.settings.baseCurrency;
    const fmt = base === "KRW" ? krw : usd;
    return (
      <div className="grid gap-3">
        <SectionTitle icon={Wallet} title="계좌 및 잔액">
        </SectionTitle>
        <div className="flex gap-2 mb-1"><AddAccountDialog/><AddTxDialog/></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {accountBalances.map((a: any) => (
            <Card key={a.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{a.type} · {a.currency}</div>
                    <div className="text-lg font-semibold">{a.name}</div>
                  </div>
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={()=>removeAccount(a.id)}><Trash2 className="w-4 h-4"/></Button>
                  </TooltipTrigger><TooltipContent>계좌 삭제</TooltipContent></Tooltip></TooltipProvider>
                </div>
                <div className="mt-2 text-2xl">{fmt(a.balanceBase)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <SectionTitle icon={TrendingUp} title="보유 포지션" actions={<AddPositionDialog/>} />
        <ScrollArea className="w-full whitespace-nowrap">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">계좌</th>
                <th className="p-2">종목</th>
                <th className="p-2">유형</th>
                <th className="p-2">수량</th>
                <th className="p-2">평단가</th>
                <th className="p-2">현재가</th>
                <th className="p-2">평가손익</th>
                <th className="p-2">조치</th>
              </tr>
            </thead>
            <tbody>
              {positionsMV.map((p:any)=> (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{accountsById[p.accountId]?.name ?? "-"}</td>
                  <td className="p-2">{p.name} <span className="text-xs text-muted-foreground">({p.symbol})</span></td>
                  <td className="p-2">{p.assetType}</td>
                  <td className="p-2">{p.qty}</td>
                  <td className="p-2">{p.currency === "KRW" ? krw(p.avgPrice) : usd(p.avgPrice)}</td>
                  <td className="p-2">{p.currency === "KRW" ? krw(p.lastPrice) : usd(p.lastPrice)}</td>
                  <td className="p-2">{p.currency === "KRW" ? krw(p.pnl) : usd(p.pnl)} <span className={p.pnl>=0?"text-green-600":"text-red-600"}>({p.pnlPct.toFixed(2)}%)</span></td>
                  <td className="p-2 flex gap-2">
                    <Button variant="outline" size="xs" onClick={()=>updatePosition(p.id, { lastPrice: Number(prompt("현재가", String(p.lastPrice)) ?? p.lastPrice) })}>가격수정</Button>
                    <Button variant="ghost" size="xs" onClick={()=>removePosition(p.id)}><Trash2 className="w-4 h-4"/></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    );
  }

  function TransactionsView() {
    const base = state.settings.baseCurrency;
    const fmt = base === "KRW" ? krw : usd;
    const byDate = deepClone(state.transactions).sort((a:any,b:any)=>b.date.localeCompare(a.date));
    return (
      <div className="grid gap-3">
        <SectionTitle icon={RefreshCw} title="거래 내역" actions={<AddTxDialog/>} />
        <ScrollArea className="w-full">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">날짜</th>
                <th className="p-2">계좌</th>
                <th className="p-2">유형</th>
                <th className="p-2">금액</th>
                <th className="p-2">수수료</th>
                <th className="p-2">세금</th>
                <th className="p-2">메모</th>
                <th className="p-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {byDate.map((t:any)=>{
                const acc = accountsById[t.accountId];
                const cur = acc?.currency ?? state.settings.baseCurrency;
                const fmtRow = cur === "KRW" ? krw : usd;
                return (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.date}</td>
                    <td className="p-2">{acc?.name ?? "-"}</td>
                    <td className="p-2">{t.type}</td>
                    <td className="p-2">{fmtRow(t.amount)}</td>
                    <td className="p-2">{fmtRow(t.fee)}</td>
                    <td className="p-2">{fmtRow(t.tax)}</td>
                    <td className="p-2">{t.note}</td>
                    <td className="p-2"><Button variant="ghost" size="icon" onClick={()=>removeTransaction(t.id)}><Trash2 className="w-4 h-4"/></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    );
  }

  function GoalsView() {
    const base = state.settings.baseCurrency;
    const fmt = base === "KRW" ? krw : usd;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<any>({ name: "", target: 1_000_000, deadline: todayISO(), accountIds: [], note: "" });

    function progressFor(goal: any) {
      const linked = accountBalances.filter((a:any)=> goal.accountIds.includes(a.id));
      const val = sum(linked.map((a:any)=> a.balanceBase));
      const pct = goal.target > 0 ? (val/goal.target)*100 : 0;
      return { val, pct };
    }

    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle icon={Target} title="재무 목표" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1"/>목표 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>목표 추가</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>목표명</Label>
                  <Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="예: 비상금"/>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>목표 금액</Label>
                    <Input type="number" value={form.target} onChange={e=>setForm({...form, target:Number(e.target.value)})} />
                  </div>
                  <div>
                    <Label>마감일</Label>
                    <Input type="date" value={form.deadline} onChange={e=>setForm({...form, deadline:e.target.value})} />
                  </div>
                </div>
                <div>
                  <Label>연결 계좌</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {state.accounts.map((a:any)=>{
                      const checked = form.accountIds.includes(a.id);
                      return (
                        <Button key={a.id} variant={checked?"default":"outline"} size="sm" onClick={()=>{
                          setForm((f:any)=> ({...f, accountIds: checked? f.accountIds.filter((x:string)=>x!==a.id): [...f.accountIds, a.id]}));
                        }}>{a.name}</Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>메모</Label>
                  <Input value={form.note} onChange={e=>setForm({...form, note:e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={()=>{ addGoal(form); setOpen(false); }}>저장</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {state.goals.map((g:any)=>{
            const { val, pct } = progressFor(g);
            const left = Math.max(0, g.target - val);
            return (
              <Card key={g.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">~ {g.deadline}</div>
                      <div className="text-lg font-semibold">{g.name}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={()=>removeGoal(g.id)}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                  <div className="mt-2">진척: <b>{pct.toFixed(1)}%</b> ({fmt(val)} / {fmt(g.target)})</div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">부족분: {fmt(left)} — 일별 {fmt(left/Math.max(1,daysUntil(g.deadline)))} 저축 필요(단순계산)</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  function daysUntil(dateStr: string) {
    const now = new Date();
    const d = new Date(dateStr);
    return Math.ceil((d.getTime() - now.getTime())/ (1000*60*60*24));
  }

  function AllocationView() {
    const data = ASSET_TYPES.map(t=> ({ type: t, target: state.targets.allocation[t] ?? 0, actual: allocationActual[t] ?? 0 }));
    return (
      <div className="grid gap-3">
        <SectionTitle icon={PieChartIcon} title="목표 vs 실제 자산배분" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Legend />
              <RTooltip />
              <Bar dataKey="target" />
              <Bar dataKey="actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm mb-2">드리프트 임계치: <b>{state.targets.driftThreshold}%</b> (초과 시 리밸런싱 제안)</div>
            <div className="grid gap-2">
              {drift.map((d,i)=> (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>{d.type}</div>
                  <div>목표 {d.target.toFixed(1)}% → 실제 {d.actual.toFixed(1)}% (<span className={Math.sign(d.diff)>0?"text-red-600":"text-blue-600"}>{d.diff>0?"+":""}{d.diff.toFixed(1)}%</span>)</div>
                  <div>
                    {Math.abs(d.diff) >= (state.targets.driftThreshold ?? 5) ? (
                      <Button size="xs" onClick={()=>suggestRebalance(d.type)}>리밸런싱 제안</Button>
                    ) : (
                      <span className="text-muted-foreground">양호</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function suggestRebalance(assetType: string) {
    // Simple suggestion: move value from largest-overweight to underweight categories
    const over = drift.filter(d=>d.diff>0).sort((a,b)=>b.diff-a.diff)[0];
    const under = drift.filter(d=>d.diff<0).sort((a,b)=>a.diff-b.diff)[0];
    if (!over || !under) { alert("리밸런싱 제안을 생성할 수 없습니다."); return; }
    const movePct = Math.min(over.diff, -under.diff);
    const moveAmount = totalAssetsBase * (movePct/100);
    alert(`제안:\n${over.type}에서 ${under.type}로 약 ${movePct.toFixed(1)}% (기준 ${state.settings.baseCurrency} ${Math.round(moveAmount).toLocaleString()}) 이전을 고려하세요.`);
  }

  function ReportsView() {
    // Income/Expense aggregation from transactions
    const monthlyRows: Record<string, { income: number; expense: number }> = {};
    for (const t of state.transactions) {
      const m = t.date.slice(0,7);
      if (!monthlyRows[m]) monthlyRows[m] = { income: 0, expense: 0 };
      const acc = accountsById[t.accountId];
      const baseAmt = toBase(ensureNumber(t.amount), acc?.currency ?? state.settings.baseCurrency);
      if (["Income","Deposit","Sell"].includes(t.type)) monthlyRows[m].income += baseAmt;
      if (["Expense","Withdraw","Buy"].includes(t.type)) monthlyRows[m].expense += baseAmt;
    }
    const monthly = Object.entries(monthlyRows).sort((a,b)=>a[0].localeCompare(b[0])).map(([month, v])=>({ month, ...v }));

    return (
      <div className="grid gap-3">
        <SectionTitle icon={BarChart2} title="월별 수입/지출 (기준 통화)" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Legend />
              <RTooltip />
              <Bar dataKey="income" />
              <Bar dataKey="expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <p className="mb-1">※ 본 리포트는 <b>현금흐름 기반</b> 단순 집계이며, 평가 손익/미실현 손익은 포함하지 않습니다.</p>
            <p>세금/수수료는 각 거래 행에서 별도 반영됩니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function SettingsView() {
    const [baseCurrency, setBaseCurrency] = useState(state.settings.baseCurrency);
    const [usdKrw, setUsdKrw] = useState(state.settings.usdKrw);
    const [risk, setRisk] = useState(state.settings.riskProfile);
    const [driftTh, setDriftTh] = useState(state.targets.driftThreshold);

    const [alloc, setAlloc] = useState(deepClone(state.targets.allocation));

    function saveAll() {
      const total = sum(Object.values(alloc));
      if (Math.abs(total - 100) > 0.01) {
        if (!confirm(`현재 목표 합계가 ${total.toFixed(1)}% 입니다. 그대로 저장할까요?`)) return;
      }
      setState((s:any)=> ({
        ...s,
        settings: { ...s.settings, baseCurrency, usdKrw: ensureNumber(usdKrw), riskProfile: risk },
        targets: { ...s.targets, allocation: alloc, driftThreshold: ensureNumber(driftTh, 5) }
      }));
      alert("설정이 저장되었습니다.");
    }

    return (
      <div className="grid gap-4">
        <SectionTitle icon={Settings} title="환경 설정" />
        <Card className="shadow-sm">
          <CardContent className="p-4 grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>기준 통화</Label>
                <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>환율 USD→KRW</Label>
                <Input type="number" value={usdKrw} onChange={e=>setUsdKrw(Number(e.target.value))} />
                <div className="text-xs text-muted-foreground mt-1">실시간 연동 없이 수동 입력 방식입니다.</div>
              </div>
              <div>
                <Label>위험 성향</Label>
                <Select value={risk} onValueChange={setRisk}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conservative">Conservative</SelectItem>
                    <SelectItem value="Neutral">Neutral</SelectItem>
                    <SelectItem value="Aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="font-medium">목표 자산배분 (%)</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {ASSET_TYPES.map(t=> (
                  <div key={t} className="flex items-center gap-2">
                    <Label className="w-28">{t}</Label>
                    <Input type="number" value={alloc[t]} onChange={e=>setAlloc({...alloc, [t]: Number(e.target.value)})} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label>드리프트 임계치 (%)</Label>
                <Input type="number" value={driftTh} onChange={e=>setDriftTh(Number(e.target.value))} />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button onClick={saveAll}><Save className="w-4 h-4 mr-1"/>저장</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 grid gap-3">
            <div className="font-medium">데이터 관리</div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={exportJSON}><Download className="w-4 h-4 mr-1"/>내보내기(JSON)</Button>
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer">
                <Upload className="w-4 h-4"/> 불러오기(JSON)
                <input type="file" accept="application/json" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) importJSON(f); }} />
              </label>
              <Button variant="destructive" onClick={()=>{ if(confirm("모든 데이터를 초기화할까요?")) { localStorage.removeItem(STORAGE_KEY); setState(seed); } }}>초기화</Button>
            </div>
            <div className="text-xs text-muted-foreground">로컬 저장 방식입니다. 브라우저/기기 변경 시 JSON 백업을 사용하세요.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Layout ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-black/90 text-white grid place-items-center font-bold">AP</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">Asset Portfolio</h1>
              <div className="text-xs text-muted-foreground">자산관리 포트폴리오 · 로컬 저장</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={activeTab==="dashboard"?"default":"outline"} size="sm" onClick={()=>setActiveTab("dashboard")}>대시보드</Button>
            <Button variant={activeTab==="accounts"?"default":"outline"} size="sm" onClick={()=>setActiveTab("accounts")}>계좌/포지션</Button>
            <Button variant={activeTab==="transactions"?"default":"outline"} size="sm" onClick={()=>setActiveTab("transactions")}>거래</Button>
            <Button variant={activeTab==="goals"?"default":"outline"} size="sm" onClick={()=>setActiveTab("goals")}>목표</Button>
            <Button variant={activeTab==="allocation"?"default":"outline"} size="sm" onClick={()=>setActiveTab("allocation")}>배분</Button>
            <Button variant={activeTab==="reports"?"default":"outline"} size="sm" onClick={()=>setActiveTab("reports")}>리포트</Button>
            <Button variant={activeTab==="settings"?"default":"outline"} size="sm" onClick={()=>setActiveTab("settings")}><Settings className="w-4 h-4 mr-1"/>설정</Button>
          </div>
        </header>

        {activeTab === "dashboard" && <DashboardView />}
        {activeTab === "accounts" && <AccountsView />}
        {activeTab === "transactions" && <TransactionsView />}
        {activeTab === "goals" && <GoalsView />}
        {activeTab === "allocation" && <AllocationView />}
        {activeTab === "reports" && <ReportsView />}
        {activeTab === "settings" && <SettingsView />}

        <footer className="mt-10 text-xs text-muted-foreground">
          <div>※ 본 도구는 교육/개인용 MVP입니다. 시세/환율은 자동 연동되지 않으며 사용자가 직접 업데이트해야 합니다.</div>
        </footer>
      </div>
    </div>
  );
}

