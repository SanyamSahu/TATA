import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  UploadCloud,
} from "lucide-react";
import tataMotorsHero from "./assets/tata-motors-hero.png";

const DEFAULT_GAS_URL = (import.meta.env.VITE_GAS_WEB_APP_URL || "").trim();

const SHOPS = ["TCF1", "X4", "PAINT", "TCF2", "Q5", "NOVA", "X1", "PRESS", "TA64", "TA78", "ENGINE"];

const SHIFT_ORDER = ["C", "A", "B"];

const SHIFT_TIME = {
  C: "11:30 PM – 6:30 AM",
  A: "6:30 AM – 3:00 PM",
  B: "3:00 PM – 11:30 PM",
};

const SHIFT_END_TIME = {
  C: "06:30",
  A: "15:00",
  B: "23:30",
};

const SHIFT_DURATION_MIN = {
  C: 365,
  A: 460,
  B: 460,
};

const SHIFTS = SHIFT_ORDER.map((id) => ({ id, label: `Shift ${id}`, time: SHIFT_TIME[id], shops: SHOPS }));

const FIXED_QR = {
  TCF1: 0.827,
  X4: 0.68,
  PAINT: 0.85,
  TCF2: 0.8,
  Q5: 0.71,
  NOVA: 0.7,
  X1: 0.7,
  PRESS: 0.98,
  TA64: 0.98,
  TA78: 0.98,
  ENGINE: 0.99
};

function getFixedQR(shop) {
  const key = String(shop || "").replace(/\s+/g, "").toUpperCase();
  return FIXED_QR[key] || 1.0;
}

// Fixed values: edit these in both React and Apps Script when final targets are known.
// Cycle time and yearly target/gross downtime target are no longer entered by shop users.
const SHOP_CONFIG = {
  TCF1: { displayName: "TCF-1", cycleTimeSec: 67, grossDTTarget: 1589 },
  TCF2: { displayName: "TCF-2", cycleTimeSec: 60, grossDTTarget: 0 },
  PAINT: { displayName: "Paint", cycleTimeSec: 60, grossDTTarget: 0 },
  PRESS: { displayName: "Press", cycleTimeSec: 60, grossDTTarget: 0 },
  X4: { displayName: "X4 BIW", cycleTimeSec: 60, grossDTTarget: 0 },
  Q5: { displayName: "Q5 BIW", cycleTimeSec: 60, grossDTTarget: 0 },
  X1: { displayName: "X1 BIW", cycleTimeSec: 60, grossDTTarget: 0 },
  NOVA: { displayName: "Nova BIW", cycleTimeSec: 60, grossDTTarget: 0 },
  ENGINE: { displayName: "Engine", cycleTimeSec: 60, grossDTTarget: 0 },
  TA64: { displayName: "TA", cycleTimeSec: 60, grossDTTarget: 0 },
  TA78: { displayName: "CPED", cycleTimeSec: 60, grossDTTarget: 0 },
};

const LOSS_CATEGORIES = [
  { key: "lossShortages", label: "Shortages" },
  { key: "lossQualityBIW", label: "Quality, BIW" },
  { key: "lossBDMaintenance", label: "BD/Maintenance" },
  { key: "lossProcessOthers", label: "Process/Others" },
  { key: "lossEngine", label: "Engine" },
  { key: "lossPaint", label: "Paint" },
  { key: "lossPPC", label: "PPC" },
  { key: "lossIPMS", label: "IPMS" },
  { key: "lossHR", label: "HR" },
  { key: "lossProject", label: "PROJECT" },
  { key: "lossTS", label: "TS" },
  { key: "lossOthers", label: "Others" },
];

const LOSS_DETAIL_FIELD_CONFIG = {
  lossShortages: { label: "Material / Part Description", placeholder: "Example: Mudliner stud / sheet metal", hasRemark: false },
  lossQualityBIW: { label: "Defect / Material Description", placeholder: "Example: Mudliner stud missing", hasRemark: false },
  lossBDMaintenance: { label: "Machine Name", placeholder: "Example: Trim 3 unload lift", hasRemark: true, remarkLabel: "Fault / Remark", remarkPlaceholder: "Example: Lift fault during loading" },
  lossProcessOthers: { label: "Process / Operation Description", placeholder: "Example: Clutch pedal fitment operation", hasRemark: false },
  lossEngine: { label: "Engine / Operation Description", placeholder: "Example: Engine supply delay", hasRemark: false },
  lossPaint: { label: "Paint Process Description", placeholder: "Example: Paint booth stoppage", hasRemark: false },
  lossPPC: { label: "PPC / Planning Description", placeholder: "Example: Schedule or part planning delay", hasRemark: false },
  lossIPMS: { label: "IPMS / Material Description", placeholder: "Example: IPMS material issue", hasRemark: false },
  lossHR: { label: "Manpower / Absenteeism Description", placeholder: "Example: Trim 1 operation delay due to absenteeism", hasRemark: false },
  lossProject: { label: "Project / Activity Description", placeholder: "Example: Planned project activity", hasRemark: false },
  lossTS: { label: "Tooling / Service Description", placeholder: "Example: Tool change delay", hasRemark: false },
  lossOthers: { label: "Reason Description", placeholder: "Example: Safety presentation", hasRemark: false },
};

function lossDetailFieldConfig(lossKey) {
  return LOSS_DETAIL_FIELD_CONFIG[lossKey] || { label: "Reason Description", placeholder: "Describe the reason", hasRemark: false };
}

const SHOP_LOSS_CONFIG = {
  TCF1: {
    categories: [
      ["lossShortages", "Shortages"], ["lossQualityBIW", "Quality, BIW"], ["lossBDMaintenance", "BD/Maintenance"],
      ["lossProcessOthers", "Process/Others"], ["lossEngine", "Engine"], ["lossPaint", "Paint"],
      ["lossPPC", "PPC"], ["lossIPMS", "IPMS"], ["lossHR", "HR"], ["lossTS", "TS"], ["lossOthers", "Others"],
    ],
  },
  X4_GROUP: {
    categories: [
      ["lossShortages", "Shortages"], ["lossQualityBIW", "Quality"], ["lossBDMaintenance", "BD/Maintenance"],
      ["lossProcessOthers", "Process/Others"], ["lossHR", "Manpower Loss"],
      ["lossProject", "Fixed Losses"], ["lossOthers", "Others"],
    ],
  },
  TCF2: {
    categories: [
      ["lossShortages", "Shortages"], ["lossQualityBIW", "Part Quality"], ["lossBDMaintenance", "BD/Maintenance"],
      ["lossProcessOthers", "JBIW"], ["lossEngine", "Process"], ["lossPaint", "IPMS"], ["lossPPC", "TS"],
      ["lossIPMS", "EV Shop"], ["lossHR", "PPC"], ["lossProject", "Paint"], ["lossTS", "Others"], ["lossOthers", "UA"],
    ],
  },
  PAINT: {
    categories: [
      ["lossShortages", "Shortages"], ["lossQualityBIW", "Quality"], ["lossBDMaintenance", "BD/Maintenance"],
      ["lossProcessOthers", "Process/Others"], ["lossHR", "Manpower Loss"], ["lossProject", "PBS Full - No PBS Hanger"],
      ["lossOthers", "Others"],
    ],
  },
  PRESS: {
    categories: [
      ["lossProcessOthers", "Process Losses (Automation, Set Up, Blanking)"], ["lossQualityBIW", "Quality"],
      ["lossBDMaintenance", "BD/Maintenance"], ["lossEngine", "D/R"], ["lossHR", "Manpower Loss"],
      ["lossProject", "Planned Shutdown/Other Losses"], ["lossOthers", "Others"],
    ],
  },
};

const X4_GROUP_SHOPS = new Set(["X4", "Q5", "X1", "NOVA", "ENGINE", "TA64", "TA78"]);

function lossConfigForShop(shop) {
  const key = String(shop || "").toUpperCase();
  if (X4_GROUP_SHOPS.has(key)) return SHOP_LOSS_CONFIG.X4_GROUP;
  return SHOP_LOSS_CONFIG[key] || SHOP_LOSS_CONFIG.TCF1;
}

function lossCategoriesForShop(shop) {
  return lossConfigForShop(shop).categories.map(([key, label]) => ({ key, label }));
}

function normalizeLossDetails(value) {
  const parsed = safeJsonParse(value, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).map(([key, rows]) => [
    key,
    (Array.isArray(rows) ? rows : []).map((row) => ({
      machine: toText(row?.machine),
      minutes: row?.minutes === "" || row?.minutes == null ? "" : toNumber(row.minutes),
      remarks: toText(row?.remarks),
    })),
  ]));
}

function lossDetailTotal(details, key) {
  return (details?.[key] || []).reduce((sum, row) => sum + toNumber(row.minutes), 0);
}

const HOUR_SLOTS = {
  A: ["06:30 to 07:30", "07:30 to 08:30", "08:30 to 09:30", "09:30 to 10:30", "10:30 to 11:30", "11:30 to 12:30", "12:30 to 01:30", "01:30 to 02:30", "02:30 to 03:00"],
  B: ["03:00 to 04:00", "04:00 to 05:00", "05:00 to 06:00", "06:00 to 07:00", "07:00 to 08:00", "08:00 to 09:00", "09:00 to 10:00", "10:00 to 11:00", "11:00 to 11:30"],
  C: ["11:30 to 12:30", "12:30 to 01:30", "01:30 to 02:30", "02:30 to 03:30", "03:30 to 04:30", "04:30 to 05:30", "05:30 to 06:30"],
};

const HOUR_SLOT_DURATION_MIN = {
  A: [60, 60, 60, 60, 60, 60, 60, 60, 30],
  B: [60, 60, 60, 60, 60, 60, 60, 60, 30],
  C: [60, 60, 60, 60, 60, 60, 60],
};

function calculatedAvailableTime(shift, hourlyActual) {
  const fixedTime = SHIFT_DURATION_MIN[shift] || 0;
  const durations = HOUR_SLOT_DURATION_MIN[shift] || [];
  const actual = Array.isArray(hourlyActual) ? hourlyActual : [];
  const zeroTime = durations.reduce((sum, duration, index) => {
    const value = actual[index];
    return value !== "" && value != null && toNumber(value) === 0 ? sum + duration : sum;
  }, 0);
  return Math.max(fixedTime - zeroTime, 0);
}

function plannedCapacity(shift, cycleTimeSec) {
  const fixedTime = SHIFT_DURATION_MIN[shift] || 0;
  const cycle = toNumber(cycleTimeSec);
  return fixedTime > 0 && cycle > 0 ? Math.round((fixedTime * 60) / cycle) : 0;
}

function editableHourlyActual(value, shift) {
  if (!value) return (HOUR_SLOTS[shift] || []).map(() => "");
  const parsed = safeJsonParse(value, []);
  if (!Array.isArray(parsed)) return (HOUR_SLOTS[shift] || []).map(() => "");
  return (HOUR_SLOTS[shift] || []).map((_, index) => parsed[index] ?? "");
}

const USERS = [
  { username: "admin", password: "Admin@2024", role: "admin", shop: null, shift: null, repName: "TATA MOTORS Admin" },
  ...SHOPS.map((shop) => ({ username: shop.toLowerCase(), password: `${shop}@2024`, role: "rep", shop, shift: null, repName: `${SHOP_CONFIG[shop]?.displayName || shop} Representative` })),
];

const LS_KEYS = {
  USER: "plantops_user_v3_meeting_block",
  GAS_URL: "plantops_gas_url_v3_meeting_block",
  ENTRIES: "plantops_entries_cache_v3_meeting_block",
};

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDotDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function getYesterdayDateStr(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

function todayStr() {
  return formatLocalDate(new Date());
}

function dateOnly(value) {
  if (!value) return todayStr();
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? todayStr() : formatLocalDate(date);
}

function toNumber(value, fallback = 0) {
  if (value === "" || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function configuredNumber(value, fallback) {
  return value === "" || value == null ? fallback : toNumber(value, fallback);
}

function toText(value, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

function round1(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function monthLabel(dateStr) {
  const date = new Date(`${dateOnly(dateStr)}T00:00:00`);
  return date.toLocaleString("en-GB", { month: "short" });
}

function meetingDate(dateStr) {
  const date = new Date(`${dateOnly(dateStr)}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-");
}
function addDaysStr(dateStr, days) {
  const d = new Date(`${dateOnly(dateStr)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function dayOfWeek(dateStr) {
  return new Date(`${dateOnly(dateStr)}T00:00:00`).getDay();
}

function normalizeShift(value) {
  return String(value || "").replace("Shift ", "").trim().toUpperCase();
}

function isShiftAvailableOnDate(dateStr, shift) {
  const s = normalizeShift(shift);
  if (!SHIFT_ORDER.includes(s)) return false;
  const day = dayOfWeek(dateStr);
  // Sunday has only A and B. Because Sunday night C is off, Monday has no Shift C report.
  if (s === "C" && (day === 0 || day === 1)) return false;
  return true;
}

function availableShiftIds(dateStr) {
  return SHIFT_ORDER.filter((shift) => isShiftAvailableOnDate(dateStr, shift));
}

function shiftEndDateTime(dateStr, shift) {
  return new Date(`${dateOnly(dateStr)}T${SHIFT_END_TIME[normalizeShift(shift)] || "23:59"}:00`);
}

function editDeadline(dateStr, shift) {
  const currentShift = normalizeShift(shift);
  const currentIndex = SHIFT_ORDER.indexOf(currentShift);
  if (currentIndex < 0) return new Date(`${addDaysStr(dateStr, 1)}T23:59:00`);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const checkDate = addDaysStr(dateStr, dayOffset);
    const startIndex = dayOffset === 0 ? currentIndex + 1 : 0;
    for (let i = startIndex; i < SHIFT_ORDER.length; i += 1) {
      const nextShift = SHIFT_ORDER[i];
      if (isShiftAvailableOnDate(checkDate, nextShift)) return shiftEndDateTime(checkDate, nextShift);
    }
  }
  return new Date(`${addDaysStr(dateStr, 1)}T23:59:00`);
}

function getSuggestedDateShift(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  let date = formatLocalDate(now);
  let shift = "A";
  if (minutes < 390) shift = "C";
  else if (minutes < 900) shift = "A";
  else if (minutes < 1410) shift = "B";
  else shift = "C";
  if (!isShiftAvailableOnDate(date, shift)) shift = availableShiftIds(date)[0] || "A";
  return { date, shift };
}

function isEditAllowed(dateStr, shift) {
  return new Date() <= editDeadline(dateStr, shift);
}

function deadlineLabel(dateStr, shift) {
  const d = editDeadline(dateStr, shift);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}


function monthYear(dateStr) {
  const date = new Date(`${dateOnly(dateStr)}T00:00:00`);
  return `${date.toLocaleString("en-GB", { month: "short" })}'${String(date.getFullYear()).slice(2)}`;
}

function shiftCode(shift) {
  const s = normalizeShift(shift);
  if (s === "A") return 1;
  if (s === "B") return 2;
  if (s === "C") return 3;
  return s || "";
}

function shopConfig(shop) {
  const key = String(shop || "").toUpperCase();
  return SHOP_CONFIG[key] || { displayName: `${key} Shop`, cycleTimeSec: 60, grossDTTarget: 0 };
}

function safeJsonParse(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function buildKey(entry) {
  return `${dateOnly(entry.date)}|${String(entry.shop).toUpperCase()}|${String(entry.shift).toUpperCase()}`;
}

function latestEntryDate(entries, fallback = todayStr()) {
  return entries
    .map((entry) => dateOnly(entry.date))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || fallback;
}

function latestDailyReviewDate(entries, fallback = todayStr()) {
  if (!entries.length) return fallback;
  return addDaysStr(latestEntryDate(entries, fallback), 1);
}

function defaultHourlyPlan(capacity, shift) {
  const slots = HOUR_SLOTS[shift] || HOUR_SLOTS.C;
  const total = Math.max(0, Math.round(toNumber(capacity)));
  if (!slots.length) return [];
  const base = Math.floor(total / slots.length);
  let remaining = total - base * slots.length;
  return slots.map(() => {
    const value = base + (remaining > 0 ? 1 : 0);
    remaining -= 1;
    return value;
  });
}

function normalizeHourlyArray(value, shift, fallbackTotal = 0) {
  const slots = HOUR_SLOTS[shift] || HOUR_SLOTS.C;
  let arr = safeJsonParse(value, []);
  if (!Array.isArray(arr)) arr = [];
  const out = slots.map((_, i) => toNumber(arr[i], 0));
  if (!out.some(Boolean) && fallbackTotal > 0) return defaultHourlyPlan(fallbackTotal, shift);
  return out;
}

function calcDerived(entry) {
  const actual = toNumber(entry.actualProduction);
  const available = toNumber(entry.timeAvailable);
  const cycle = configuredNumber(entry.cycleTimeSec, shopConfig(entry.shop).cycleTimeSec);
  const pr = configuredNumber(entry.pr, 1.0);
  const qr = configuredNumber(entry.qr, getFixedQR(entry.shop));
  const bd = toNumber(entry.bdOccurrence);
  const capacity = available > 0 && cycle > 0 ? Math.round((available * 60) / cycle) : 0;
  const productionTime = actual > 0 && cycle > 0 ? round1((actual * cycle) / 60) : 0;
  const netDt = Math.max(round1(available - productionTime), 0);
  // Production-derived time and reported loss categories are independent records.
  const lossTime = netDt;
  const ar = available ? round2(productionTime / available) : 0;
  const oePct = round1(ar * pr * qr * 100);
  const lePct = capacity ? Math.round((actual / capacity) * 100) : 0;
  const affectedDowntime = toNumber(entry.affectedDowntime);
  const operatingTime = Math.max(available - affectedDowntime, 0);
  const mttr = bd ? round1(affectedDowntime / bd) : 0;
  const mtbfHrs = bd ? round1(operatingTime / (bd * 60)) : 0;
  const uptimeGross = available ? round2((available - lossTime) / available) : 0;
  return { capacity, productionTime, netDt, ar, oePct, lePct, mttr, mtbfHrs, affectedDowntime, operatingTime, uptimeGross, lossTime, productionLoss: Math.max(capacity - actual, 0) };
}

function normalizeEntry(raw) {
  const entry = raw || {};
  const shop = String(entry.shop || "").toUpperCase();
  const date = dateOnly(entry.date);
  const shift = normalizeShift(entry.shift) || availableShiftIds(date)[0] || "A";
  const cfg = shopConfig(shop);
  const pr = configuredNumber(entry.pr, 1.0);
  const qr = configuredNumber(entry.qr, getFixedQR(shop));
  const normalized = {
    id: entry.id || buildKey({ date, shop, shift }),
    date,
    month: entry.month || monthLabel(entry.date),
    shop,
    shopDisplayName: entry.shopDisplayName || cfg.displayName,
    shift,
    shiftCode: entry.shiftCode || shiftCode(shift),
    shiftTime: entry.shiftTime || SHIFT_TIME[shift] || "",
    repName: toText(entry.repName || `${cfg.displayName} Representative`),
    actualProduction: toNumber(entry.actualProduction),
    timeAvailable: toNumber(entry.timeAvailable),
    cycleTimeSec: configuredNumber(entry.cycleTimeSec, cfg.cycleTimeSec),
    pr: pr,
    qr: qr,
    bdOccurrence: toNumber(entry.bdOccurrence),
    affectedDowntime: toNumber(entry.affectedDowntime ?? entry.affectedDTmin),
    grossDowntime: toNumber(entry.grossDowntime ?? entry.grossDTmin),
    grossDTTarget: configuredNumber(entry.grossDTTarget, cfg.grossDTTarget),
    affectedDTmin: toNumber(entry.affectedDTmin),
    grossDTmin: toNumber(entry.grossDTmin),
    majorBreakdown: toText(entry.majorBreakdown || entry.breakdownDetails),
    safetyIssue: toText(entry.safetyIssue),
    sparesConsumed: toText(entry.sparesConsumed),
    lossDetails: normalizeLossDetails(entry.lossDetails),
    submittedBy: toText(entry.submittedBy),
    submittedAt: toText(entry.submittedAt),
    lastUpdatedAt: toText(entry.lastUpdatedAt),
  };
  LOSS_CATEGORIES.forEach((item) => { normalized[item.key] = toNumber(entry[item.key]); });
  normalized.hourlyPlan = normalizeHourlyArray(
    entry.hourlyPlan,
    shift,
    plannedCapacity(shift, normalized.cycleTimeSec),
  );
  normalized.hourlyActual = normalizeHourlyArray(entry.hourlyActual, shift, 0);
  return { ...normalized, ...calcDerived(normalized) };
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

async function apiGet(baseUrl, params = {}) {
  if (!baseUrl) throw new Error("Google Apps Script URL is missing.");
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { method: "GET" });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Apps Script did not return JSON. Check Web App /exec URL and access. First response: ${text.slice(0, 120)}`); }
  if (!data.success) throw new Error(data.error || "Apps Script returned an error.");
  return data;
}

async function apiPost(baseUrl, payload) {
  if (!baseUrl) throw new Error("Google Apps Script URL is missing.");
  const response = await fetch(baseUrl, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" } });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Apps Script did not return JSON. Check Web App /exec URL and access. First response: ${text.slice(0, 120)}`); }
  if (!data.success) throw new Error(data.error || "Apps Script returned an error.");
  return data;
}

function upsertLocal(entries, entry) {
  const normalized = normalizeEntry(entry);
  const index = entries.findIndex((item) => buildKey(item) === buildKey(normalized));
  if (index >= 0) return entries.map((item, i) => (i === index ? normalized : item));
  return [...entries, normalized];
}

function initAggregate(label = "Total") {
  return { label, reports: 0, production: 0, capacity: 0, lossTime: 0, affectedDowntime: 0, availableTime: 0, bdOccurrence: 0, oeTotal: 0, leTotal: 0, mttr: 0, mtbfHrs: 0 };
}
function addToAggregate(acc, entry) {
  const e = normalizeEntry(entry);
  acc.reports += 1;
  acc.production += e.actualProduction;
  acc.capacity += e.capacity;
  acc.lossTime += e.lossTime;
  acc.affectedDowntime += e.affectedDowntime;
  acc.availableTime += e.timeAvailable;
  acc.bdOccurrence += e.bdOccurrence;
  acc.oeTotal += e.oePct;
  acc.leTotal += e.lePct;
  return acc;
}
function finalizeAggregate(acc) {
  return {
    ...acc,
    avgOe: acc.reports ? round1(acc.oeTotal / acc.reports) : 0,
    avgLe: acc.reports ? round1(acc.leTotal / acc.reports) : 0,
    mttr: acc.bdOccurrence ? round1(acc.affectedDowntime / acc.bdOccurrence) : 0,
    mtbfHrs: acc.bdOccurrence ? round1((Math.max(acc.availableTime - acc.affectedDowntime, 0)) / (acc.bdOccurrence * 60)) : 0,
  };
}
function groupRows(entries, keyFn, labelFn) {
  const map = new Map();
  entries.map(normalizeEntry).forEach((entry) => {
    const key = keyFn(entry);
    if (!map.has(key)) map.set(key, initAggregate(labelFn(entry)));
    addToAggregate(map.get(key), entry);
  });
  return [...map.values()].map(finalizeAggregate);
}

function buildDayRows(entries) {
  return groupRows(entries, (e) => e.date, (e) => meetingDate(e.date)).sort((a, b) => a.label.localeCompare(b.label));
}
function buildShopRows(entries) {
  return groupRows(entries, (e) => e.shop, (e) => e.shop).sort((a, b) => a.label.localeCompare(b.label));
}
function buildMonthRows(entries) {
  return groupRows(entries, (e) => e.date.slice(0, 7), (e) => monthYear(e.date));
}
function buildShiftRows(entries) {
  return groupRows(entries, (e) => `${e.shop}|${e.shift}`, (e) => `${e.shop} / Shift ${e.shift}`)
    .sort((a, b) => a.label.localeCompare(b.label));
}
function cumulativeRows(entries) {
  let gross = 0, bd = 0;
  return buildDayRows(entries).map((row) => { gross += row.lossTime; bd += row.bdOccurrence; return { date: row.label, dailyLoss: row.lossTime, cumulativeLoss: gross, cumulativeBD: bd }; });
}
function breakdownRows(entries) {
  return entries.map(normalizeEntry).filter((e) => e.lossTime || e.majorBreakdown).map((e) => ({ date: meetingDate(e.date), shop: e.shop, shift: `Shift ${e.shift}`, lossTime: e.lossTime, bdOccurrence: e.bdOccurrence, details: e.majorBreakdown || "—" }));
}

const S = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f7fbff 0%, #eef4ff 38%, #f8fbff 100%)",
    color: "#172033",
    fontFamily: "Inter, ui-sans-serif, system-ui, Arial",
    fontSize: 15,
  },
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "rgba(255,255,255,.88)",
    backdropFilter: "blur(18px)",
    borderBottom: "1px solid #dfe7f3",
    padding: "16px clamp(22px, 2.2vw, 42px)",
    display: "flex",
    gap: 20,
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 10px 32px rgba(31,68,126,.08)",
  },
  brand: {
    fontSize: 22,
    fontWeight: 950,
    color: "#10213f",
    letterSpacing: "-.02em",
  },
  page: {
    width: "100%",
    maxWidth: 1920,
    margin: "0 auto",
    padding: "24px clamp(22px, 2.2vw, 42px) 44px",
    animation: "fadeUp .45s ease both",
  },
  card: {
    background: "rgba(255,255,255,.94)",
    border: "1px solid #e2e9f5",
    borderRadius: 24,
    padding: "26px clamp(22px, 2vw, 34px)",
    marginBottom: 22,
    boxShadow: "0 18px 45px rgba(40,73,118,.10)",
    animation: "fadeUp .42s ease both",
    transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
  },
  title: {
    margin: 0,
    fontSize: 27,
    lineHeight: 1.2,
    color: "#14213d",
    letterSpacing: "-.02em",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 950,
    color: "#263a61",
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  subtle: {
    color: "#63708a",
    lineHeight: 1.45,
  },
  tabs: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  btn: (variant = "default") => {
    const theme = {
      primary: {
        background: "linear-gradient(135deg, #2563eb 0%, #5b7cfa 100%)",
        color: "#ffffff",
        border: "1px solid #3f6ff0",
        boxShadow: "0 14px 26px rgba(37,99,235,.30)",
        animation: "softPulse 2.8s ease-in-out infinite",
      },
      success: {
        background: "linear-gradient(135deg, #059669 0%, #22c55e 100%)",
        color: "#ffffff",
        border: "1px solid #12a86f",
        boxShadow: "0 12px 24px rgba(5,150,105,.24)",
      },
      danger: {
        background: "linear-gradient(135deg, #ef4444 0%, #fb7185 100%)",
        color: "#ffffff",
        border: "1px solid #f15b67",
        boxShadow: "0 12px 22px rgba(239,68,68,.20)",
      },
      warning: {
        background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        color: "#422006",
        border: "1px solid #f0a819",
        boxShadow: "0 12px 22px rgba(245,158,11,.20)",
      },
      default: {
        background: "#ffffff",
        color: "#24324d",
        border: "1px solid #d7e0ee",
        boxShadow: "0 8px 18px rgba(32,54,91,.08)",
      },
    };
    return {
      minHeight: 44,
      borderRadius: 14,
      padding: "11px 18px",
      fontWeight: 900,
      fontSize: 14,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      transition: "transform .18s ease, box-shadow .18s ease, filter .18s ease",
      ...theme[variant],
    };
  },
  tabBtn: (active) => ({
    border: `1px solid ${active ? "#4372f2" : "#d8e1ef"}`,
    borderRadius: 999,
    minHeight: 44,
    padding: "10px 17px",
    color: active ? "#ffffff" : "#526079",
    background: active ? "linear-gradient(135deg, #2563eb 0%, #6d7cff 100%)" : "rgba(255,255,255,.72)",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: active ? "0 12px 24px rgba(37,99,235,.24)" : "0 6px 14px rgba(32,54,91,.05)",
    transition: "transform .18s ease, box-shadow .18s ease, background .18s ease",
  }),
  grid: (min = 220) => ({
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: 20,
  }),
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#ffffff",
    border: "1px solid #d6dfed",
    minHeight: 46,
    borderRadius: 14,
    color: "#162033",
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    boxShadow: "0 7px 16px rgba(26,51,93,.05)",
    transition: "border-color .18s ease, box-shadow .18s ease, transform .18s ease",
  },
  label: {
    display: "block",
    color: "#4e5d76",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 7,
  },
  stat: {
    background: "linear-gradient(180deg, #ffffff 0%, #f7faff 100%)",
    border: "1px solid #dfe8f6",
    borderRadius: 20,
    padding: 24,
    minHeight: 138,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "0 12px 26px rgba(34,63,104,.08)",
    transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
  },
  statV: {
    fontSize: 36,
    fontWeight: 950,
    color: "#10213f",
  },
  statL: {
    color: "#6a758c",
    fontSize: 14,
    marginTop: 7,
    fontWeight: 800,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #dfe8f6",
    borderRadius: 18,
    background: "#ffffff",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1000,
    fontSize: 13,
  },
  th: {
    background: "linear-gradient(180deg, #f2f6fd 0%, #e9f0fb 100%)",
    color: "#43516b",
    textAlign: "left",
    padding: "14px 15px",
    borderBottom: "1px solid #d8e2f0",
    whiteSpace: "nowrap",
    fontWeight: 950,
  },
  td: {
    padding: "13px 15px",
    borderBottom: "1px solid #ecf1f8",
    verticalAlign: "top",
    color: "#253147",
    whiteSpace: "pre-wrap",
  },
  badge: (tone = "blue") => {
    const styles = {
      red: { color: "#b42335", background: "#fff1f3", border: "#ffd5dc" },
      green: { color: "#067647", background: "#ecfdf3", border: "#abeFC6" },
      orange: { color: "#b54708", background: "#fffaeb", border: "#fedf89" },
      blue: { color: "#175cd3", background: "#eff6ff", border: "#bfdbfe" },
    };
    const s = styles[tone] || styles.blue;
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 950,
      color: s.color,
      background: s.background,
      border: `1px solid ${s.border}`,
    };
  },
  error: {
    background: "#fff1f3",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    marginBottom: 14,
    boxShadow: "0 10px 20px rgba(190,18,60,.08)",
  },
  ok: {
    background: "#ecfdf3",
    color: "#066344",
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    marginBottom: 14,
    boxShadow: "0 10px 20px rgba(5,150,105,.08)",
  },
};

function GlobalStyle() {
  return <style>{`
    * { box-sizing: border-box; }
    html { background: #f7fbff; }
    body { margin: 0; min-width: 320px; background: #f7fbff; }
    .app-page { overflow-x: clip; }
    .app-nav { min-height: 76px; }
    .app-nav__tabs { justify-content: flex-end; }
    button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.02); }
    button:focus-visible { outline: 3px solid rgba(37,99,235,.28); outline-offset: 3px; }
    button:active:not(:disabled) { transform: translateY(0); }
    input:focus, select:focus, textarea:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 4px rgba(59,130,246,.14), 0 10px 22px rgba(32,82,170,.08) !important; }
    input:disabled, select:disabled, textarea:disabled { background: #f3f6fb !important; color: #7a869d !important; cursor: not-allowed; }
    .ui-card { width: 100%; }
    .ui-card:hover { transform: translateY(-3px); border-color: #c9d8f0 !important; box-shadow: 0 26px 60px rgba(40,73,118,.15) !important; }
    .feature-card { position: relative; overflow: hidden; border-color: #bfdbfe !important; box-shadow: 0 22px 54px rgba(37,99,235,.14) !important; }
    .feature-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 5px; background: linear-gradient(180deg, #2563eb, #06b6d4); }
    .form-section { margin-top: 24px !important; padding: 24px !important; border-radius: 20px !important; box-shadow: 0 14px 32px rgba(40,73,118,.08); }
    .form-section:hover { box-shadow: 0 20px 42px rgba(40,73,118,.12); }
    .form-details { margin-top: 24px; padding: 24px; border: 1px solid #dfe8f6; border-radius: 20px; background: linear-gradient(135deg, #f8fbff, #ffffff); box-shadow: 0 14px 30px rgba(40,73,118,.07); }
    .loss-section { padding: 21px 22px !important; background: #fffdfa !important; box-shadow: 0 10px 26px rgba(40,73,118,.06) !important; }
    .loss-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 10px; align-items: start; margin-top: 12px; }
    .loss-input-card { min-width: 0; align-self: start; padding: 11px 12px; border: 1px solid #e7eaf0; border-radius: 14px; background: #ffffff; box-shadow: 0 4px 12px rgba(40,73,118,.035); }
    .loss-input-card > label { margin-bottom: 5px !important; font-size: 12px !important; }
    .loss-input-card > input { min-height: 40px !important; padding: 9px 11px !important; box-shadow: none !important; }
    .loss-detail-toggle { width: 100%; margin-top: 7px; min-height: 32px; border: 0; border-radius: 9px; background: #fff7ed; color: #9a4b0c; font-size: 12px; font-weight: 850; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 6px 9px; }
    .loss-detail-toggle:hover { background: #ffedd5; transform: none !important; }
    .loss-detail-panel { grid-column: 1 / -1; margin-top: 4px; padding: 16px; border: 1px solid #fed7aa; border-radius: 14px; background: #fffdf9; box-shadow: none; }
    .loss-detail-row { display: grid; grid-template-columns: minmax(190px, 1.1fr) minmax(130px, .45fr) minmax(220px, 1.4fr) auto; gap: 12px; align-items: end; margin-top: 12px; }
    .loss-detail-summary { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 14px; padding: 10px 12px; border-radius: 11px; font-weight: 850; }
    .loss-allocation-summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 14px 0 0 !important; padding: 8px 10px !important; border-radius: 11px !important; font-size: 12px !important; box-shadow: none !important; }
    .loss-summary-item { padding: 4px 8px; border-radius: 8px; background: rgba(255,255,255,.72); white-space: nowrap; }
    .status-bar { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
    .status-bar:hover { transform: translateY(-2px); border-color: #c8d8ef !important; box-shadow: 0 12px 28px rgba(40,73,118,.12) !important; }
    .metric-card:hover { transform: translateY(-5px) scale(1.015); box-shadow: 0 20px 38px rgba(34,63,104,.16) !important; }
    .metric-card--primary { min-height: 132px !important; border-color: #bfdbfe !important; background: linear-gradient(145deg, #eff6ff 0%, #ffffff 72%) !important; }
    .metric-card--success { min-height: 132px !important; border-color: #bbf7d0 !important; background: linear-gradient(145deg, #ecfdf3 0%, #ffffff 72%) !important; }
    .metric-card--warning { min-height: 132px !important; border-color: #fed7aa !important; background: linear-gradient(145deg, #fff7ed 0%, #ffffff 72%) !important; }
    .metric-card--danger { min-height: 132px !important; border-color: #fecdd3 !important; background: linear-gradient(145deg, #fff1f2 0%, #ffffff 72%) !important; }
    .metric-card--primary .metric-value { color: #1d4ed8 !important; font-size: 34px !important; }
    .metric-card--success .metric-value { color: #047857 !important; font-size: 34px !important; }
    .metric-card--warning .metric-value { color: #b45309 !important; font-size: 34px !important; }
    .metric-card--danger .metric-value { color: #be123c !important; font-size: 34px !important; }
    .dashboard-summary { padding: 27px 32px !important; }
    .dashboard-summary .metric-card { min-height: 132px !important; padding: 22px 24px !important; }
    .dashboard-summary .metric-value { font-size: 38px !important; }
    .primary-action { min-height: 50px; padding-left: 26px !important; padding-right: 26px !important; font-size: 15px !important; }
    .primary-action:hover:not(:disabled) { transform: translateY(-3px) scale(1.015); box-shadow: 0 20px 38px rgba(37,99,235,.38) !important; }
    .upload-status-card { min-height: 230px; padding: 25px !important; align-items: stretch; justify-content: flex-start !important; }
    .upload-status-card:hover { transform: translateY(-5px); }
    .upload-status-card--empty { border-color: #fecaca !important; background: linear-gradient(145deg, #fff7f7 0%, #ffffff 76%) !important; }
    .upload-status-card--partial { border-color: #fed7aa !important; background: linear-gradient(145deg, #fffaf2 0%, #ffffff 76%) !important; }
    .upload-status-card--complete { border-color: #bbf7d0 !important; background: linear-gradient(145deg, #f0fdf4 0%, #ffffff 76%) !important; }
    .upload-progress { height: 9px; overflow: hidden; border-radius: 999px; background: #e9eef6; box-shadow: inset 0 1px 2px rgba(15,23,42,.08); }
    .upload-progress > span { display: block; height: 100%; border-radius: inherit; transition: width .35s ease; }
    .shop-chip { display: inline-flex; align-items: center; min-height: 27px; padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: .01em; }
    .shop-chip--missing { color: #a83b0b; background: #fff7ed; border: 1px solid #fed7aa; }
    .shop-chip--complete { color: #067647; background: #ecfdf3; border: 1px solid #bbf7d0; }
    .dashboard-hero { --hero-x: 0; --hero-y: 0; --hero-light-x: 72%; --hero-light-y: 22%; position: relative; width: 100vw; min-height: clamp(390px, 49vh, 560px); margin-left: calc(50% - 50vw); margin-bottom: 24px; display: flex; align-items: center; overflow: hidden; border-radius: 0 0 34px 34px; border-top: 1px solid rgba(147,197,253,.38); border-bottom: 1px solid rgba(147,197,253,.58); box-shadow: 0 30px 72px rgba(20,53,103,.25), inset 0 1px 0 rgba(255,255,255,.38); isolation: isolate; perspective: 1200px; transform: translateZ(0); }
    .dashboard-hero__scene { position: absolute; inset: -16px; z-index: -4; background-size: cover; background-position: center; transform: translate3d(calc(var(--hero-x) * -10px), calc(var(--hero-y) * -7px), 0) scale(1.045); transition: transform .18s ease-out, filter .3s ease; filter: saturate(1.06) contrast(1.03); will-change: transform; }
    .dashboard-hero__shade { position: absolute; inset: 0; z-index: -3; background: linear-gradient(90deg, rgba(3,21,50,.94) 0%, rgba(5,31,68,.72) 38%, rgba(5,31,68,.15) 69%, rgba(5,31,68,.03) 100%), linear-gradient(0deg, rgba(2,18,42,.43), transparent 48%); }
    .dashboard-hero__light { position: absolute; inset: -35%; z-index: -2; pointer-events: none; background: radial-gradient(circle at var(--hero-light-x) var(--hero-light-y), rgba(255,244,194,.34) 0, rgba(125,211,252,.10) 17%, transparent 38%); mix-blend-mode: screen; transform: translate3d(calc(var(--hero-x) * 18px), calc(var(--hero-y) * 12px), 0); transition: transform .18s ease-out; }
    .dashboard-hero__grid { position: absolute; inset: 0; z-index: -1; opacity: .15; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.10) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(90deg, rgba(0,0,0,.75), transparent 58%); transform: translate3d(calc(var(--hero-x) * 5px), calc(var(--hero-y) * 4px), 0); }
    .dashboard-hero__content { position: relative; width: min(570px, 46vw); margin: 34px 30px 34px max(30px, calc((100vw - 1920px) / 2 + 42px)); padding: 34px 36px; color: #ffffff; border: 1px solid rgba(255,255,255,.22); border-radius: 22px; background: linear-gradient(135deg, rgba(6,31,68,.80), rgba(10,43,86,.40)); box-shadow: 0 24px 52px rgba(2,15,36,.30), inset 0 1px 0 rgba(255,255,255,.10); backdrop-filter: blur(11px); transform: rotateX(calc(var(--hero-y) * -2.5deg)) rotateY(calc(var(--hero-x) * 3.5deg)) translate3d(calc(var(--hero-x) * 7px), calc(var(--hero-y) * 5px), 28px); transition: transform .18s ease-out, background .28s ease, box-shadow .28s ease; transform-style: preserve-3d; will-change: transform; }
    .dashboard-hero:hover .dashboard-hero__content { background: linear-gradient(135deg, rgba(6,31,68,.84), rgba(10,43,86,.46)); box-shadow: 0 28px 60px rgba(2,15,36,.36), inset 0 1px 0 rgba(255,255,255,.14); }
    .dashboard-hero__content::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,.10) 45%, transparent 67%); transform: translateX(calc(var(--hero-x) * 16px)); }
    .dashboard-hero__eyebrow { display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.20); font-size: 10px; font-weight: 950; letter-spacing: .13em; text-transform: uppercase; }
    .dashboard-hero__eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 0 4px rgba(56,189,248,.13); }
    .dashboard-hero__title { margin: 15px 0 10px; max-width: 470px; font-size: clamp(34px, 3.5vw, 54px); line-height: 1.02; letter-spacing: -.045em; }
    .dashboard-hero__copy { max-width: 440px; margin: 0; color: rgba(255,255,255,.84); font-size: 15px; line-height: 1.6; }
    .dashboard-hero__accent { width: 64px; height: 3px; margin-top: 17px; border-radius: 999px; background: linear-gradient(90deg, #38bdf8, rgba(255,255,255,.95)); }
    @media (max-width: 760px) {
      .app-nav { padding: 14px 16px !important; }
      .app-nav__tabs { width: 100%; justify-content: flex-start; overflow-x: auto; flex-wrap: nowrap !important; padding-bottom: 3px; }
      .app-nav__tabs button { flex: 0 0 auto; }
      .app-page { padding: 16px 14px 32px !important; }
      .ui-card { padding: 20px 17px !important; border-radius: 19px !important; }
      .form-section, .form-details { padding: 18px !important; border-radius: 17px !important; }
      .loss-section { padding: 17px 15px !important; }
      .loss-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
      .loss-detail-row { grid-template-columns: 1fr; }
      .dashboard-hero { width: 100vw; min-height: 480px; margin-left: calc(50% - 50vw); align-items: flex-end; border-radius: 0 0 25px 25px; }
      .dashboard-hero__scene { background-position: 61% center; }
      .dashboard-hero__shade { background: linear-gradient(90deg, rgba(4,25,58,.93) 0%, rgba(4,25,58,.67) 68%, rgba(4,25,58,.20) 100%), linear-gradient(0deg, rgba(2,18,42,.45), transparent 48%); }
      .dashboard-hero__content { width: auto; margin: 22px; padding: 24px 22px; backdrop-filter: blur(8px); transform: none; }
      .dashboard-hero__title { font-size: clamp(31px, 10vw, 43px); }
      .dashboard-hero__copy { max-width: 330px; }
    }
    @media (min-width: 1500px) {
      .dashboard-hero { min-height: clamp(440px, 52vh, 620px); }
      .dashboard-summary { padding: 32px 38px !important; }
      .upload-status-card { min-height: 250px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dashboard-hero__scene, .dashboard-hero__light, .dashboard-hero__grid, .dashboard-hero__content { transform: none !important; transition: none !important; }
    }
    tr { transition: background .16s ease; }
    tbody tr:hover { background: #f8fbff; }
    ::selection { background: #bfdbfe; color: #0f172a; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes softPulse { 0%, 100% { box-shadow: 0 14px 26px rgba(37,99,235,.28); } 50% { box-shadow: 0 18px 34px rgba(37,99,235,.42); } }
  `}</style>;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin@2024");
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    const user = USERS.find((u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);
    if (!user) return setError("Invalid username or password.");
    writeJson(LS_KEYS.USER, user);
    onLogin(user);
  }
  return <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
    <GlobalStyle />
    <form onSubmit={submit} style={{ ...S.card, width: "100%", maxWidth: 460 }}>
      <h1 style={{ margin: "0 0 6px", color: "#1d4ed8", fontSize: 34, letterSpacing: "-.04em" }}>TATA MOTORS</h1>
      <div style={{ color: "#172033", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Operations Portal</div>
      <p style={{ ...S.subtle, marginTop: 0 }}>Shop entry → Meeting Excel Sheet → Analytical Sheet.</p>
      {error && <div style={S.error}>{error}</div>}
      <label style={S.label}>Username</label><input style={S.input} value={username} onChange={(e) => setUsername(e.target.value)} />
      <div style={{ height: 12 }} />
      <label style={S.label}>Password</label><input style={S.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", marginTop: 18 }} type="submit">Login</button>
      <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#f2f6fd", color: "#5c6880", fontSize: 12 }}>Admin: <b>admin / Admin@2024</b><br />Rep example: <b>tcf1 / TCF1@2024</b></div>
    </form>
  </div>;
}

function Nav({ user, tab, setTab, onLogout }) {
  const tabs = user.role === "admin"
    ? ["dashboard", "meetingDashboard", "lossData", "dailyReview", "analytics", "settings"]
    : ["submit"];
  const labels = {
    dashboard: "Main Dashboard",
    meetingDashboard: "Data Store",
    lossData: "Loss Data Report",
    dailyReview: "Meeting Sheet",
    analytics: "Analytical Sheet",
    settings: "Settings",
    submit: "Input Form",
  };
  return <div className="app-nav" style={S.nav}>
    <div><div style={S.brand}>TATA MOTORS Operations Portal</div><div style={{ ...S.subtle, fontSize: 11 }}>{user.role === "admin" ? "Admin Console" : `${user.shop} · All shifts`}</div></div>
    <div className="app-nav__tabs" style={S.tabs}>{tabs.map((item) => <button key={item} onClick={() => setTab(item)} style={S.tabBtn(tab === item)}>{labels[item]}</button>)}<button onClick={() => window.open('/production_dashboard.html', '_blank')} style={{ ...S.btn("warning"), background: "linear-gradient(135deg, #c9a227 0%, #e8c14a 100%)", color: "#1a1000", border: "1px solid #c9a227", boxShadow: "0 12px 22px rgba(201,162,39,.30)", display: "inline-flex", alignItems: "center", gap: 7 }}><BarChart3 size={14} /> Production Intelligence</button><button onClick={onLogout} style={S.btn("danger")}><LogOut size={14} /> Logout</button></div>
  </div>;
}

function StatusLine({ gasUrl, lastSync, syncError, onRefresh, syncing }) {
  const [tick, setTick] = useState(0);
  // Count down to the next 30-second background refresh.
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  const secsAgo = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 1000) : null;
  const nextRefreshIn = lastSync ? Math.max(0, 30 - ((secsAgo || 0) % 30)) : null;
  return <div className="status-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, padding: "12px 16px", background: "rgba(255,255,255,0.9)", borderRadius: 14, border: "1px solid #e2e9f5", boxShadow: "0 6px 16px rgba(40,73,118,.08)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {gasUrl ? <span style={S.badge("green")}>● Live</span> : <span style={S.badge("orange")}>⚠ Backend URL not configured</span>}
      {syncing && <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>↻ Syncing…</span>}
      {lastSync && !syncing && <span style={{ fontSize: 12, color: "#63708a" }}>Last sync: {new Date(lastSync).toLocaleTimeString()} · {secsAgo < 5 ? "just now" : `${secsAgo}s ago`}</span>}
      {nextRefreshIn !== null && !syncing && <span style={{ fontSize: 11, color: "#94a3b8" }}>Auto-refresh in {nextRefreshIn}s</span>}
      {syncError && <span style={{ fontSize: 12, color: "#e11d48", fontWeight: 700 }}>⚠ {syncError}</span>}
    </div>
    <button onClick={onRefresh} style={{ ...S.btn(), padding: "7px 14px" }}><RefreshCw size={14} /> Refresh Now</button>
  </div>;
}

function MetricCard({ label, value, tone = "default" }) {
  return <div className={`metric-card metric-card--${tone}`} style={S.stat}><div className="metric-value" style={S.statV}>{value ?? 0}</div><div style={S.statL}>{label}</div></div>;
}

function RepSubmit({ user, gasUrl, entries, setEntries, onRefresh }) {
  const cfg = shopConfig(user.shop);
  const suggested = getSuggestedDateShift();
  const [form, setForm] = useState(() => {
    const initialShift = suggested.shift;
    const existing = entries.find((e) => e.date === suggested.date && e.shop === user.shop && e.shift === initialShift);
    const hourlyActual = editableHourlyActual(existing?.hourlyActual, initialShift);
    return { ...normalizeEntry({
      date: suggested.date, shop: user.shop, shift: initialShift, repName: user.repName,
      actualProduction: existing?.actualProduction || "",
      pr: existing?.pr ?? 1, qr: existing?.qr ?? getFixedQR(user.shop), bdOccurrence: existing?.bdOccurrence || "",
      affectedDTmin: existing?.affectedDTmin || "",
      grossDTmin: existing?.grossDTmin || "",
      ...Object.fromEntries(LOSS_CATEGORIES.map(({ key }) => [key, existing?.[key] || ""])),
      lossDetails: existing?.lossDetails || {},
      hourlyActual,
      majorBreakdown: existing?.majorBreakdown || "", safetyIssue: existing?.safetyIssue || "", sparesConsumed: existing?.sparesConsumed || "",
    }), hourlyActual };
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedLoss, setExpandedLoss] = useState({});
  const selectedShift = normalizeShift(form.shift) || availableShiftIds(form.date)[0] || "A";
  const slots = HOUR_SLOTS[selectedShift] || [];
  const selectedExisting = entries.find((e) => e.date === dateOnly(form.date) && e.shop === user.shop && e.shift === selectedShift);
  const canEditSelected = !selectedExisting || isEditAllowed(selectedExisting.date, selectedExisting.shift);
  const shiftAllowed = isShiftAvailableOnDate(form.date, selectedShift);
  const calculatedTimeAvailable = calculatedAvailableTime(selectedShift, form.hourlyActual);
  const activeCycleTimeSec = configuredNumber(form.cycleTimeSec, cfg.cycleTimeSec);
  const activeGrossDTTarget = configuredNumber(form.grossDTTarget, cfg.grossDTTarget);
  const shopLossCategories = lossCategoriesForShop(user.shop);
  const allocatableLossCategories = shopLossCategories;
  const manuallyAllocatedLoss = allocatableLossCategories.reduce((sum, item) => sum + toNumber(form[item.key]), 0);
  const plan = defaultHourlyPlan(plannedCapacity(selectedShift, activeCycleTimeSec), selectedShift);
  const shiftsForDate = availableShiftIds(form.date);

  function loadFormFor(dateValue, shiftValue) {
    const cleanDate = dateOnly(dateValue);
    const cleanShift = isShiftAvailableOnDate(cleanDate, shiftValue) ? normalizeShift(shiftValue) : availableShiftIds(cleanDate)[0] || "A";
    const found = entries.find((e) => e.date === cleanDate && e.shop === user.shop && e.shift === cleanShift);
    const hourlyActual = editableHourlyActual(found?.hourlyActual, cleanShift);
    if (found) setForm({ ...normalizeEntry({ ...found, hourlyActual, repName: found.repName || user.repName }), hourlyActual });
    else setForm({ ...normalizeEntry({ date: cleanDate, shop: user.shop, shift: cleanShift, repName: user.repName, pr: 1, qr: getFixedQR(user.shop), hourlyActual }), hourlyActual });
  }
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function changeDate(value) { loadFormFor(value, selectedShift); }
  function changeShift(value) { loadFormFor(form.date, value); }
  function changeHourly(index, value) { setForm((current) => { const next = [...(current.hourlyActual || [])]; next[index] = value; return { ...current, hourlyActual: next }; }); }
  function changeLossValue(key, value) {
    setForm((current) => {
      const details = normalizeLossDetails(current.lossDetails);
      if (toNumber(value) > 0 && !(details[key] || []).length) {
        details[key] = [{ machine: "", minutes: "", remarks: "" }];
      }
      return { ...current, [key]: value, lossDetails: details };
    });
    if (toNumber(value) > 0) setExpandedLoss((current) => ({ ...current, [key]: true }));
  }
  function changeLossDetail(key, index, field, value) {
    setForm((current) => {
      const details = normalizeLossDetails(current.lossDetails);
      const rows = [...(details[key] || [])];
      rows[index] = { ...(rows[index] || { machine: "", minutes: "", remarks: "" }), [field]: value };
      return { ...current, lossDetails: { ...details, [key]: rows } };
    });
  }
  function addLossDetail(key) {
    setForm((current) => {
      const details = normalizeLossDetails(current.lossDetails);
      return { ...current, lossDetails: { ...details, [key]: [...(details[key] || []), { machine: "", minutes: "", remarks: "" }] } };
    });
    setExpandedLoss((current) => ({ ...current, [key]: true }));
  }
  function removeLossDetail(key, index) {
    setForm((current) => {
      const details = normalizeLossDetails(current.lossDetails);
      return { ...current, lossDetails: { ...details, [key]: (details[key] || []).filter((_, rowIndex) => rowIndex !== index) } };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setMessage(""); setError("");
    let payload;
    try {
      if (!form.date) throw new Error("Date is required.");
      if (!selectedShift) throw new Error("Shift is required.");
      if (!isShiftAvailableOnDate(form.date, selectedShift)) throw new Error(`Shift ${selectedShift} is not available for ${form.date}. Sunday has only Shift A/B and Monday has no Shift C.`);
      if (form.actualProduction === "") throw new Error("Actual Production is required.");
      if (form.affectedDTmin === "") throw new Error("Affected DT(min) is required.");
      if (form.grossDTmin === "") throw new Error("Gross DT (min) is required.");
      if (form.bdOccurrence === "") throw new Error("BD occurance is required.");
      const affectedDtMinVal = toNumber(form.affectedDTmin);
      const failureCount = toNumber(form.bdOccurrence);
      for (const loss of allocatableLossCategories) {
        const categoryMinutes = toNumber(form[loss.key]);
        if (categoryMinutes <= 0) continue;
        const rows = form.lossDetails?.[loss.key] || [];
        const fieldConfig = lossDetailFieldConfig(loss.key);
        if (!rows.length) throw new Error(`Add detail rows for ${loss.label}.`);
        if (rows.some((row) => !toText(row.machine).trim() || toNumber(row.minutes) <= 0)) {
          throw new Error(`Complete the ${fieldConfig.label} and Time fields for ${loss.label}.`);
        }
        if (fieldConfig.hasRemark && rows.some((row) => !toText(row.remarks).trim())) {
          throw new Error(`Enter the Fault / Remark for each ${loss.label} detail.`);
        }
        const detailedMinutes = lossDetailTotal(form.lossDetails, loss.key);
        if (Math.abs(detailedMinutes - categoryMinutes) > 0.01) {
          throw new Error(`${loss.label} sum is not matching with the input row wise sum.`);
        }
      }
      if (affectedDtMinVal > 0 && failureCount <= 0) throw new Error("Enter BD occurance when Affected DT(min) is greater than 0.");
      if (!gasUrl) throw new Error("Google Apps Script URL is missing. Add it in Settings or .env first.");
      if (selectedExisting && !canEditSelected) throw new Error(`Editing is locked for this report. Deadline was ${deadlineLabel(selectedExisting.date, selectedExisting.shift)}.`);
      const now = new Date().toISOString();
      payload = normalizeEntry({ ...form, shift: selectedShift, timeAvailable: calculatedTimeAvailable, cycleTimeSec: activeCycleTimeSec, grossDTTarget: activeGrossDTTarget, hourlyPlan: plan, submittedBy: user.username, submittedAt: selectedExisting?.submittedAt || now, lastUpdatedAt: now });

    } catch (err) {
      setError(err.message || String(err)); setSaving(false); return;
    }

    const optimisticEntries = upsertLocal(entries, payload);
    setEntries(optimisticEntries);
    writeJson(LS_KEYS.ENTRIES, optimisticEntries);
    setMessage("⏳ Saving to Google Sheets…");

    try {
      const result = await apiPost(gasUrl, { action: "saveReport", report: payload });
      const confirmedEntry = normalizeEntry(result.entry || payload);
      const confirmedEntries = upsertLocal(optimisticEntries, confirmedEntry);
      setEntries(confirmedEntries);
      writeJson(LS_KEYS.ENTRIES, confirmedEntries);
      setMessage(result.rebuildWarning
        ? `✅ ${result.mode === "updated" ? "Updated" : "Saved"} in Google Sheets. ${result.rebuildWarning}`
        : `✅ ${result.mode === "updated" ? "Updated" : "Saved"} in Google Sheets! Dashboards updated.`);

      if (onRefresh) { try { await onRefresh(); } catch (_) {} }
    } catch (err) {
      setMessage("");
      setError(`⚠️ Saved locally but failed to reach Google Sheets: ${err.message}. Check your GAS URL in Settings.`);
    } finally { setSaving(false); }
  }

  return <div className="ui-card feature-card" style={S.card}>
    <h2 style={S.title}>Shop Data Entry</h2>
    <p style={S.subtle}>{cfg.displayName} · {SHIFT_TIME[selectedShift] || "Select shift"}.</p>
    {message && <div style={S.ok}>{message}</div>}{error && <div style={S.error}>{error}</div>}
    {!shiftAllowed && <div style={S.error}>Shift {selectedShift} is not available for this date. Choose one of: {shiftsForDate.join(", ")}.</div>}
    {selectedExisting && canEditSelected && <div style={{ ...S.ok, background: "#fffbeb", borderColor: "#fbbf24", color: "#92400e" }}>A report already exists for this Date + Shop + Shift. Submitting again updates the same report. Edit deadline: {deadlineLabel(selectedExisting.date, selectedExisting.shift)}.</div>}
    {selectedExisting && !canEditSelected && <div style={S.error}>This report is locked because the next available shift has already ended. Deadline was {deadlineLabel(selectedExisting.date, selectedExisting.shift)}.</div>}
    <form onSubmit={submit}>
      <div style={S.grid(210)}>
        <div><label style={S.label}>Date</label><input style={S.input} type="date" value={form.date} onChange={(e) => changeDate(e.target.value)} /></div>
        <div><label style={S.label}>Shop</label><input style={S.input} value={cfg.displayName} disabled /></div>
        <div><label style={S.label}>Shift</label><select style={S.input} value={selectedShift} onChange={(e) => changeShift(e.target.value)}>{shiftsForDate.map((shift) => <option key={shift} value={shift}>Shift {shift} / {shiftCode(shift)} · {SHIFT_TIME[shift]}</option>)}</select></div>
        <div><label style={S.label}>Representative</label><input style={S.input} value={form.repName} onChange={(e) => change("repName", e.target.value)} /></div>
        <div><label style={S.label}>Cycle time (sec)</label><input style={S.input} value={activeCycleTimeSec} disabled /></div>
        <div><label style={S.label}>Gross DT Target/month (min)</label><input style={S.input} value={activeGrossDTTarget} disabled /></div>
        <div><label style={S.label}>Actual Production *</label><input style={S.input} type="number" value={form.actualProduction} onChange={(e) => change("actualProduction", e.target.value)} /></div>
      </div>

      <div className="form-section" style={{ marginTop: 20, padding: 18, border: "2px solid #bfdbfe", borderRadius: 18, background: "linear-gradient(135deg, #eff6ff, #ffffff)" }}>
        <div style={S.cardTitle}>Maintenance Reliability Inputs</div>
        <div style={{ ...S.grid(210), marginTop: 14 }}>
          <div><label style={S.label}>Affected DT(min) *</label><input style={S.input} type="number" min="0" value={form.affectedDTmin} onChange={(e) => change("affectedDTmin", e.target.value)} placeholder="Example: 60" /></div>
          <div><label style={S.label}>Gross DT (min) *</label><input style={S.input} type="number" min="0" value={form.grossDTmin} onChange={(e) => change("grossDTmin", e.target.value)} placeholder="Example: 60" /></div>
          <div><label style={S.label}>BD occurance *</label><input style={S.input} type="number" min="0" step="1" value={form.bdOccurrence} onChange={(e) => change("bdOccurrence", e.target.value)} placeholder="Example: 2" /></div>
        </div>
      </div>

      <div className="form-section" style={{ marginTop: 20, padding: 18, border: "2px solid #bbf7d0", borderRadius: 18, background: "linear-gradient(135deg, #f0fdf4, #ffffff)" }}>
        <div style={S.cardTitle}>Hourly Production chart</div>
        <div style={{ ...S.tableWrap, marginTop: 14 }}><table style={{ ...S.table, minWidth: 940 }}><thead><tr><th style={S.th}>Hours</th>{slots.map((slot) => <th key={slot} style={S.th}>{slot}</th>)}<th style={S.th}>Total</th></tr></thead><tbody><tr><td style={S.td}>Plan</td>{plan.map((v, i) => <td key={i} style={S.td}>{v}</td>)}<td style={S.td}>{plan.reduce((a, b) => a + b, 0)}</td></tr><tr><td style={S.td}>Actual</td>{slots.map((slot, i) => <td key={slot} style={S.td}><input style={{ ...S.input, minWidth: 80 }} type="number" value={form.hourlyActual?.[i] ?? ""} onChange={(e) => changeHourly(i, e.target.value)} /></td>)}<td style={S.td}>{(form.hourlyActual || []).reduce((a, b) => a + toNumber(b), 0)}</td></tr></tbody></table></div>
      </div>

      <div className="form-section loss-section" style={{ marginTop: 20, padding: 18, border: "1px solid #fed7aa", borderRadius: 18, background: "#fffdfa" }}>
        <div style={{ ...S.cardTitle, marginBottom: 0 }}>Loss Time Distribution (Min)</div>
        <div className="loss-grid">
          {allocatableLossCategories.map((loss) => {
            const categoryMinutes = toNumber(form[loss.key]);
            const rows = form.lossDetails?.[loss.key] || [];
            const detailedMinutes = lossDetailTotal(form.lossDetails, loss.key);
            const isExpanded = Boolean(expandedLoss[loss.key]);
            const matches = Math.abs(detailedMinutes - categoryMinutes) <= 0.01;
            return (
              <div className="loss-input-card" key={loss.key} style={{ gridColumn: isExpanded ? "1 / -1" : "auto" }}>
                <label style={S.label}>{loss.label}</label>
                <input style={S.input} type="number" min="0" value={form[loss.key] ?? ""} onChange={(e) => changeLossValue(loss.key, e.target.value)} />
                {categoryMinutes > 0 && (
                  <button className="loss-detail-toggle" type="button" onClick={() => setExpandedLoss((current) => ({ ...current, [loss.key]: !isExpanded }))}>
                    <span>{rows.length ? `${rows.length} usage detail${rows.length === 1 ? "" : "s"}` : "Add usage details"}</span>
                    <ChevronDown size={17} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .18s ease" }} />
                  </button>
                )}
                {categoryMinutes > 0 && isExpanded && (
                  <div className="loss-detail-panel">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={S.cardTitle}>{loss.label} Usage Details</div>
                      </div>
                      <button type="button" style={S.btn()} onClick={() => addLossDetail(loss.key)}><Plus size={15} /> Add Row</button>
                    </div>
                    {rows.map((row, index) => {
                      const fieldConfig = lossDetailFieldConfig(loss.key);
                      return (
                        <div className="loss-detail-row" key={`${loss.key}-${index}`} style={{ gridTemplateColumns: fieldConfig.hasRemark ? "minmax(190px, 1.1fr) minmax(130px, .45fr) minmax(220px, 1.4fr) auto" : "minmax(260px, 1.5fr) minmax(130px, .45fr) auto" }}>
                          <div><label style={S.label}>{fieldConfig.label} *</label><input style={S.input} value={row.machine ?? ""} onChange={(e) => changeLossDetail(loss.key, index, "machine", e.target.value)} placeholder={fieldConfig.placeholder} /></div>
                          <div><label style={S.label}>Time (Min) *</label><input style={S.input} type="number" min="0" value={row.minutes ?? ""} onChange={(e) => changeLossDetail(loss.key, index, "minutes", e.target.value)} /></div>
                          {fieldConfig.hasRemark && <div><label style={S.label}>{fieldConfig.remarkLabel} *</label><input style={S.input} value={row.remarks ?? ""} onChange={(e) => changeLossDetail(loss.key, index, "remarks", e.target.value)} placeholder={fieldConfig.remarkPlaceholder} /></div>}
                          <button type="button" aria-label={`Remove ${loss.label} detail ${index + 1}`} style={{ ...S.btn("danger"), minWidth: 46, padding: 11 }} onClick={() => removeLossDetail(loss.key, index)}><Trash2 size={16} /></button>
                        </div>
                      );
                    })}
                    <div className="loss-detail-summary" style={{ color: matches ? "#166534" : "#9f1239", background: matches ? "#f0fdf4" : "#fff1f2", border: `1px solid ${matches ? "#bbf7d0" : "#fecdd3"}` }}>
                      <span>Entered Loss: <strong>{categoryMinutes} min</strong></span>
                      <span>Detailed Time: <strong>{detailedMinutes} min</strong></span>
                      <span>{matches ? "Matched" : `${Math.abs(categoryMinutes - detailedMinutes)} min remaining`}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="loss-allocation-summary" style={{ ...S.ok, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
          <span className="loss-summary-item">Reported loss categories <strong>{manuallyAllocatedLoss} min</strong></span>
        </div>
      </div>

      <div className="form-details"><div style={S.cardTitle}>Details</div><div style={S.grid(300)}><div><label style={S.label}>Safety Issue</label><textarea rows={5} style={{ ...S.input, resize: "vertical" }} value={form.safetyIssue} onChange={(e) => change("safetyIssue", e.target.value)} /></div><div><label style={S.label}>Spares Consumed</label><textarea rows={5} style={{ ...S.input, resize: "vertical" }} value={form.sparesConsumed} onChange={(e) => change("sparesConsumed", e.target.value)} /></div></div></div>

      <button className="primary-action" disabled={saving || !canEditSelected || !shiftAllowed} style={{ ...S.btn("primary"), marginTop: 22, opacity: saving || !canEditSelected || !shiftAllowed ? 0.6 : 1 }} type="submit"><UploadCloud size={15} /> {saving ? "Saving..." : selectedExisting ? "Update Corrected Data" : "Submit Data"}</button>
    </form>
  </div>;
}

function DataTable({ rows, columns, title, emptyText = "No data found." }) {
  return <div className="ui-card" style={S.card}><div style={S.cardTitle}><FileSpreadsheet size={16} /> {title}</div><div style={S.tableWrap}><table style={S.table}><thead><tr>{columns.map((c) => <th key={c.key} style={S.th}>{c.label}</th>)}</tr></thead><tbody>{!rows.length && <tr><td style={S.td} colSpan={columns.length}>{emptyText}</td></tr>}{rows.map((row, i) => <tr key={row.id || row.key || i}>{columns.map((c) => <td key={c.key} style={S.td}>{row[c.key] ?? ""}</td>)}</tr>)}</tbody></table></div></div>;
}

function MeetingBlock({ entry }) {
  const e = normalizeEntry(entry);
  const lossCategories = lossCategoriesForShop(e.shop);
  const lossCell = (index) => {
    const loss = lossCategories[index];
    return loss ? <><td style={cell}>{loss.label}</td><td style={cell} colSpan={2}>{e[loss.key]}</td></> : <td style={{ border: "none", background: "#f3f4f7" }} colSpan={3}></td>;
  };
  const slots = HOUR_SLOTS[e.shift] || [];
  const plan = normalizeHourlyArray(
    e.hourlyPlan,
    e.shift,
    plannedCapacity(e.shift, e.cycleTimeSec),
  );
  const actual = normalizeHourlyArray(e.hourlyActual, e.shift, 0);
  const actualTotal = actual.reduce((a, b) => a + b, 0);
  const efficiency = plan.map((p, i) => (p ? Math.round((actual[i] / p) * 100) : 0));
  const lossUsageRows = lossCategories.flatMap((loss) =>
    (e.lossDetails?.[loss.key] || []).map((detail, index) => ({
      id: `${loss.key}-${index}`,
      category: loss.label,
      machine: detail.machine,
      minutes: toNumber(detail.minutes),
      remarks: detail.remarks,
    }))
  );
  const lossUsageGroups = lossCategories
    .map((loss) => ({
      key: loss.key,
      label: loss.label,
      rows: lossUsageRows.filter((detail) => detail.category === loss.label),
    }))
    .filter((group) => group.rows.length);
  const tableStyle = { borderCollapse: "collapse", background: "#f7f7f7", color: "#111", fontFamily: "Georgia, serif", fontWeight: 700 };
  const cell = { border: "1px solid #999", padding: "7px 8px", verticalAlign: "middle" };
  const yellow = { background: "#fffec5" };
  return <div style={{ ...S.card, background: "#f3f4f7", color: "#111", overflowX: "auto" }}>
    <table style={{ ...tableStyle, minWidth: 1100 }}>
      <tbody>
        <tr><td style={{ ...cell, background: "#fff200" }}>For Date</td><td style={{ ...cell, ...yellow, textAlign: "center" }} colSpan={3}>{meetingDate(e.date)}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td><td style={{ ...cell, fontSize: 17, textAlign: "center" }} colSpan={2}>Loss Time summary</td><td style={{ ...cell, textAlign: "center" }}>DT<br />(Min)</td></tr>
        <tr><td style={{ ...cell, background: "#e2edf7" }}>Shop</td><td style={cell} colSpan={3}>{e.shopDisplayName}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(0)}</tr>
        <tr><td style={{ ...cell, background: "#dbe8f4" }}>Shift</td><td style={{ ...cell, background: "#dbe8f4" }} colSpan={3}>{e.shift}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(1)}</tr>
        <tr><td style={{ border: "none", background: "#f3f4f7", height: 20 }} colSpan={9}></td></tr>
        <tr><td style={{ ...cell, textAlign: "center" }} colSpan={2}>Production</td><td style={{ ...cell, textAlign: "center" }} colSpan={2}>Day</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(2)}</tr>
        <tr><td style={cell} colSpan={2}>Capacity</td><td style={{ ...cell, ...yellow, textAlign: "center" }} colSpan={2}>{e.capacity}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(3)}</tr>
        <tr><td style={cell} colSpan={2}>Cycle Time in Sec.</td><td style={{ ...cell, ...yellow, textAlign: "center" }} colSpan={2}>{e.cycleTimeSec}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(4)}</tr>
        <tr><td style={cell} colSpan={2}>Actual Prod. Nos.</td><td style={{ ...cell, textAlign: "center", fontSize: 18 }} colSpan={2}>{e.actualProduction}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(5)}</tr>
        <tr><td style={cell} colSpan={2}>{e.shop} Production Loss</td><td style={{ ...cell, textAlign: "center" }} colSpan={2}>{e.productionLoss}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(6)}</tr>
        <tr><td style={cell} colSpan={2}>Loss Time in Min</td><td style={{ ...cell, textAlign: "center" }} colSpan={2}>{e.lossTime}</td><td style={{ border: "none", background: "#f3f4f7" }} colSpan={2}></td>{lossCell(7)}</tr>
        {lossCategories.slice(8).map((loss) => <tr key={loss.key}><td style={{ border: "none", background: "#f3f4f7" }} colSpan={6}></td><td style={cell}>{loss.label}</td><td style={cell} colSpan={2}>{e[loss.key]}</td></tr>)}
        <tr><td style={{ border: "none", background: "#f3f4f7" }} colSpan={6}></td><td style={{ ...cell, textAlign: "right" }}>Total</td><td style={cell} colSpan={2}>{e.lossTime}</td></tr>
        <tr><td style={{ border: "none", background: "#f3f4f7", height: 26 }} colSpan={9}></td></tr>
        <tr><td style={{ border: "none", background: "#f3f4f7", fontWeight: 900 }} colSpan={9}>Hourly Production Chart</td></tr>
        <tr><td style={cell}>Hours</td>{slots.map((slot) => <td key={slot} style={{ ...cell, textAlign: "center" }}>{slot}</td>)}<td style={cell}>Total</td></tr>
        <tr><td style={cell}>Plan</td>{plan.map((v, i) => <td key={i} style={{ ...cell, ...yellow, textAlign: "center" }}>{v}</td>)}<td style={cell}>{plan.reduce((a, b) => a + b, 0)}</td></tr>
        <tr><td style={cell}>Actual</td>{actual.map((v, i) => <td key={i} style={{ ...cell, ...yellow, textAlign: "center" }}>{v}</td>)}<td style={cell}>{actualTotal || e.actualProduction}</td></tr>
        <tr><td style={cell}>Efficient</td>{efficiency.map((v, i) => <td key={i} style={{ ...cell, ...yellow, textAlign: "center" }}>{v}%</td>)}<td style={cell}>{e.lePct}%</td></tr>
        <tr><td style={{ border: "none", background: "#f3f4f7", height: 24 }} colSpan={9}></td></tr>
        <tr><td style={{ ...cell, fontWeight: 900 }} colSpan={2}>Breakdown / Remarks</td><td style={{ ...cell, whiteSpace: "pre-wrap", fontWeight: 600 }} colSpan={7}>{e.majorBreakdown || "—"}</td></tr>
        {lossUsageGroups.length > 0 && <>
          <tr><td style={{ border: "none", background: "#f3f4f7", height: 24 }} colSpan={9}></td></tr>
          <tr><td style={{ ...cell, fontSize: 17, background: "#f3f4f7" }} colSpan={9}>Loss Time Summary in Min</td></tr>
          <tr>
            <td style={{ ...cell, textAlign: "center" }} colSpan={3}>Category</td>
            <td style={{ ...cell, textAlign: "center" }}>Min</td>
            <td style={{ ...cell, textAlign: "center" }} colSpan={5}>Major Reasons Today</td>
          </tr>
          {lossUsageGroups.flatMap((group) => [
            <tr key={`${group.key}-heading`}><td style={{ ...cell, background: "#dbe8f4", textAlign: "center" }} colSpan={9}>{group.label}</td></tr>,
            ...group.rows.map((detail) => (
              <tr key={detail.id}>
                <td style={cell} colSpan={3}>{detail.machine}</td>
                <td style={{ ...cell, ...yellow, textAlign: "center" }}>{detail.minutes}</td>
                <td style={{ ...cell, ...yellow, whiteSpace: "pre-wrap", fontWeight: 600 }} colSpan={5}>{detail.remarks || detail.machine}</td>
              </tr>
            )),
          ])}
          <tr>
            <td style={{ ...cell, background: "#bdd7ee", textAlign: "right" }} colSpan={3}>Total</td>
            <td style={{ ...cell, background: "#bdd7ee", textAlign: "center" }}>{lossUsageRows.reduce((sum, detail) => sum + detail.minutes, 0)}</td>
            <td style={{ ...cell, background: "#bdd7ee" }} colSpan={5}></td>
          </tr>
        </>}
      </tbody>
    </table>
  </div>;
}

// ── CUMULATIVE MEETING TABLE ──────────────────────────────────
function MeetingCumulativeTable({ entries, selectedDate }) {
  // Aggregate per shop for one operational day: Shift C, then A, then B.
  const rows = useMemo(() => {
    const map = {};
    entries.map(normalizeEntry).forEach((e) => {
      if (!map[e.shop]) {
        map[e.shop] = {
          shop: e.shopDisplayName || e.shop,
          reports: 0,
          capacity: 0,
          actualProduction: 0,
          productionLoss: 0,
          lossTime: 0,
          affectedDowntime: 0,
          availableTime: 0,
          bdOccurrence: 0,
          oePctTotal: 0,
          lePctTotal: 0,
        };
        LOSS_CATEGORIES.forEach((l) => { map[e.shop][l.key] = 0; });
      }
      const r = map[e.shop];
      r.reports++;
      r.capacity += toNumber(e.capacity);
      r.actualProduction += toNumber(e.actualProduction);
      r.productionLoss += toNumber(e.productionLoss);
      r.lossTime += toNumber(e.lossTime);
      r.affectedDowntime += toNumber(e.affectedDowntime);
      r.availableTime += toNumber(e.timeAvailable);
      r.bdOccurrence += toNumber(e.bdOccurrence);
      r.oePctTotal += toNumber(e.oePct);
      r.lePctTotal += toNumber(e.lePct);
      LOSS_CATEGORIES.forEach((l) => { r[l.key] += toNumber(e[l.key]); });
    });
    return Object.values(map).map((r) => ({
      ...r,
      avgOe: r.reports ? round2(r.oePctTotal / r.reports) : 0,
      avgLe: r.reports ? round2(r.lePctTotal / r.reports) : 0,
      mttr: r.bdOccurrence ? round2(r.affectedDowntime / r.bdOccurrence) : 0,
    }));
  }, [entries]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.reports += r.reports; acc.capacity += r.capacity;
    acc.actualProduction += r.actualProduction; acc.productionLoss += r.productionLoss;
    acc.lossTime += r.lossTime; acc.bdOccurrence += r.bdOccurrence;
    LOSS_CATEGORIES.forEach((l) => { acc[l.key] = (acc[l.key] || 0) + r[l.key]; });
    return acc;
  }, { reports: 0, capacity: 0, actualProduction: 0, productionLoss: 0, lossTime: 0, bdOccurrence: 0 }), [rows]);

  const cols = [
    { key: "shop", label: "Shop" },
    { key: "reports", label: "Reports" },
    { key: "capacity", label: "Capacity (Total)" },
    { key: "actualProduction", label: "Actual Production" },
    { key: "productionLoss", label: "Production Loss" },
    { key: "lossTime", label: "Loss Time (Min)" },
    ...LOSS_CATEGORIES.map((l) => ({ key: l.key, label: l.label })),
    { key: "bdOccurrence", label: "BD Occurrence" },
    { key: "avgOe", label: "Avg OE %" },
    { key: "avgLe", label: "Avg LE %" },
    { key: "mttr", label: "MTTR (Min)" },
  ];

  return (
    <div className="ui-card feature-card" style={S.card}>
      <div style={S.cardTitle}>
        <FileSpreadsheet size={16} /> Cumulative Meeting Data — {meetingDate(selectedDate)} · Shift C → A → B
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>{cols.map((c) => <th key={c.key} style={S.th}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.shop}>
                {cols.map((c) => <td key={c.key} style={S.td}>{r[c.key] ?? 0}</td>)}
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ background: "#e8eaf6", fontWeight: 900 }}>
              {cols.map((c) => (
                <td key={c.key} style={{ ...S.td, fontWeight: 900, background: "#e8eaf6" }}>
                  {c.key === "shop" ? "TOTAL" : (c.key === "avgOe" || c.key === "avgLe" || c.key === "mttr") ? "—" : (totals[c.key] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MeetingDashboard({ entries, user }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedShop, setSelectedShop] = useState(user.role === "admin" ? "ALL" : user.shop);
  const [viewMode, setViewMode] = useState("single"); // "single" | "cumulative"

  const filtered = entries.map(normalizeEntry).filter((e) =>
    (!selectedDate || e.date === selectedDate) &&
    (selectedShop === "ALL" || e.shop === selectedShop)
  );

  // One operational day contains Shift C from the preceding night, followed by A and B.
  // Shift C is stored against the date on which it finishes, so all three share selectedDate.
  const cumulativeEntries = entries.map(normalizeEntry).filter((e) =>
    e.date === selectedDate &&
    (selectedShop === "ALL" || e.shop === selectedShop)
  );

  return <>
    <div className="ui-card" style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <h2 style={S.title}>Loss and Meeting Data</h2>
          <p style={S.subtle}>Block-style meeting format with hourly charts. Cumulative shows only the selected operational day in Shift C → A → B order.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          {/* View mode toggle */}
          <div>
            <label style={S.label}>View</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setViewMode("single")} style={S.tabBtn(viewMode === "single")}>Single Entry</button>
              <button onClick={() => setViewMode("cumulative")} style={S.tabBtn(viewMode === "cumulative")}>Cumulative (All Shops)</button>
            </div>
          </div>
          <div><label style={S.label}>{viewMode === "cumulative" ? "Operational Day" : "Date"}</label>
            <input style={S.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          {user.role === "admin" && (
            <div><label style={S.label}>Shop</label>
              <select style={{ ...S.input, minWidth: 170 }} value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
                <option value="ALL">All Shops</option>
                {SHOPS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {/* Export button for single view */}
          {viewMode === "single" && filtered.length > 0 && (
            <div>
              <label style={S.label}>Export</label>
              <button style={S.btn("success")} onClick={() => exportMeetingWorkbook(entries, filtered[0])}>
                <Download size={14} /> Export Block
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {viewMode === "single" ? (
      <>
        {!filtered.length && <div style={S.card}>No meeting block found for the selected filters.</div>}
        {filtered.map((entry) => <MeetingBlock key={entry.id || buildKey(entry)} entry={entry} />)}
      </>
    ) : (
      <MeetingCumulativeTable entries={cumulativeEntries} selectedDate={selectedDate} />
    )}
  </>;
}

function buildDailyReviewRows(entries, meetingDate, selectedShift = "all") {
  const reportDate = getYesterdayDateStr(meetingDate);
  // Exact shop order from screenshot
  const order = [
    { shop: "TCF1", name: "TCF-1" },
    { shop: "TCF2", name: "TCF-2" },
    { shop: "PAINT", name: "Paint" },
    { shop: "PRESS", name: "Press" },
    { shop: "X4", name: "X4 BIW" },
    { shop: "Q5", name: "Q5 BIW" },
    { shop: "X1", name: "X1 BIW" },
    { shop: "NOVA", name: "Nova BIW" },
    { shop: "ENGINE", name: "Engine" },
    { shop: "TA64", name: "TA" },
    { shop: "TA78", name: "CPED" }
  ];

  return order.map((item, index) => {
    const targetShifts = selectedShift === "all" ? availableShiftIds(meetingDate) : [selectedShift];
    const productionTarget = targetShifts.reduce(
      (total, shift) => total + plannedCapacity(shift, shopConfig(item.shop).cycleTimeSec),
      0
    );
    const shopEntries = entries.map(normalizeEntry).filter((e) => {
      if (e.date !== reportDate || e.shop !== item.shop) return false;
      if (selectedShift !== "all" && e.shift !== selectedShift) return false;
      return true;
    });

    if (shopEntries.length === 0) {
      return {
        id: `empty-${item.shop}`,
        sn: index + 1,
        shop: item.name,
        safetyIssue: "Nil",
        productionTarget,
        yesterdayActualProduction: "",
        affectedDowntime: "",
        grossDowntime: "",
        affectedDowntimeOccurrence: "",
        totalDownTime: 0,
        majorBreakdown: "",
        sparesConsumed: "No",
      };
    }

    let safetyIssues = [];
    let actuals = 0;
    let affectedDt = 0;
    let grossDt = 0;
    let occurrences = 0;
    let breakdowns = [];
    let spares = [];

    shopEntries.forEach((e) => {
      const safetyIssue = toText(e.safetyIssue).trim();
      const majorBreakdown = toText(e.majorBreakdown).trim();
      const sparesConsumed = toText(e.sparesConsumed).trim();
      if (safetyIssue && safetyIssue.toLowerCase() !== "nil") {
        safetyIssues.push(safetyIssue);
      }
      actuals += toNumber(e.actualProduction);
      affectedDt += toNumber(e.affectedDowntime);
      grossDt += toNumber(e.grossDowntime);
      occurrences += toNumber(e.bdOccurrence);
      if (majorBreakdown) {
        breakdowns.push(majorBreakdown);
      }
      if (sparesConsumed && sparesConsumed.toLowerCase() !== "no") {
        spares.push(sparesConsumed);
      }
    });

    const finalSafety = safetyIssues.length > 0 ? safetyIssues.join("\n") : "Nil";
    const finalSpares = spares.length > 0 ? spares.join("\n") : "No";
    const finalBreakdown = breakdowns.length > 0 ? breakdowns.join("\n") : "";

    return {
      id: item.shop,
      sn: index + 1,
      shop: item.name,
      safetyIssue: finalSafety,
      productionTarget,
      yesterdayActualProduction: actuals > 0 ? actuals : "",
      affectedDowntime: affectedDt > 0 ? affectedDt : "",
      grossDowntime: grossDt > 0 ? grossDt : "",
      affectedDowntimeOccurrence: occurrences > 0 ? occurrences : "",
      totalDownTime: grossDt || affectedDt,
      majorBreakdown: finalBreakdown,
      sparesConsumed: finalSpares,
    };
  });
}

function DailyReviewDashboard({ entries, user }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedShift, setSelectedShift] = useState("all");
  const filtered = entries.map(normalizeEntry);
  const yesterdayDateStr = getYesterdayDateStr(selectedDate);
  const hasYesterdayData = filtered.some((entry) => entry.date === yesterdayDateStr);

  const rows = buildDailyReviewRows(filtered, selectedDate, selectedShift);

  const totalTarget = rows.reduce((a, r) => a + toNumber(r.productionTarget), 0);
  const totalActual = rows.reduce((a, r) => a + toNumber(r.yesterdayActualProduction), 0);
  const totalDt = rows.reduce((a, r) => a + toNumber(r.totalDownTime), 0);
  const totalOcc = rows.reduce((a, r) => a + toNumber(r.affectedDowntimeOccurrence), 0);

  const headerStyle = {
    background: "#f1f5f9",
    color: "#0f172a",
    fontWeight: "900",
    textAlign: "center",
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: "12px",
    verticalAlign: "middle",
  };

  const yellowHeaderStyle = {
    ...headerStyle,
    background: "#fef08a",
  };

  const pinkHeaderStyle = {
    ...headerStyle,
    background: "#fecdd3",
  };

  const cellStyle = {
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    verticalAlign: "middle",
    fontSize: "13px",
  };

  return <>
    <div className="ui-card feature-card" style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <h2 style={S.title}>Meeting Sheet</h2>
          <p style={S.subtle}>Today’s production target is calculated from the configured shop cycle time. Actuals, downtime, breakdown, safety, and spares are loaded from the previous day’s submitted reports.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <label style={S.label}>Shift</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSelectedShift("all")} style={S.tabBtn(selectedShift === "all")}>All Shifts</button>
              <button onClick={() => setSelectedShift("A")} style={S.tabBtn(selectedShift === "A")}>Shift 1</button>
              <button onClick={() => setSelectedShift("B")} style={S.tabBtn(selectedShift === "B")}>Shift 2</button>
              <button onClick={() => setSelectedShift("C")} style={S.tabBtn(selectedShift === "C")}>Shift 3</button>
            </div>
          </div>
          <div>
            <label style={S.label}>Date</label>
            <input style={S.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Export</label>
            <button style={S.btn("success")} onClick={() => exportMeetingWorkbook(entries, null, selectedDate, selectedShift)}>
              <Download size={14} /> Export Sheet
            </button>
          </div>
        </div>
      </div>
      <div style={{ ...S.grid(190), marginTop: 18 }}>
        <MetricCard label="Production Target" value={totalTarget} tone="primary" />
        <MetricCard label="Actual Production" value={totalActual} tone="success" />
        <MetricCard label="Total DT Min" value={totalDt} tone="danger" />
        <MetricCard label="DT Occurrence" value={totalOcc} tone="warning" />
      </div>
      {!hasYesterdayData && <div style={{ ...S.error, marginTop: 16 }}>No submitted reports were found for the data date {formatDotDate(yesterdayDateStr)}.</div>}
    </div>

    <div className="ui-card" style={S.card}>
      <div style={S.cardTitle}><FileSpreadsheet size={16} /> Meeting Sheet — {formatDotDate(selectedDate)}</div>
      <div style={S.tableWrap}>
        <table style={{ ...S.table, minWidth: 1200, borderCollapse: "collapse" }}>
          <thead>
            {/* Header Row 1 */}
            <tr>
              <th colSpan={3} style={{ border: "1px solid #cbd5e1" }}></th>
              <th style={yellowHeaderStyle}>{formatDotDate(selectedDate)}</th>
              <th style={yellowHeaderStyle}>{formatDotDate(yesterdayDateStr)}</th>
              <th colSpan={2} style={headerStyle}>Downtime In Mins</th>
              <th style={headerStyle}>Affected Downtime Occurence</th>
              <th colSpan={3} style={{ border: "1px solid #cbd5e1" }}></th>
            </tr>
            {/* Header Row 2 */}
            <tr>
              <th style={headerStyle}>SN</th>
              <th style={headerStyle}>SHOP</th>
              <th style={headerStyle}>Safety Issue</th>
              <th style={headerStyle}>Production Target</th>
              <th style={headerStyle}>Yesterday actual production</th>
              <th style={headerStyle}>Affected Downtime</th>
              <th style={headerStyle}>Gross Downtime</th>
              <th style={headerStyle}>Affected Downtime Occurrence</th>
              <th style={headerStyle}>Total down time in min</th>
              <th style={headerStyle}>Major Breakdown</th>
              <th style={headerStyle}>Spares Consumed from Physical Inventory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {(() => {
                  const safetyIssue = toText(row.safetyIssue, "Nil");
                  const sparesConsumed = toText(row.sparesConsumed, "No");
                  const isSafetyNil = safetyIssue.toLowerCase() === "nil";
                  const isSparesNo = sparesConsumed.toLowerCase() === "no";
                  return <>
                <td style={{ ...cellStyle, textAlign: "center", fontWeight: "bold" }}>{row.sn}</td>
                <td style={{ ...cellStyle, fontWeight: "bold" }}>{row.shop}</td>
                <td style={{ ...cellStyle, color: isSafetyNil ? "#64748b" : "#e11d48", fontWeight: isSafetyNil ? "normal" : "bold" }}>{safetyIssue}</td>
                <td style={{ ...cellStyle, textAlign: "center", background: "#fefcf0", fontWeight: "bold" }}>{row.productionTarget}</td>
                <td style={{ ...cellStyle, textAlign: "center", background: "#fefcf0", fontWeight: "bold" }}>{row.yesterdayActualProduction}</td>
                <td style={{ ...cellStyle, textAlign: "center" }}>{row.affectedDowntime}</td>
                <td style={{ ...cellStyle, textAlign: "center" }}>{row.grossDowntime}</td>
                <td style={{ ...cellStyle, textAlign: "center", background: "#ffffff" }}>{row.affectedDowntimeOccurrence}</td>
                <td style={{ ...cellStyle, textAlign: "center", fontWeight: "bold" }}>{row.totalDownTime || ""}</td>
                <td style={{ ...cellStyle, color: "#0f172a" }}>{row.majorBreakdown || "No major downtime"}</td>
                <td style={{ ...cellStyle, color: isSparesNo ? "#64748b" : "#0f172a", fontWeight: isSparesNo ? "normal" : "bold" }}>{sparesConsumed}</td>
                  </>;
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}

function MissingPanel({ entries, selectedDate }) {
  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const requiredShifts = availableShiftIds(selectedDate);
  const totalExpected = requiredShifts.length * SHOPS.length;
  const totalSubmitted = requiredShifts.reduce((sum, shiftId) => {
    const shops = new Set(dayEntries.filter((entry) => entry.shift === shiftId && SHOPS.includes(entry.shop)).map((entry) => entry.shop));
    return sum + shops.size;
  }, 0);
  const overallPct = totalExpected ? Math.round((totalSubmitted / totalExpected) * 100) : 0;

  return <div className="ui-card" style={S.card}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap", marginBottom: 18 }}>
      <div>
        <div style={{ ...S.cardTitle, marginBottom: 5 }}><AlertTriangle size={18} /> Upload Status for {selectedDate}</div>
        <p style={{ ...S.subtle, margin: 0 }}>Every shop is expected in every available shift. Sunday has only A/B; Monday has no C.</p>
      </div>
      <div style={{ minWidth: 190, textAlign: "right" }}>
        <div style={{ fontSize: 24, fontWeight: 950, color: overallPct === 100 ? "#047857" : "#1d4ed8" }}>{overallPct}% complete</div>
        <div style={{ ...S.subtle, fontSize: 12 }}>{totalSubmitted} of {totalExpected} reports uploaded</div>
      </div>
    </div>
    <div style={S.grid(300)}>
      {requiredShifts.map((shiftId) => {
        const submitted = [...new Set(dayEntries.filter((e) => e.shift === shiftId && SHOPS.includes(e.shop)).map((e) => e.shop))];
        const missing = SHOPS.filter((shop) => !submitted.includes(shop));
        const percentage = Math.round((submitted.length / SHOPS.length) * 100);
        const state = missing.length === 0 ? "complete" : submitted.length === 0 ? "empty" : "partial";
        const tone = state === "complete" ? "green" : state === "empty" ? "red" : "orange";
        const progressColor = state === "complete" ? "#10b981" : state === "empty" ? "#ef4444" : "#f59e0b";

        return <div className={`metric-card upload-status-card upload-status-card--${state}`} key={shiftId} style={S.stat}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950, color: "#172033" }}>Shift {shiftId}</div>
              <div style={{ ...S.subtle, fontSize: 11, marginTop: 2 }}>{SHIFT_TIME[shiftId]}</div>
            </div>
            <span style={S.badge(tone)}>{submitted.length}/{SHOPS.length} uploaded</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18, marginBottom: 7, fontSize: 12 }}>
            <strong style={{ color: state === "complete" ? "#067647" : state === "empty" ? "#b42335" : "#b54708" }}>
              {state === "complete" ? "All reports received" : `${missing.length} reports pending`}
            </strong>
            <strong style={{ color: "#475569" }}>{percentage}%</strong>
          </div>
          <div className="upload-progress"><span style={{ width: `${percentage}%`, background: progressColor }} /></div>
          <div style={{ marginTop: 17 }}>
            <div style={{ ...S.label, marginBottom: 9 }}>{state === "complete" ? "STATUS" : "MISSING SHOPS"}</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {state === "complete"
                ? <span className="shop-chip shop-chip--complete"><CheckCircle2 size={13} /> Complete</span>
                : missing.map((shop) => <span className="shop-chip shop-chip--missing" key={shop}>{shop}</span>)}
            </div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function ChartCard({ title, children }) { return <div className="ui-card" style={S.card}><div style={S.cardTitle}><BarChart3 size={16} /> {title}</div>{children}</div>; }

function DashboardHero() {
  const heroRef = useRef(null);

  function updateDepth(event) {
    const hero = heroRef.current;
    if (!hero || event.pointerType === "touch") return;
    const rect = hero.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
    hero.style.setProperty("--hero-x", x.toFixed(3));
    hero.style.setProperty("--hero-y", y.toFixed(3));
    hero.style.setProperty("--hero-light-x", `${((x + 1) / 2) * 100}%`);
    hero.style.setProperty("--hero-light-y", `${((y + 1) / 2) * 100}%`);
  }

  function resetDepth() {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.setProperty("--hero-x", "0");
    hero.style.setProperty("--hero-y", "0");
    hero.style.setProperty("--hero-light-x", "72%");
    hero.style.setProperty("--hero-light-y", "22%");
  }

  return (
    <section
      ref={heroRef}
      className="dashboard-hero"
      aria-label="TATA MOTORS vehicle lineup"
      onPointerMove={updateDepth}
      onPointerLeave={resetDepth}
    >
      <div className="dashboard-hero__scene" style={{ backgroundImage: `url(${tataMotorsHero})` }} />
      <div className="dashboard-hero__shade" />
      <div className="dashboard-hero__light" />
      <div className="dashboard-hero__grid" />
      <div className="dashboard-hero__content">
        <span className="dashboard-hero__eyebrow">TATA MOTORS Operations</span>
        <h1 className="dashboard-hero__title">Driving excellence across every shift.</h1>
        <p className="dashboard-hero__copy">One connected view of daily shop reporting, operational readiness, and timely production updates.</p>
        <div className="dashboard-hero__accent" />
      </div>
    </section>
  );
}

function Dashboard({ entries }) {
  const [date, setDate] = useState(todayStr);
  const normalized = entries.map(normalizeEntry);

  const dayEntries = normalized.filter((e) => e.date === date);
  const requiredShifts = availableShiftIds(date);
  const submittedReports = new Set(
    dayEntries
      .filter((entry) => requiredShifts.includes(entry.shift) && SHOPS.includes(entry.shop))
      .map((entry) => `${entry.shop}|${entry.shift}`)
  ).size;
  const expectedReports = requiredShifts.length * SHOPS.length;
  const reportsLeft = Math.max(expectedReports - submittedReports, 0);
  return <>
    <DashboardHero />
    <div className="ui-card feature-card dashboard-summary" style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div><h2 style={S.title}>Admin Dashboard</h2><p style={S.subtle}>Daily report submission summary.</p></div>
        <div><label style={S.label}>Date</label><input style={S.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div style={{ ...S.grid(280), marginTop: 12 }}>
        <MetricCard label={`Reports Submitted / ${expectedReports}`} value={submittedReports} tone="success" />
        <MetricCard label="Reports Left" value={reportsLeft} tone={reportsLeft ? "warning" : "success"} />
      </div>
    </div>
    <MissingPanel entries={normalized} selectedDate={date} />
  </>;
}

function AnalyticalSheet({ entries, user }) {
  const [selectedShop, setSelectedShop] = useState(user.role === "admin" ? "ALL" : user.shop);
  const filtered = entries.map(normalizeEntry).filter((e) => selectedShop === "ALL" || e.shop === selectedShop);
  const shopRows = buildShopRows(filtered);
  const monthRows = buildMonthRows(filtered);
  const dayRows = buildDayRows(filtered);
  const cumRows = cumulativeRows(filtered);
  const bdRows = breakdownRows(filtered);
  const rankingRows = [...shopRows]
    .sort((a, b) => b.avgOe - a.avgOe || b.avgLe - a.avgLe)
    .map((row, index) => ({ ...row, rank: index + 1, shop: row.label }));
  const achievementRows = shopRows
    .map((row) => ({
      ...row,
      shop: row.label,
      target: row.capacity,
      actual: row.production,
      achievementPct: row.capacity ? round1((row.production / row.capacity) * 100) : 0,
      gap: Math.max(row.capacity - row.production, 0),
    }))
    .sort((a, b) => b.achievementPct - a.achievementPct);
  const columns = [{ key: "label", label: "Group" }, { key: "reports", label: "Reports" }, { key: "production", label: "Production" }, { key: "capacity", label: "Capacity" }, { key: "lossTime", label: "Loss Time" }, { key: "bdOccurrence", label: "BD Occ." }, { key: "avgOe", label: "OE %" }, { key: "avgLe", label: "Efficiency %" }, { key: "mttr", label: "MTTR" }, { key: "mtbfHrs", label: "MTBR Hrs" }];
  return <>
    <div style={S.card}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}><div><h2 style={S.title}>Analytical Sheet</h2><p style={S.subtle}>Shop-wise performance ranking and production target achievement.</p></div>{user.role === "admin" && <div><label style={S.label}>Shop Filter</label><select style={{ ...S.input, minWidth: 170 }} value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}><option value="ALL">All Shops</option>{SHOPS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}</div></div>
    <div style={S.grid(420)}>
      <ChartCard title="Shop Ranking">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rankingRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="shop" interval={0} angle={-35} textAnchor="end" height={75} />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(value, name) => [`${value}%`, name]} labelFormatter={(label, payload) => payload?.[0]?.payload ? `#${payload[0].payload.rank} ${label}` : label} />
            <Legend />
            <Bar dataKey="avgOe" name="OEE %" fill="#2563eb" radius={[6, 6, 0, 0]} />
            <Bar dataKey="avgLe" name="Efficiency %" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Target Achievement">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={achievementRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="shop" interval={0} angle={-35} textAnchor="end" height={75} />
            <YAxis />
            <Tooltip formatter={(value, name, item) => [value, name === "Actual Production" ? `${name} (${item?.payload?.achievementPct ?? 0}%)` : name]} />
            <Legend />
            <Bar dataKey="target" name="Target Capacity" fill="#94a3b8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="actual" name="Actual Production" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
    <DataTable rows={shopRows} columns={columns} title="1. Shop Wise" />
    <DataTable rows={monthRows} columns={columns} title="2. Month Wise" />
    <DataTable rows={dayRows} columns={columns} title="3. Day Wise + Sum Up" />
    <DataTable rows={cumRows} columns={[{ key: "date", label: "Date" }, { key: "dailyLoss", label: "Daily Loss" }, { key: "cumulativeLoss", label: "Cumulative Loss" }, { key: "cumulativeBD", label: "Cumulative BD" }]} title="4. Cumulative Losses" />
    <DataTable rows={bdRows} columns={[{ key: "date", label: "Date" }, { key: "shop", label: "Shop" }, { key: "shift", label: "Shift" }, { key: "lossTime", label: "Loss Time" }, { key: "bdOccurrence", label: "BD Occ." }, { key: "details", label: "Breakdown Details" }]} title="5. Breakdown Losses" />
    <DataTable rows={shopRows} columns={columns} title="6. Parameter (MTBR / MTTR / OEE)" />
  </>;
}

function ShopWisePerShift({ entries }) {
  const rows = buildShiftRows(entries);
  return <DataTable rows={rows} columns={[{ key: "label", label: "Shop / Shift" }, { key: "reports", label: "Reports" }, { key: "production", label: "Production" }, { key: "capacity", label: "Capacity" }, { key: "lossTime", label: "Loss Time" }, { key: "bdOccurrence", label: "BD Occ." }, { key: "avgOe", label: "OE %" }, { key: "avgLe", label: "Efficiency %" }, { key: "mttr", label: "MTTR" }, { key: "mtbfHrs", label: "MTBR Hrs" }]} title="Shopwise Per Shift Data" />;
}

async function exportMeetingWorkbook(entries, activeSingleEntry = null, selectedDate = null, selectedShift = "all") {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: "Loss Report" (single sheet showing single data)
  const meeting = [];
  let targetEntries = [];
  if (activeSingleEntry) {
    targetEntries = [activeSingleEntry];
  } else {
    // Default to the latest updated entry
    const sorted = entries.map(normalizeEntry).sort((a, b) => {
      const dateA = new Date(a.lastUpdatedAt || a.submittedAt || 0).getTime();
      const dateB = new Date(b.lastUpdatedAt || b.submittedAt || 0).getTime();
      return dateB - dateA;
    });
    if (sorted.length) targetEntries = [sorted[0]];
  }

  targetEntries.forEach((e) => {
    const slots = HOUR_SLOTS[e.shift] || [];
    const plan = normalizeHourlyArray(
      e.hourlyPlan,
      e.shift,
      plannedCapacity(e.shift, e.cycleTimeSec),
    );
    const actual = normalizeHourlyArray(e.hourlyActual, e.shift, 0);
    const lossCategories = lossCategoriesForShop(e.shop);
    const lossAt = (index) => lossCategories[index] || null;
    const lossColumns = (index) => {
      const loss = lossAt(index);
      return loss ? [loss.label, e[loss.key]] : ["", ""];
    };
    meeting.push(["For Date", meetingDate(e.date), "", "", "", "Loss Time summary", "DT (Min)"]);
    meeting.push(["Shop", e.shopDisplayName, "", "", "", ...lossColumns(0)]);
    meeting.push(["Shift", e.shift, "", "", "", ...lossColumns(1)]);
    meeting.push([]);
    meeting.push(["Production", "Day", "", "", "", ...lossColumns(2)]);
    meeting.push(["Capacity", e.capacity, "", "", "", ...lossColumns(3)]);
    meeting.push(["Cycle Time in Sec.", e.cycleTimeSec, "", "", "", ...lossColumns(4)]);
    meeting.push(["Actual Prod. Nos.", e.actualProduction, "", "", "", ...lossColumns(5)]);
    meeting.push([`${e.shop} Production Loss`, e.productionLoss, "", "", "", ...lossColumns(6)]);
    meeting.push(["Loss Time in Min", e.lossTime, "", "", "", ...lossColumns(7)]);
    lossCategories.slice(8).forEach((l) => meeting.push(["", "", "", "", "", l.label, e[l.key]]));
    meeting.push(["", "", "", "", "", "Total", e.lossTime]);
    const lossUsageRows = lossCategories.flatMap((loss) =>
      (e.lossDetails?.[loss.key] || []).map((detail) => [
        loss.label,
        detail.machine,
        toNumber(detail.minutes),
        detail.remarks || "",
      ])
    );
    meeting.push([]);
    meeting.push(["Hourly Production Chart"]);
    meeting.push(["Hours", ...slots, "Total"]);
    meeting.push(["Plan", ...plan, plan.reduce((a, b) => a + b, 0)]);
    meeting.push(["Actual", ...actual, actual.reduce((a, b) => a + b, 0)]);
    meeting.push(["Efficient", ...plan.map((p, i) => (p ? `${Math.round((actual[i] / p) * 100)}%` : "0%")), `${e.lePct}%`]);
    meeting.push([]);
    meeting.push(["Breakdown / Remarks", e.majorBreakdown || "—"]);
    if (lossUsageRows.length) {
      meeting.push([]);
      meeting.push(["Loss Time Summary in Min"]);
      meeting.push(["Category", "Min", "Major Reasons Today"]);
      lossCategories.forEach((loss) => {
        const rows = lossUsageRows.filter((row) => row[0] === loss.label);
        if (!rows.length) return;
        meeting.push([loss.label]);
        rows.forEach((row) => meeting.push([row[1], row[2], row[3] || row[1]]));
      });
      meeting.push(["Total", lossUsageRows.reduce((sum, row) => sum + toNumber(row[2]), 0)]);
    }
    meeting.push([], []);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meeting), "Loss Report");

  // ── Sheet 2: "Meeting Report" (was "Meeting_A/B/C" — the loss/analytics flat table)
  const meetingHeaders = [
    "Month", "Date", "Shop", "Production", "Shift", "Available Time", "Cycle Time",
    "Capacity", "Actual Production time", "Net DT", "AR", "PR", "QR", "OE", "LE",
    "", "Affected DT", "Gross DT", "BD Occurrence", "Uptime (Affected DT)", "MTTR", "MTBR",
    "", "Uptime (Gross DT)"
  ];
  const meetingRows = entries.map(normalizeEntry).map((e) => {
    const uptimeAffected = e.timeAvailable ? `${round1(((e.timeAvailable - e.affectedDowntime) / e.timeAvailable) * 100)}%` : "0%";
    const uptimeGross = `${round1(e.uptimeGross * 100)}%`;
    return [
      monthYear(e.date),
      meetingDate(e.date),
      e.shopDisplayName,
      e.actualProduction,
      e.shift,
      e.timeAvailable,
      e.cycleTimeSec,
      e.capacity,
      e.productionTime,
      e.netDt,
      e.ar,
      e.pr,
      e.qr,
      e.oePct,
      e.lePct,
      "",
      e.affectedDowntime,
      e.grossDowntime,
      e.bdOccurrence,
      uptimeAffected,
      e.mttr,
      e.mtbfHrs,
      "",
      uptimeGross
    ];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([meetingHeaders, ...meetingRows]), "Meeting Report");

  // ── Sheet 3: "Analytical Sheet"
  const analytics = [
    ["Group", "Reports", "Production", "Capacity", "Loss Time", "BD Occ.", "OE %", "Efficiency %", "MTTR", "MTBR Hrs"],
    ...buildShopRows(entries).map((r) => [r.label, r.reports, r.production, r.capacity, r.lossTime, r.bdOccurrence, r.avgOe, r.avgLe, r.mttr, r.mtbfHrs]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(analytics), "Analytical Sheet");

  // ── Sheet 4: "Daily Review Sheet"
  const targetDate = selectedDate || activeSingleEntry?.date || (entries.length ? entries.map(normalizeEntry).sort((a, b) => b.date.localeCompare(a.date))[0]?.date : todayStr());
  const dailyRows = buildDailyReviewRows(entries, targetDate, selectedShift);
  const yesterdayDate = getYesterdayDateStr(targetDate);
  const daily = [
    ["", "", "", formatDotDate(targetDate), formatDotDate(yesterdayDate), "Downtime In Mins", "", "Affected Downtime Occurence", "", "", ""],
    ["SN", "SHOP", "Safety Issue", "Production Target", "Yesterday actual production", "Affected Downtime", "Gross Downtime", "Affected Downtime Occurrence", "Total down time in min", "Major Breakdown", "Spares Consumed from Physical Inventory"],
    ...dailyRows.map((r) => [r.sn, r.shop, r.safetyIssue, r.productionTarget, r.yesterdayActualProduction, r.affectedDowntime, r.grossDowntime, r.affectedDowntimeOccurrence, r.totalDownTime, r.majorBreakdown, r.sparesConsumed]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Daily Review Sheet");

  XLSX.writeFile(wb, `TATA_MOTORS_Operations_Export_${todayStr()}.xlsx`);
}

// ── LOSS DATA DASHBOARD ───────────────────────────────────────
function LossDataSingleView({ entries, user }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedShop, setSelectedShop] = useState(user.role === "admin" ? "ALL" : user.shop);
  const [selectedShift, setSelectedShift] = useState("ALL");

  const filtered = entries.map(normalizeEntry).filter((e) =>
    (!selectedDate || e.date === selectedDate) &&
    (selectedShop === "ALL" || e.shop === selectedShop) &&
    (selectedShift === "ALL" || e.shift === selectedShift)
  ).sort((a, b) => `${a.shop}${a.shift}`.localeCompare(`${b.shop}${b.shift}`));

  const lossCols = [
    { key: "month", label: "Month" },
    { key: "date", label: "Date" },
    { key: "shop", label: "Shop" },
    { key: "actualProduction", label: "Actual Production" },
    { key: "shift", label: "Shift" },
    { key: "timeAvailable", label: "Time Available (Min)" },
    { key: "cycleTimeSec", label: "Cycle Time (Sec)" },
    { key: "capacity", label: "Capacity" },
    { key: "productionTime", label: "Production Time" },
    { key: "netDt", label: "Production DT" },
    { key: "ar", label: "AR" },
    { key: "pr", label: "PR" },
    { key: "qr", label: "QR" },
    { key: "oePct", label: "OE / OEE" },
    { key: "lePct", label: "Line Efficiency" },
    { key: "affectedDowntime", label: "Affected DT" },
    { key: "grossDowntime", label: "Gross DT" },
    { key: "bdOccurrence", label: "BD Occurrence" },
    { key: "uptimeAffected", label: "Uptime (Affected DT)" },
    { key: "mttr", label: "MTTR" },
    { key: "mtbfHrs", label: "MTBR" },
    { key: "uptimeGross", label: "Uptime (Gross DT)" },
  ];

  const rows = filtered.map((e, i) => {
    const uptimeAffected = e.timeAvailable ? `${round1(((e.timeAvailable - e.affectedDowntime) / e.timeAvailable) * 100)}%` : "0%";
    const uptimeGross = `${round1(e.uptimeGross * 100)}%`;
    return {
      id: e.id || i,
      month: monthLabel(e.date),
      date: meetingDate(e.date),
      shop: e.shopDisplayName || e.shop,
      actualProduction: e.actualProduction,
      shift: `Shift ${e.shift}`,
      timeAvailable: e.timeAvailable,
      cycleTimeSec: e.cycleTimeSec,
      capacity: e.capacity,
      productionTime: e.productionTime,
      netDt: e.netDt,
      ar: e.ar,
      pr: e.pr,
      qr: e.qr,
      oePct: `${e.oePct}%`,
      lePct: `${e.lePct}%`,
      affectedDowntime: e.affectedDowntime,
      grossDowntime: e.grossDowntime,
      bdOccurrence: e.bdOccurrence,
      uptimeAffected: uptimeAffected,
      mttr: e.mttr,
      mtbfHrs: e.mtbfHrs,
      uptimeGross: uptimeGross,
    };
  });

  return <>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, alignItems: "end" }}>
      <div><label style={S.label}>Date</label><input style={S.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
      {user.role === "admin" && (
        <div><label style={S.label}>Shop</label>
          <select style={{ ...S.input, minWidth: 150 }} value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
            <option value="ALL">All Shops</option>{SHOPS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div><label style={S.label}>Shift</label>
        <select style={{ ...S.input, minWidth: 120 }} value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
          <option value="ALL">All Shifts</option>
          {["C", "A", "B"].map((s) => <option key={s} value={s}>Shift {s}</option>)}
        </select>
      </div>
      {filtered.length > 0 && (
        <div>
          <label style={S.label}>Export</label>
          <button style={S.btn("success")} onClick={() => exportMeetingWorkbook(entries, filtered[0])}>
            <Download size={14} /> Export Block
          </button>
        </div>
      )}
    </div>
    <DataTable rows={rows} columns={lossCols} title={`Loss Data — ${selectedDate}${selectedShop !== "ALL" ? ` · ${selectedShop}` : ""}`} />
  </>;
}

function LossDataCumulativeView({ entries, user }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedShop, setSelectedShop] = useState(user.role === "admin" ? "ALL" : user.shop);
  const [groupBy, setGroupBy] = useState("shop"); // "shop" | "month" | "shift"

  const source = entries.map(normalizeEntry).filter((e) =>
    (!selectedDate || e.date === selectedDate) &&
    (selectedShop === "ALL" || e.shop === selectedShop)
  );

  const grouped = useMemo(() => {
    const map = {};
    const makeBlank = (label) => ({
      label, reports: 0, capacity: 0, actualProduction: 0,
      productionLoss: 0, lossTime: 0, affectedDowntime: 0, availableTime: 0, bdOccurrence: 0,
      oePctTotal: 0, lePctTotal: 0,
      ...Object.fromEntries(LOSS_CATEGORIES.map((l) => [l.key, 0])),
    });
    source.forEach((e) => {
      let key;
      if (groupBy === "shop")  key = e.shopDisplayName || e.shop;
      else if (groupBy === "month") key = e.date ? e.date.slice(0, 7) : "Unknown";
      else key = `Shift ${e.shift}`;
      if (!map[key]) map[key] = makeBlank(key);
      const r = map[key];
      r.reports++;
      r.capacity += toNumber(e.capacity);
      r.actualProduction += toNumber(e.actualProduction);
      r.productionLoss += toNumber(e.productionLoss);
      r.lossTime += toNumber(e.lossTime);
      r.affectedDowntime += toNumber(e.affectedDowntime);
      r.availableTime += toNumber(e.timeAvailable);
      r.bdOccurrence += toNumber(e.bdOccurrence);
      r.oePctTotal += toNumber(e.oePct);
      r.lePctTotal += toNumber(e.lePct);
      LOSS_CATEGORIES.forEach((l) => { r[l.key] += toNumber(e[l.key]); });
    });
    return Object.values(map).map((r) => ({
      ...r,
      avgOe: r.reports ? round2(r.oePctTotal / r.reports) : 0,
      avgLe: r.reports ? round2(r.lePctTotal / r.reports) : 0,
      mttr: r.bdOccurrence ? round2(r.affectedDowntime / r.bdOccurrence) : 0,
      mtbfHrs: r.bdOccurrence ? round2(Math.max(r.availableTime - r.affectedDowntime, 0) / (r.bdOccurrence * 60)) : 0,
    }));
  }, [source, groupBy]);

  const totals = grouped.reduce((acc, r) => {
    acc.reports += r.reports; acc.capacity += r.capacity;
    acc.actualProduction += r.actualProduction; acc.productionLoss += r.productionLoss;
    acc.lossTime += r.lossTime; acc.bdOccurrence += r.bdOccurrence;
    return acc;
  }, { reports: 0, capacity: 0, actualProduction: 0, productionLoss: 0, lossTime: 0, bdOccurrence: 0 });

  const cols = [
    { key: "label", label: groupBy === "shop" ? "Shop" : groupBy === "month" ? "Month" : "Shift" },
    { key: "reports", label: "Reports" },
    { key: "capacity", label: "Capacity" },
    { key: "actualProduction", label: "Actual Prod." },
    { key: "productionLoss", label: "Prod. Loss" },
    { key: "lossTime", label: "Loss Time (Min)" },
    { key: "bdOccurrence", label: "BD Occ." },
    { key: "avgOe", label: "Avg OE %" },
    { key: "avgLe", label: "Avg LE %" },
    { key: "mttr", label: "MTTR" },
    { key: "mtbfHrs", label: "MTBR Hrs" },
  ];

  const calcKeys = new Set(["avgOe", "avgLe", "mttr", "mtbfHrs", "label"]);

  return <>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, alignItems: "end" }}>
      <div><label style={S.label}>Date</label><input style={S.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
      {user.role === "admin" && (
        <div><label style={S.label}>Shop Filter</label>
          <select style={{ ...S.input, minWidth: 150 }} value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
            <option value="ALL">All Shops</option>{SHOPS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div><label style={S.label}>Group By</label>
        <select style={{ ...S.input, minWidth: 130 }} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="shop">Shop</option>
          <option value="month">Month</option>
          <option value="shift">Shift</option>
        </select>
      </div>
    </div>
    <div style={S.card}>
      <div style={S.cardTitle}><FileSpreadsheet size={16} /> Cumulative Loss Data{selectedDate ? ` · ${selectedDate}` : ""}</div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>{cols.map((c) => <th key={c.key} style={S.th}>{c.label}</th>)}</tr></thead>
          <tbody>
            {grouped.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => <td key={c.key} style={S.td}>{r[c.key] ?? 0}</td>)}
              </tr>
            ))}
            <tr style={{ background: "#e8eaf6" }}>
              {cols.map((c) => (
                <td key={c.key} style={{ ...S.td, fontWeight: 900, background: "#e8eaf6" }}>
                  {c.key === "label" ? "TOTAL" : calcKeys.has(c.key) ? "—" : (totals[c.key] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </>;
}

function LossDataMergedView({ entries, user }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedShop, setSelectedShop] = useState(user.role === "admin" ? "ALL" : user.shop);
  const [selectedShift, setSelectedShift] = useState("ALL");

  const filtered = entries.map(normalizeEntry).filter((e) =>
    (!selectedDate || e.date === selectedDate) &&
    (selectedShop === "ALL" || e.shop === selectedShop) &&
    (selectedShift === "ALL" || e.shift === selectedShift)
  ).sort((a, b) => b.date.localeCompare(a.date) || `${a.shop}${a.shift}`.localeCompare(`${b.shop}${b.shift}`));

  const lossCols = [
    { key: "month", label: "Month" },
    { key: "date", label: "Date" },
    { key: "shop", label: "Shop" },
    { key: "actualProduction", label: "Actual Production" },
    { key: "shift", label: "Shift" },
    { key: "timeAvailable", label: "Time Available (Min)" },
    { key: "cycleTimeSec", label: "Cycle Time (Sec)" },
    { key: "capacity", label: "Capacity" },
    { key: "productionTime", label: "Production Time" },
    { key: "netDt", label: "Production DT" },
    { key: "ar", label: "AR" },
    { key: "pr", label: "PR" },
    { key: "qr", label: "QR" },
    { key: "oePct", label: "OE / OEE" },
    { key: "lePct", label: "Line Efficiency" },
    { key: "affectedDowntime", label: "Affected DT" },
    { key: "grossDowntime", label: "Gross DT" },
    { key: "bdOccurrence", label: "BD Occurrence" },
    { key: "uptimeAffected", label: "Uptime (Affected DT)" },
    { key: "mttr", label: "MTTR" },
    { key: "mtbfHrs", label: "MTBR" },
    { key: "uptimeGross", label: "Uptime (Gross DT)" },
  ];

  const rows = filtered.map((e, i) => {
    const uptimeAffected = e.timeAvailable ? `${round1(((e.timeAvailable - e.affectedDowntime) / e.timeAvailable) * 100)}%` : "0%";
    const uptimeGross = `${round1(e.uptimeGross * 100)}%`;
    return {
      id: e.id || i,
      month: monthLabel(e.date),
      date: meetingDate(e.date),
      shop: e.shopDisplayName || e.shop,
      actualProduction: e.actualProduction,
      shift: `Shift ${e.shift}`,
      timeAvailable: e.timeAvailable,
      cycleTimeSec: e.cycleTimeSec,
      capacity: e.capacity,
      productionTime: e.productionTime,
      netDt: e.netDt,
      ar: e.ar,
      pr: e.pr,
      qr: e.qr,
      oePct: `${e.oePct}%`,
      lePct: `${e.lePct}%`,
      affectedDowntime: e.affectedDowntime,
      grossDowntime: e.grossDowntime,
      bdOccurrence: e.bdOccurrence,
      uptimeAffected: uptimeAffected,
      mttr: e.mttr,
      mtbfHrs: e.mtbfHrs,
      uptimeGross: uptimeGross,
    };
  });

  return <>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, alignItems: "end" }}>
      <div><label style={S.label}>Date</label><input style={S.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
      {user.role === "admin" && (
        <div><label style={S.label}>Shop</label>
          <select style={{ ...S.input, minWidth: 150 }} value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
            <option value="ALL">All Shops</option>{SHOPS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div><label style={S.label}>Shift</label>
        <select style={{ ...S.input, minWidth: 120 }} value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
          <option value="ALL">All Shifts</option>
          {["C", "A", "B"].map((s) => <option key={s} value={s}>Shift {s}</option>)}
        </select>
      </div>
      {filtered.length > 0 && (
        <div>
          <label style={S.label}>Export</label>
          <button style={S.btn("success")} onClick={() => exportMeetingWorkbook(entries, filtered[0])}>
            <Download size={14} /> Export Block
          </button>
        </div>
      )}
    </div>
    <DataTable rows={rows} columns={lossCols} title={`Merged Cumulative Meeting Data${selectedDate ? ` · ${selectedDate}` : ""}${selectedShop !== "ALL" ? ` · ${selectedShop}` : ""}`} />
  </>;
}

function LossDataDashboard({ entries, user }) {
  const [viewMode, setViewMode] = useState("single"); // "single" | "cumulative" | "grouped"
  return <>
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <h2 style={S.title}>Data Store</h2>
          <p style={S.subtle}>View meeting report columns with formulas per entry, or as a cumulative merged flat list, or grouped summary.</p>
        </div>
        <div>
          <label style={S.label}>View Mode</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setViewMode("single")} style={S.tabBtn(viewMode === "single")}>Single Day</button>
            <button onClick={() => setViewMode("cumulative")} style={S.tabBtn(viewMode === "cumulative")}>Cumulative (Merged)</button>
            <button onClick={() => setViewMode("grouped")} style={S.tabBtn(viewMode === "grouped")}>Grouped Summary</button>
          </div>
        </div>
      </div>
    </div>
    {viewMode === "single" && <LossDataSingleView entries={entries} user={user} />}
    {viewMode === "cumulative" && <LossDataMergedView entries={entries} user={user} />}
    {viewMode === "grouped" && <LossDataCumulativeView entries={entries} user={user} />}
  </>;
}

function SettingsPage({ gasUrl, setGasUrl, user, onRefresh, entries, setEntries }) {
  const [url, setUrl] = useState(gasUrl);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function saveUrl() {
    localStorage.setItem(LS_KEYS.GAS_URL, url.trim());
    setGasUrl(url.trim());
    setMessage("✅ Google Apps Script URL saved.");
    setError("");
  }

  function useDeploymentUrl() {
    if (!DEFAULT_GAS_URL) {
      setError("No deployment URL is configured in VITE_GAS_WEB_APP_URL.");
      setMessage("");
      return;
    }
    localStorage.setItem(LS_KEYS.GAS_URL, DEFAULT_GAS_URL);
    setUrl(DEFAULT_GAS_URL);
    setGasUrl(DEFAULT_GAS_URL);
    setMessage("✅ Deployment Google Apps Script URL restored.");
    setError("");
  }

  async function testConnection() {
    setMessage(""); setError(""); setWorking(true);
    try {
      const result = await apiGet(url.trim(), { action: "health" });
      setMessage(`✅ Connected! ${result.message || ""}. Rows in Google Sheet: ${result.rawRows ?? "unknown"}.`);
    } catch (err) {
      setError(`❌ Connection failed: ${err.message}`);
    } finally { setWorking(false); }
  }

  async function rebuild() {
    setMessage(""); setError(""); setWorking(true);
    try {
      const result = await apiPost(url.trim(), { action: "rebuildSheets" });
      setMessage(`✅ ${result.message || "Sheets rebuilt."}`);
      await onRefresh();
    } catch (err) { setError(`❌ ${err.message}`); }
    finally { setWorking(false); }
  }

  function clearLocalCache() {
    if (!window.confirm("Clear only this browser's cached data? Google Sheet data will NOT be affected.")) return;
    localStorage.removeItem(LS_KEYS.ENTRIES);
    setEntries([]);
    setMessage("✅ Browser cache cleared. Click 'Load Sheet Data' to re-fetch from Google Sheets.");
  }

  async function clearAllSheetData() {
    if (!window.confirm("⚠️ DANGER: This will PERMANENTLY DELETE ALL DATA from Google Sheets AND this browser cache. This cannot be undone. Are you absolutely sure?")) return;
    if (!window.confirm("Last chance — click OK to permanently erase all production reports from Google Sheets.")) return;
    setWorking(true); setMessage(""); setError("");
    try {
      await apiPost(url.trim(), { action: "clearAllData" });
      localStorage.removeItem(LS_KEYS.ENTRIES);
      setEntries([]);
      setMessage("✅ All data has been permanently deleted from Google Sheets and browser cache. You can now start fresh.");
    } catch (err) {
      // Even if GAS call fails, clear local so user gets a clean UI
      localStorage.removeItem(LS_KEYS.ENTRIES);
      setEntries([]);
      setError(`⚠️ Google Sheets clear may have failed (${err.message}), but local cache is cleared. Check your sheet manually.`);
    } finally { setWorking(false); }
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}><Settings size={16} /> Settings</div>
      {message && <div style={S.ok}>{message}</div>}
      {error && <div style={S.error}>{error}</div>}

      <label style={S.label}>Google Apps Script Web App URL</label>
      <input style={S.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" />

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Connection &amp; Sync</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button disabled={working} style={S.btn("primary")} onClick={saveUrl}><Save size={14} /> Save URL</button>
          <button disabled={working || !DEFAULT_GAS_URL} style={S.btn()} onClick={useDeploymentUrl}>Use Deployment URL</button>
          <button disabled={working} style={S.btn()} onClick={testConnection}><CheckCircle2 size={14} /> Test Connection</button>
          <button disabled={working} style={S.btn("success")} onClick={onRefresh}><RefreshCw size={14} /> Load Sheet Data</button>
          <button disabled={working} style={S.btn("warning")} onClick={rebuild}>Rebuild Visible Sheets</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Export</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button disabled={working} style={S.btn("success")} onClick={() => exportMeetingWorkbook(entries)}><Download size={14} /> Export Workbook</button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#be123c", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>⚠️ Danger Zone</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button disabled={working} style={S.btn("danger")} onClick={clearLocalCache}>Clear Local Browser Cache</button>
          <button disabled={working} style={{ ...S.btn("danger"), background: "#be123c", color: "#fff", fontWeight: 700 }} onClick={clearAllSheetData}>🗑 Delete ALL Data from Google Sheets</button>
        </div>
        <div style={{ fontSize: 12, color: "#9f1239", marginTop: 8 }}>"Delete ALL Data" permanently removes every production report from Google Sheets and resets the app. Use this only to start fresh.</div>
      </div>

      <div style={{ ...S.stat, marginTop: 18 }}>
        <strong>Logged in as:</strong> {user.username} · {user.role}<br />
        <span style={S.subtle}>Cached reports in browser: {entries.length}</span>
      </div>
    </div>
  );
}

function LossDataAndAnalytics({ entries, user }) {
  const [subTab, setSubTab] = useState("lossData");
  return (
    <>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={S.title}>Loss and Meeting Data</h2>
            <p style={S.subtle}>View loss reports, daily reviews, and analytics for {user.shopDisplayName || user.shop}.</p>
          </div>
          <div style={S.tabs}>
            <button onClick={() => setSubTab("lossData")} style={S.tabBtn(subTab === "lossData")}>Loss Report</button>
            <button onClick={() => setSubTab("dailyReview")} style={S.tabBtn(subTab === "dailyReview")}>Meeting Sheet</button>
            <button onClick={() => setSubTab("analytics")} style={S.tabBtn(subTab === "analytics")}>Analytical Sheet</button>
          </div>
        </div>
      </div>
      {subTab === "lossData" && <MeetingDashboard entries={entries} user={user} />}
      {subTab === "dailyReview" && <DailyReviewDashboard entries={entries} user={user} />}
      {subTab === "analytics" && <AnalyticalSheet entries={entries} user={user} />}
    </>
  );
}

function AdminAnalyticsCombined({ entries, user }) {
  const [subTab, setSubTab] = useState("analytics");
  return (
    <>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={S.title}>Analytics & Review Reports</h2>
            <p style={S.subtle}>Access analytical aggregations and shopwise per shift reports.</p>
          </div>
          <div style={S.tabs}>
            <button onClick={() => setSubTab("analytics")} style={S.tabBtn(subTab === "analytics")}>Analytical Sheet</button>
            <button onClick={() => setSubTab("shopShift")} style={S.tabBtn(subTab === "shopShift")}>Shopwise Per Shift</button>
          </div>
        </div>
      </div>
      {subTab === "analytics" && <AnalyticalSheet entries={entries} user={user} />}
      {subTab === "shopShift" && <ShopWisePerShift entries={entries} />}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(() => readJson(LS_KEYS.USER, null));
  const [tab, setTab] = useState(user?.role === "admin" ? "dashboard" : "submit");
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem(LS_KEYS.GAS_URL) || DEFAULT_GAS_URL || "");
  const [entries, setEntries] = useState(() => readJson(LS_KEYS.ENTRIES, []).map(normalizeEntry));
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const localRevisionRef = useRef(0);
  const syncRequestRef = useRef(0);

  useEffect(() => {
    if (DEFAULT_GAS_URL && !localStorage.getItem(LS_KEYS.GAS_URL)) {
      localStorage.setItem(LS_KEYS.GAS_URL, DEFAULT_GAS_URL);
    }
  }, []);

  function commitEntries(nextEntries) {
    localRevisionRef.current += 1;
    setEntries((current) => {
      const resolved = typeof nextEntries === "function" ? nextEntries(current) : nextEntries;
      const normalized = (resolved || []).map(normalizeEntry);
      writeJson(LS_KEYS.ENTRIES, normalized);
      return normalized;
    });
  }

  async function refreshFromServer() {
    setSyncError("");
    if (!gasUrl) { setSyncError("Add the Apps Script URL in Settings first."); return; }
    setSyncing(true);
    const requestId = ++syncRequestRef.current;
    const revisionAtStart = localRevisionRef.current;
    try {
      const result = await apiGet(gasUrl, { action: "list" });
      const remote = (result.entries || []).map(normalizeEntry);
      if (requestId !== syncRequestRef.current || revisionAtStart !== localRevisionRef.current) return;
      setEntries(remote);
      writeJson(LS_KEYS.ENTRIES, remote);
      setLastSync(new Date().toISOString());
    } catch (err) {
      setSyncError(err.message || String(err));
    } finally {
      setSyncing(false);
    }
  }

  // Initial fetch on login / URL change
  useEffect(() => { if (user && gasUrl) refreshFromServer(); }, [user?.role, gasUrl]);

  // Auto-poll every 30 seconds to keep Admin and Shop dashboards in sync
  useEffect(() => {
    if (!user || !gasUrl) return;
    const id = setInterval(() => { refreshFromServer(); }, 30000);
    return () => clearInterval(id);
  }, [user?.role, gasUrl]);

  const allowedTabs = useMemo(() => {
    if (!user) return [];
    return user.role === "admin"
      ? ["dashboard", "meetingDashboard", "lossData", "dailyReview", "analytics", "settings"]
      : ["submit"];
  }, [user]);

  useEffect(() => {
    if (user && !allowedTabs.includes(tab)) {
      setTab(user.role === "admin" ? "dashboard" : "submit");
    }
  }, [user, tab, allowedTabs]);

  const visibleEntries = useMemo(() => {
    if (!user) return [];
    return user.role === "admin"
      ? entries.map(normalizeEntry)
      : entries.map(normalizeEntry).filter((e) => e.shop === user.shop);
  }, [entries, user]);

  function logout() { localStorage.removeItem(LS_KEYS.USER); setUser(null); }
  function login(nextUser) {
    writeJson(LS_KEYS.USER, nextUser);
    setUser(nextUser);
    setTab(nextUser.role === "admin" ? "dashboard" : "submit");
  }
  if (!user) return <Login onLogin={login} />;
  return <div style={S.app}><GlobalStyle /><Nav user={user} tab={tab} setTab={setTab} onLogout={logout} /><main className="app-page" style={S.page}>
    <StatusLine gasUrl={gasUrl} lastSync={lastSync} syncError={syncError} onRefresh={refreshFromServer} syncing={syncing} />
    {user.role === "rep" && tab === "submit" && <RepSubmit user={user} gasUrl={gasUrl} entries={entries} setEntries={commitEntries} onRefresh={refreshFromServer} />}
    {user.role === "admin" && tab === "dashboard" && <Dashboard entries={entries} />}
    {user.role === "admin" && tab === "meetingDashboard" && <LossDataDashboard entries={visibleEntries} user={user} />}
    {user.role === "admin" && tab === "lossData" && <MeetingDashboard entries={visibleEntries} user={user} />}
    {user.role === "admin" && tab === "dailyReview" && <DailyReviewDashboard entries={visibleEntries} user={user} />}
    {user.role === "admin" && tab === "analytics" && <AdminAnalyticsCombined entries={visibleEntries} user={user} />}
    {user.role === "admin" && tab === "settings" && <SettingsPage gasUrl={gasUrl} setGasUrl={setGasUrl} user={user} onRefresh={refreshFromServer} entries={entries} setEntries={commitEntries} />}
  </main></div>;
}
