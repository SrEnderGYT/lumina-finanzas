"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronRight, CircleDollarSign, CreditCard, LayoutDashboard, ListFilter, Menu, MoreHorizontal, RefreshCw, Search, Settings, Sparkles, Tag, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";

type Transaction = { id: string; merchant: string; detail: string; amount: number; date: string; time: string; bank: string; card: string; category: string; icon: string; tone: string };

const categories = ["Alimentación", "Transporte", "Hogar", "Salud", "Entretenimiento", "Compras"];
const initialTransactions: Transaction[] = [
  { id: "1", merchant: "Tottus", detail: "Compra con tarjeta", amount: 184.9, date: "Hoy", time: "12:42", bank: "Interbank", card: "Visa • 4821", category: "Alimentación", icon: "T", tone: "#dbf6e8" },
  { id: "2", merchant: "Cabify", detail: "Viaje finalizado", amount: 24.5, date: "Hoy", time: "08:15", bank: "BCP", card: "Débito • 1730", category: "Transporte", icon: "C", tone: "#f1e9ff" },
  { id: "3", merchant: "Mercado Libre", detail: "Compra online", amount: 129, date: "23 sep", time: "19:08", bank: "BBVA", card: "Visa • 9934", category: "Compras", icon: "M", tone: "#fff1c8" },
  { id: "4", merchant: "Café 4D", detail: "Consumo", amount: 38.7, date: "23 sep", time: "10:31", bank: "Interbank", card: "Visa • 4821", category: "Alimentación", icon: "4D", tone: "#ffe5de" },
  { id: "5", merchant: "Inkafarma", detail: "Compra presencial", amount: 67.4, date: "22 sep", time: "17:55", bank: "BCP", card: "Débito • 1730", category: "Salud", icon: "+", tone: "#ddf3ff" },
  { id: "6", merchant: "Netflix", detail: "Suscripción mensual", amount: 44.9, date: "21 sep", time: "03:00", bank: "BBVA", card: "Visa • 9934", category: "Entretenimiento", icon: "N", tone: "#ffe2e5" },
];
const demoTrend = [
  { day: "01", current: 120, previous: 92 }, { day: "04", current: 290, previous: 210 }, { day: "07", current: 355, previous: 318 },
  { day: "10", current: 620, previous: 430 }, { day: "13", current: 590, previous: 505 }, { day: "16", current: 910, previous: 670 },
  { day: "19", current: 830, previous: 790 }, { day: "22", current: 1175, previous: 920 }, { day: "24", current: 1248.4, previous: 1014 },
];
const demoCategoryData = [
  { name: "Alimentación", value: 438, color: "#2bd9a8" }, { name: "Compras", value: 302, color: "#625cf6" },
  { name: "Transporte", value: 214, color: "#efb444" }, { name: "Salud", value: 168, color: "#ff7f6e" }, { name: "Otros", value: 126.4, color: "#c9d0dc" },
];
const demoBankData = [
  { name: "Interbank", value: 482.6, color: "#13a774" }, { name: "BCP", value: 429.8, color: "#1e6be3" }, { name: "BBVA", value: 336, color: "#17328c" },
];
const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);

type DashboardPayload = {
  user: { email: string; name: string };
  summary: { currentMonthCents: number; todayCents: number; previousMonthCents: number; changePercent: number | null };
  trend: Array<{ day: string; current: number; previous: number }>;
  byBank: Array<{ name: string; value: number }>;
  byCategory: Array<{ name: string; value: number }>;
  filters: { banks: string[]; categories: string[] };
  transactions: Array<{ id: string; merchant: string; detail?: string; amountCents: number; currency: string; operationDate: number; bank: string; card: string; category: string }>;
};

export function DashboardClient() {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [query, setQuery] = useState("");
  const [bank, setBank] = useState("Todos los bancos");
  const [category, setCategory] = useState("Todas las categorías");
  const [filterOpen, setFilterOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [connected, setConnected] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);

  const loadDashboard = async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as DashboardPayload;
    setDashboard(data);
    setTransactions(data.transactions.map((item, index) => ({
      id: item.id, merchant: item.merchant, detail: item.detail || "Movimiento bancario", amount: item.amountCents / 100,
      date: new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(item.operationDate),
      time: new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(item.operationDate),
      bank: item.bank, card: item.card || "Tarjeta", category: item.category, icon: item.merchant.slice(0, 2).toUpperCase(), tone: ["#dbf6e8", "#f1e9ff", "#fff1c8", "#ffe5de", "#ddf3ff"][index % 5],
    })));
  };

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => await response.json() as { connected?: boolean }).then((session) => {
      setConnected(Boolean(session.connected));
      if (session.connected) void loadDashboard();
    }).catch(() => undefined);
  }, []);
  const visible = useMemo(() => transactions.filter((item) => {
    const haystack = `${item.merchant} ${item.detail} ${item.bank} ${item.card} ${item.category}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (bank === "Todos los bancos" || item.bank === bank) && (category === "Todas las categorías" || item.category === category);
  }), [transactions, query, bank, category]);

  const updateCategory = (id: string, next: string) => {
    setTransactions((items) => items.map((item) => item.id === id ? { ...item, category: next } : item));
    if (connected) void fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: next }) }).then((response) => { if (!response.ok) throw new Error(); }).catch(() => toast.error("No se pudo guardar la categoría"));
    toast.success("Categoría actualizada", { description: "Usaremos esta corrección para mejorar futuras clasificaciones." });
  };
  const sync = () => {
    if (!connected) { window.location.href = "/api/auth/google/start"; return; }
    setSyncing(true);
    void fetch("/api/sync", { method: "POST" }).then(async (response) => { const result = await response.json() as { created?: number; error?: string }; if (!response.ok) throw new Error(result.error); await loadDashboard(); toast.success("Bandeja al día", { description: result.created ? `${result.created} movimientos nuevos.` : "No encontramos movimientos nuevos en Gmail." }); }).catch((error) => toast.error("No pudimos sincronizar", { description: error instanceof Error ? error.message : "Inténtalo otra vez." })).finally(() => setSyncing(false));
  };

  const palette = ["#2bd9a8", "#625cf6", "#efb444", "#ff7f6e", "#c9d0dc"];
  const trend = dashboard?.trend.map((item) => ({ ...item, current: item.current / 100, previous: item.previous / 100 })) ?? demoTrend;
  const categoryData = dashboard?.byCategory.map((item, index) => ({ ...item, value: item.value / 100, color: palette[index % palette.length] })) ?? demoCategoryData;
  const bankData = dashboard?.byBank.map((item, index) => ({ ...item, value: item.value / 100, color: ["#13a774", "#1e6be3", "#17328c", "#b251d2"][index % 4] })) ?? demoBankData;
  const monthTotal = dashboard ? dashboard.summary.currentMonthCents / 100 : 1248.4;
  const todayTotal = dashboard ? dashboard.summary.todayCents / 100 : 209.4;
  const previousTotal = dashboard ? dashboard.summary.previousMonthCents / 100 : 1014;
  const displayName = dashboard?.user.name || "Alex";

  useEffect(() => {
    type Tool = { name: string; title: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute(input: unknown): unknown | Promise<unknown> };
    type ModelContext = { registerTool(tool: Tool, options?: { signal?: AbortSignal }): void | Promise<void> };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); } catch {} };
    register({
      name: "search_transactions", title: "Buscar movimientos", description: "Filtra los movimientos visibles por comercio, banco, tarjeta o categoría.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 80 } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) { const queryValue = typeof input === "object" && input && "query" in input ? String((input as { query: unknown }).query).trim() : ""; if (!queryValue) throw new Error("La búsqueda no puede estar vacía."); setQuery(queryValue); return { query: queryValue, matches: transactions.filter((item) => `${item.merchant} ${item.bank} ${item.category}`.toLowerCase().includes(queryValue.toLowerCase())).length }; },
    });
    register({
      name: "update_transaction_category", title: "Corregir categoría", description: "Cambia manualmente la categoría de un movimiento existente.",
      inputSchema: { type: "object", properties: { transactionId: { type: "string" }, category: { type: "string", enum: categories } }, required: ["transactionId", "category"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) { const value = input as { transactionId?: string; category?: string }; if (!value.transactionId || !value.category || !categories.includes(value.category)) throw new Error("Movimiento o categoría no válidos."); if (!transactions.some((item) => item.id === value.transactionId)) throw new Error("Movimiento no encontrado."); updateCategory(value.transactionId, value.category); return { transactionId: value.transactionId, category: value.category, saved: connected }; },
    });
    return () => lifecycle.abort();
  }, [connected, transactions]);

  return <div className="min-h-screen bg-[#eef2f4] text-[#10231e]">
    <Toaster position="top-right" richColors />
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col bg-[#102820] px-4 py-5 text-white transition-transform duration-300 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-[14px] bg-[#c9ff4d] text-[#102820]"><Sparkles className="size-5" /></div><div><p className="text-[1.08rem] font-bold tracking-[-0.03em]">Lúmina</p><p className="text-xs text-white/48">Finanzas personales</p></div></div>
        <button className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú"><X className="size-5" /></button>
      </div>
      <nav className="space-y-1.5" aria-label="Navegación principal">
        <NavItem active icon={<LayoutDashboard />} label="Resumen" /><NavItem icon={<CreditCard />} label="Movimientos" /><NavItem icon={<Tag />} label="Categorías" /><NavItem icon={<WalletCards />} label="Mis tarjetas" />
      </nav>
      <div className="mt-auto space-y-4">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">Meta mensual</span><span className="text-xs text-[#c9ff4d]">{Math.min(100, Math.round(monthTotal / 20))}%</span></div><Progress value={Math.min(100, monthTotal / 20)} className="h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#c9ff4d]" /><p className="mt-3 text-xs leading-5 text-white/50">{money(monthTotal)} de S/ 2,000</p></div>
        <NavItem icon={<Settings />} label="Configuración" />
        <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4"><div className="grid size-9 place-items-center rounded-full bg-[#e3b9ff] text-sm font-bold text-[#372148]">{displayName.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{displayName}</p><p className="truncate text-xs text-white/45">{connected ? "Gmail conectado" : "Gmail pendiente"}</p></div><MoreHorizontal className="size-4 text-white/40" /></div>
      </div>
    </aside>
    {mobileMenu && <button className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}

    <main className="min-h-screen lg:pl-[252px]">
      <header className="sticky top-0 z-30 flex h-[76px] items-center border-b border-[#dce3e1] bg-[#f7f9f9]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
        <button onClick={() => setMobileMenu(true)} className="mr-3 rounded-xl p-2 hover:bg-black/5 lg:hidden" aria-label="Abrir menú"><Menu className="size-5" /></button>
        <div className="hidden items-center gap-2 text-sm text-[#6d7c77] sm:flex"><CalendarDays className="size-4" /><span>24 de septiembre de 2026</span></div>
        <div className="ml-auto flex items-center gap-2">{!connected && <span className="hidden rounded-full bg-[#e7ecea] px-3 py-1.5 text-xs font-semibold text-[#60706b] md:inline-flex">Vista de demostración</span>}<Button variant="outline" size="sm" onClick={sync} disabled={syncing} className="h-9 rounded-xl border-[#ccd7d3] bg-white text-[#214039] shadow-none hover:bg-[#edf4f1]"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">{syncing ? "Sincronizando" : connected ? "Sincronizar Gmail" : "Conectar Gmail"}</span></Button><button className="relative grid size-9 place-items-center rounded-xl border border-[#d6dfdc] bg-white text-[#4e625b]" aria-label="Notificaciones"><Bell className="size-4" />{connected && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#20bb8c]" />}</button></div>
      </header>
      <div className="mx-auto max-w-[1560px] px-4 pb-14 pt-6 sm:px-7 lg:px-10 lg:pt-9">
        <section className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-1 text-sm font-semibold text-[#71807b]">Tu dinero, en perspectiva</p><h1 className="text-[clamp(2rem,3vw,3.1rem)] font-semibold leading-none tracking-[-0.055em] text-[#112720]">Hola, {displayName}.</h1></div><div className="flex w-fit rounded-xl border border-[#d6dfdc] bg-white p-1 text-sm">{["7 días", "Este mes", "3 meses"].map((period) => <button key={period} className={`rounded-lg px-3 py-2 transition ${period === "Este mes" ? "bg-[#173d32] text-white shadow-sm" : "text-[#72807b] hover:bg-[#f1f4f3]"}`}>{period}</button>)}</div></section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Gasto del mes" value={money(monthTotal)} note={previousTotal ? `${Math.abs(((monthTotal - previousTotal) / previousTotal) * 100).toFixed(1)}% ${monthTotal <= previousTotal ? "menos" : "más"} que el mes anterior` : "Primer mes registrado"} positive={monthTotal <= previousTotal} icon={<CircleDollarSign />} /><Kpi label="Gastos de hoy" value={money(todayTotal)} note={`${transactions.filter((item) => item.date === "Hoy").length || (connected ? 0 : 2)} movimientos`} icon={<ArrowUpRight />} /><Kpi label="Promedio diario" value={money(monthTotal / 24)} note="Promedio del mes actual" positive icon={<ArrowDownRight />} /><Kpi label="Disponible estimado" value={money(Math.max(0, 2000 - monthTotal))} note="de tu meta de S/ 2,000" icon={<WalletCards />} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,.78fr)]">
          <article className="panel overflow-hidden p-5 sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4"><div><p className="section-label">Evolución del gasto</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Septiembre va más liviano</h2></div><div className="hidden items-center gap-4 text-xs text-[#6f7f79] sm:flex"><Legend color="#27c797" label="Este mes" /><Legend color="#cbd4d1" label="Agosto" /></div></div>
            <div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 10, right: 5, left: -18, bottom: 0 }}><defs><linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2bd9a8" stopOpacity={0.3}/><stop offset="100%" stopColor="#2bd9a8" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8edeb" strokeDasharray="4 4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#81908b", fontSize: 12 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#81908b", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} /><ChartTooltip content={<TrendTooltip />} /><Area type="monotone" dataKey="previous" stroke="#bac5c1" strokeWidth={2} strokeDasharray="5 5" fill="transparent" /><Area type="monotone" dataKey="current" stroke="#20bb8c" strokeWidth={3} fill="url(#currentFill)" activeDot={{ r: 5, fill: "#102820", stroke: "white", strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#effaf5] p-3.5 text-sm text-[#315c4e]"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#c9ff4d]"><Sparkles className="size-4" /></span><p><strong>Vas bien:</strong> si mantienes este ritmo, cerrarás el mes S/ 238 por debajo de agosto.</p></div>
          </article>
          <article className="panel p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between"><div><p className="section-label">Por categoría</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Dónde se fue</h2></div><button className="rounded-lg p-2 text-[#7d8a86] hover:bg-black/5" aria-label="Más opciones"><MoreHorizontal className="size-5" /></button></div>
            <div className="relative mx-auto h-[190px] max-w-[290px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} innerRadius={58} outerRadius={82} paddingAngle={3} dataKey="value" stroke="none">{categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><ChartTooltip formatter={(value) => money(Number(value))} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-xs text-[#7b8984]">Total</p><p className="text-lg font-bold tracking-tight">S/ 1,248</p></div></div></div>
            <div className="space-y-3">{categoryData.slice(0, 4).map((item) => <div key={item.name} className="flex items-center gap-3 text-sm"><span className="size-2.5 rounded-full" style={{ background: item.color }} /><span className="flex-1 text-[#52645e]">{item.name}</span><span className="font-semibold">{money(item.value)}</span></div>)}</div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
          <article className="panel overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[#e1e8e5] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="section-label">Actividad reciente</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Movimientos</h2></div><div className="flex items-center gap-2"><div className="relative flex-1 sm:w-[230px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#87938f]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar movimiento" className="h-10 rounded-xl border-[#d8e1de] bg-[#f8faf9] pl-9 shadow-none" /></div><Button size="icon" variant="outline" onClick={() => setFilterOpen(!filterOpen)} className={`size-10 rounded-xl border-[#d8e1de] shadow-none ${filterOpen ? "bg-[#173d32] text-white hover:bg-[#173d32]" : "bg-white"}`} aria-label="Mostrar filtros"><ListFilter className="size-4" /></Button></div></div>
            {filterOpen && <div className="flex flex-wrap gap-2 border-b border-[#e1e8e5] bg-[#f7f9f8] px-5 py-3 sm:px-6"><NativeSelect value={bank} onChange={(e) => setBank(e.target.value)} className="min-w-[170px] rounded-xl border-[#d8e1de] bg-white"><NativeSelectOption>Todos los bancos</NativeSelectOption>{bankData.map((item) => <NativeSelectOption key={item.name}>{item.name}</NativeSelectOption>)}</NativeSelect><NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-[190px] rounded-xl border-[#d8e1de] bg-white"><NativeSelectOption>Todas las categorías</NativeSelectOption>{categories.map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect>{(bank !== "Todos los bancos" || category !== "Todas las categorías") && <Button variant="ghost" size="sm" onClick={() => { setBank("Todos los bancos"); setCategory("Todas las categorías"); }} className="rounded-xl text-[#52665f]">Limpiar</Button>}</div>}
            <div className="hidden md:block"><Table><TableHeader><TableRow className="border-[#e3e9e7] bg-[#fbfcfc] hover:bg-[#fbfcfc]"><TableHead className="pl-6 table-label">Comercio</TableHead><TableHead className="table-label">Banco y tarjeta</TableHead><TableHead className="table-label">Categoría</TableHead><TableHead className="table-label">Fecha</TableHead><TableHead className="table-label pr-6 text-right">Monto</TableHead></TableRow></TableHeader><TableBody>{visible.map((item) => <TableRow key={item.id} className="border-[#e7ecea] hover:bg-[#f6f9f8]"><TableCell className="py-3.5 pl-6"><Merchant item={item} /></TableCell><TableCell><p className="font-medium text-[#3d514a]">{item.bank}</p><p className="text-xs text-[#89948f]">{item.card}</p></TableCell><TableCell><CategorySelect value={item.category} onChange={(next) => updateCategory(item.id, next)} /></TableCell><TableCell><p className="font-medium text-[#4c5f59]">{item.date}</p><p className="text-xs text-[#89948f]">{item.time}</p></TableCell><TableCell className="pr-6 text-right font-bold tracking-tight">− {money(item.amount)}</TableCell></TableRow>)}</TableBody></Table></div>
            <div className="divide-y divide-[#e7ecea] md:hidden">{visible.map((item) => <div key={item.id} className="p-4"><div className="flex items-center gap-3"><Merchant item={item} /><span className="ml-auto self-start font-bold">− {money(item.amount)}</span></div><div className="mt-3 flex items-center justify-between pl-[52px]"><CategorySelect value={item.category} onChange={(next) => updateCategory(item.id, next)} /><span className="text-xs text-[#89948f]">{item.date}</span></div></div>)}</div>
            {visible.length === 0 && <div className="grid min-h-48 place-items-center p-8 text-center"><div><Search className="mx-auto mb-3 size-8 text-[#a0aaa7]" /><p className="font-semibold">Sin coincidencias</p><p className="mt-1 text-sm text-[#7b8984]">Prueba con otro comercio, banco o categoría.</p></div></div>}
            <button className="flex w-full items-center justify-center gap-1.5 border-t border-[#e1e8e5] py-3.5 text-sm font-semibold text-[#2a6c57] hover:bg-[#f5f9f7]">Ver todos los movimientos <ChevronRight className="size-4" /></button>
          </article>
          <div className="grid content-start gap-4">
            <article className="panel p-5 sm:p-6"><p className="section-label">Distribución bancaria</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Gastos por banco</h2><div className="mt-6 space-y-5">{bankData.map((item) => <div key={item.name}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">{item.name}</span><span className="font-semibold">{money(item.value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e8edeb]"><div className="h-full rounded-full transition-all" style={{ width: `${(item.value / 500) * 100}%`, background: item.color }} /></div></div>)}</div></article>
            <article className="overflow-hidden rounded-[24px] bg-[#173d32] p-5 text-white shadow-[0_16px_40px_rgba(16,40,32,.16)] sm:p-6"><div className="mb-8 flex items-start justify-between"><div className="grid size-10 place-items-center rounded-[14px] bg-[#c9ff4d] text-[#16382f]"><Sparkles className="size-5" /></div><span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/65">INSIGHT</span></div><h3 className="text-xl font-semibold leading-tight tracking-[-0.035em]">Tus taxis bajaron 24% esta quincena.</h3><p className="mt-2 text-sm leading-6 text-white/58">Ahorraste aproximadamente S/ 46 frente al mismo periodo de agosto.</p><button className="mt-5 flex items-center gap-1 text-sm font-semibold text-[#c9ff4d]">Ver análisis <ChevronRight className="size-4" /></button></article>
          </div>
        </section>
      </div>
    </main>
  </div>;
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) { return <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? "bg-white text-[#16382f] shadow-sm" : "text-white/58 hover:bg-white/[0.07] hover:text-white"}`}><span className="[&_svg]:size-[18px]">{icon}</span><span>{label}</span>{active && <ChevronRight className="ml-auto size-4 opacity-40" />}</button>; }
function Kpi({ label, value, note, icon, positive = false }: { label: string; value: string; note: string; icon: React.ReactNode; positive?: boolean }) { return <article className="panel group p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(24,48,40,.09)]"><div className="flex items-start justify-between"><p className="text-sm font-medium text-[#71807b]">{label}</p><span className="grid size-9 place-items-center rounded-xl bg-[#eff3f1] text-[#536c63] transition group-hover:bg-[#dff7eb] group-hover:text-[#147653] [&_svg]:size-[18px]">{icon}</span></div><p className="mt-4 text-[1.7rem] font-bold leading-none tracking-[-0.05em]">{value}</p><p className={`mt-3 flex items-center gap-1 text-xs ${positive ? "font-semibold text-[#16865e]" : "text-[#84908c]"}`}>{positive && <ArrowDownRight className="size-3.5" />}{note}</p></article>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: color }} />{label}</span>; }
function Merchant({ item }: { item: Transaction }) { return <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[13px] text-xs font-black" style={{ background: item.tone }}>{item.icon}</span><div className="min-w-0"><p className="truncate font-semibold text-[#203931]">{item.merchant}</p><p className="truncate text-xs text-[#89948f]">{item.detail}</p></div></div>; }
function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <NativeSelect size="sm" value={value} onChange={(event) => onChange(event.target.value)} className="max-w-[150px] rounded-full border-0 bg-[#edf3f0] py-1 pl-3 pr-8 text-xs font-semibold text-[#476158] shadow-none hover:bg-[#e5eeea]">{categories.map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect>; }
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-[#dce5e1] bg-white px-3 py-2 text-xs shadow-xl"><p className="mb-1 text-[#7b8984]">{label} sep</p><p className="font-bold text-[#16382f]">{money(payload[payload.length - 1].value)}</p></div>; }
