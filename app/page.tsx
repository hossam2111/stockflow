"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bell,
  Boxes,
  Building2,
  Check,
  Clock3,
  CircleCheck,
  ClipboardCopy,
  Download,
  FileBarChart,
  FileText,
  History,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  PackageMinus,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Search,
  ShoppingCart,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Trophy,
  Truck,
  Upload,
  Wallet,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { LiveOtp } from "./LiveOtp";

type View =
  | "organizations"
  | "dashboard"
  | "withdraw"
  | "inventory"
  | "services"
  | "employees"
  | "reports"
  | "sales"
  | "accounting"
  | "suppliers"
  | "activity"
  | "settings";

const nav: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "organizations", label: "الشركات والمساحات", icon: Building2 },
  { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { id: "withdraw", label: "سحب حساب", icon: PackageMinus },
  { id: "inventory", label: "المخزون", icon: Boxes },
  { id: "services", label: "الخدمات", icon: Layers3 },
  { id: "employees", label: "الموظفون", icon: UsersRound },
  { id: "reports", label: "التقارير", icon: FileBarChart },
  { id: "sales", label: "المبيعات", icon: ShoppingCart },
  { id: "accounting", label: "المحاسبة", icon: Wallet },
  { id: "suppliers", label: "الموردين", icon: Truck },
  { id: "activity", label: "سجل النشاط", icon: History },
  { id: "settings", label: "الإعدادات", icon: SettingsIcon },
];
const viewPermissions:Partial<Record<View,string>>={dashboard:"dashboard.view",inventory:"inventory.view",services:"services.manage",employees:"employees.manage",reports:"reports.view",sales:"sales.view_all",accounting:"accounting.view",suppliers:"suppliers.manage",activity:"activity.view",settings:"settings.manage"};

// Canonical service catalogue. The array order is also the display order across the app
// (Google, ChatGPT, CapCut, Grok, then the rest). stock/used/total are cosmetic fallbacks
// used only before live inventory data loads; real numbers come from /api/services.
const services = [
  { name: "Google Gemini", code: "Gm", color: "#4285F4", stock: 0, used: 0, total: 0, type: "فردي", price: 300 },
  { name: "ChatGPT Plus", code: "GPT", color: "#111827", stock: 0, used: 0, total: 0, type: "مشترك", price: 450 },
  { name: "CapCut Pro", code: "Cp", color: "#0EA5E9", stock: 0, used: 0, total: 0, type: "مشترك", price: 200 },
  { name: "Pro Apps", code: "PA", color: "#6366f1", stock: 0, used: 0, total: 0, type: "مشترك", price: 400 },
  { name: "Grok", code: "Gk", color: "#4B5563", stock: 0, used: 0, total: 0, type: "فردي", price: 350 },
  { name: "Canva Pro", code: "Ca", color: "#8b5cf6", stock: 0, used: 0, total: 0, type: "مشترك", price: 180 },
  { name: "Claude Pro", code: "Cl", color: "#d97706", stock: 0, used: 0, total: 0, type: "فردي", price: 500 },
  { name: "Perplexity", code: "Px", color: "#0f766e", stock: 0, used: 0, total: 0, type: "مشترك", price: 280 },
  { name: "Midjourney", code: "Mj", color: "#2563eb", stock: 0, used: 0, total: 0, type: "فردي", price: 350 },
  { name: "Adobe CC", code: "Ai", color: "#ef4444", stock: 0, used: 0, total: 0, type: "فردي", price: 620 },
  { name: "Spotify Premium", code: "Sp", color: "#1DB954", stock: 0, used: 0, total: 0, type: "مشترك", price: 120 },
  { name: "Netflix Premium", code: "Nf", color: "#E50914", stock: 0, used: 0, total: 0, type: "مشترك", price: 250 },
  { name: "YouTube Premium", code: "Yt", color: "#FF0000", stock: 0, used: 0, total: 0, type: "مشترك", price: 150 },
  { name: "Disney+", code: "Ds", color: "#113CCF", stock: 0, used: 0, total: 0, type: "مشترك", price: 200 },
  { name: "Shahid VIP", code: "Sh", color: "#00A8E1", stock: 0, used: 0, total: 0, type: "مشترك", price: 130 },
  { name: "Duolingo Super", code: "Du", color: "#58CC02", stock: 0, used: 0, total: 0, type: "فردي", price: 160 },
  { name: "GitHub Copilot", code: "Gh", color: "#24292E", stock: 0, used: 0, total: 0, type: "فردي", price: 300 },
  { name: "Microsoft 365", code: "Ms", color: "#D83B01", stock: 0, used: 0, total: 0, type: "فردي", price: 220 },
];

type InventoryRow = {
  id: string;
  serviceId: string;
  service: string;
  account: string;
  password: string;
  otpKey: string;
  otpUrl: string;
  type: string;
  accountType: "INDIVIDUAL" | "SHARED";
  usage: string;
  currentUsage: number;
  maxUsage: number;
  status: string;
  rawStatus: string;
  added: string;
  otpReady: boolean;
  expiryDate: string | null;
};

type ServiceRecord = {
  id: string;
  name: string;
  active: boolean;
  default_daily_limit: number;
  default_cost: number;
  total: number;
  available: number;
  available_slots: number;
  available_shared_slots: number;
  available_individual_accounts: number;
  total_capacity: number;
  used_slots: number;
  shared_accounts: number;
};

type WithdrawalCredentials = {
  inventoryId: string;
  email: string;
  password: string;
  otpSecret: string | null;
  otpUrl: string | null;
  accountType: "INDIVIDUAL" | "SHARED";
  allocatedUses: number;
  previousUsage: number;
  newUsage: number;
  maxUsage: number;
  remainingUsage: number;
  status: string;
  customerName: string;
  customerPhone: string;
  customerContact: string;
  customerReference: string;
  customerNotes: string;
  subscriptionStartDate: string;
  subscriptionMonths: number;
  subscriptionEndDate: string;
  warrantyDays: number;
  warrantyEndDate: string | null;
  sellingPrice?: number;
};

type WithdrawalCustomerDetails = {
  customerName: string;
  customerPhone: string;
  customerContact: string;
  customerReference: string;
  customerNotes: string;
  subscriptionStartDate: string;
  subscriptionMonths: number;
  warrantyDays: number;
  quantity: number;
  sellingPrice: number;
  paidInFull: boolean;
  paidAmount: number;
};

type DashboardStats = {
  inventory: { total: number; available: number; used: number };
  withdrawalsToday: number;
  employees: { total: number; active: number };
  withdrawalTrend: { day: string; count: number }[];
  lowStock: { id: string; name: string; available_slots: number }[];
  topEmployees: { id: string; name: string; team: string; withdrawals: number }[];
  recentActivity: { id: string; name: string; service: string; customer_name: string | null; created_at: string }[];
  revenue?: { today: number; month: number };
  topServicesByRevenue?: { name: string; revenue: number }[];
};

type EmployeeRecord = {
  id: string; email: string; name: string; initials: string; team: string; today: number; limit: number; month: number;
  enabled: boolean; accessRole:"ADMIN"|"ACCOUNTANT"|"SALES"|"EMPLOYEE"|"AUDITOR"; canManageAccounting:boolean; color: string; allowed: { id: string; name: string; enabled: boolean; limit: number }[];
};

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "employee";
  active: boolean;
  team?: string;
  organizationId?: string | null;
  organizationName?: string;
  isSuperAdmin?: boolean;
  canManageAccounting?: boolean;
  accessRole?: string;
  permissions?: string[];
};

type OrganizationRecord = {
  id:string;name:string;slug:string;active:boolean;employee_limit:number;inventory_limit:number;plan:string;
  employees:number;inventory:number;withdrawals:number;admin_email:string;
};

type EmployeeAccessStats = {
  dailyLimit: number;
  usedToday: number;
  permissions: { service_id: string; name: string; enabled: boolean; daily_limit: number; usedToday: number }[];
};

const serviceIds: Record<string, string> = {
  "Google Gemini": "google", "ChatGPT Plus": "chatgpt", "CapCut Pro": "capcut", Grok: "grok",
  "Pro Apps": "proapps", "Canva Pro": "canva", "Claude Pro": "claude", Perplexity: "perplexity", Midjourney: "midjourney",
  "Adobe CC": "adobe", "Spotify Premium": "spotify", "Netflix Premium": "netflix",
  "YouTube Premium": "youtube", "Disney+": "disney", "Shahid VIP": "shahid",
  "Duolingo Super": "duolingo", "GitHub Copilot": "github", "Microsoft 365": "microsoft365",
};
// Canonical display order = order of the `services` catalogue above. Unknown services sort to the end.
const serviceOrder = new Map(services.map((service, index) => [service.name, index]));
const serviceRank = (name: string) => serviceOrder.get(name) ?? Number.MAX_SAFE_INTEGER;

function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const safeCell = (value: string | number | boolean | null | undefined) => {
    if (value === null || value === undefined) return '""';
    const text = String(value);
    const trimmed = text.trim();

    // Prevent Excel from converting phone numbers, IDs or numeric strings (e.g. 01011111111)
    // into scientific notation (1.01E+09) or stripping leading zeros by wrapping as Excel text formula
    if (/^0\d+$|^\+?\d{8,}$/.test(trimmed)) {
      return `="` + trimmed.replaceAll('"', '""') + `"`;
    }

    const excelSafe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"` + excelSafe.replaceAll('"', '""') + `"`;
  };

  // Standard UTF-8 CSV string with BOM (\ufeff) without the sep= line that causes garbled Arabic in Excel.
  const csv = rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportToExcel(filename: string, title: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const sanitize = (val: unknown) => String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const headerHtml = headers.map((h) => `<th style="background:#1e293b;color:#ffffff;font-weight:bold;border:1px solid #cbd5e1;padding:10px 14px;text-align:center;">${sanitize(h)}</th>`).join("");
  const rowsHtml = rows.map((row, idx) => {
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    const cells = row.map((cell) => {
      const text = String(cell ?? "");
      return `<td style="border:1px solid #cbd5e1;padding:8px 12px;text-align:center;mso-number-format:'\\@';">${sanitize(text)}</td>`;
    }).join("");
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join("");

  const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${sanitize(title)}</x:Name>
<x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
  table { border-collapse: collapse; width: 100%; margin-top: 15px; }
  .title { font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 5px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 15px; }
</style>
</head>
<body>
  <div class="title">StockFlow — ${sanitize(title)}</div>
  <div class="meta">تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}</div>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(["\ufeff", template], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const name = filename.endsWith(".xls") ? filename : `${filename.replace(/\.csv$/, "")}.xls`;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportToPdf(title: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const [regularResponse,boldResponse] = await Promise.all([fetch("/fonts/Amiri-Regular.ttf"),fetch("/fonts/Amiri-Bold.ttf")]);
  if (!regularResponse.ok||!boldResponse.ok) throw new Error("PDF_FONT_UNAVAILABLE");
  const toBase64 = async (response:Response) => { const bytes=new Uint8Array(await response.arrayBuffer());let binary="";for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(binary); };
  const doc = new jsPDF({ orientation: headers.length > 5 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  doc.addFileToVFS("StockFlowArabic-Regular.ttf", await toBase64(regularResponse));
  doc.addFileToVFS("StockFlowArabic-Bold.ttf", await toBase64(boldResponse));
  doc.addFont("StockFlowArabic-Regular.ttf", "StockFlowArabic", "normal");
  doc.addFont("StockFlowArabic-Bold.ttf", "StockFlowArabic", "bold");
  doc.setFont("StockFlowArabic");
  const pdfText=(value:unknown)=>doc.processArabic(String(value??""));
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text("StockFlow", doc.internal.pageSize.getWidth() - 14, 15, { align: "right" });
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfText(title), doc.internal.pageSize.getWidth() - 14, 24, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText(`تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}`), 14, 15, { align: "left" });
  autoTable(doc, {
    startY: 30,
    head: [headers.map(pdfText)],
    body: rows.map((row) => row.map(pdfText)),
    styles: { font: "StockFlowArabic", fontSize: 8, halign: "right", cellPadding: 2.4, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "right" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 30, right: 10, bottom: 12, left: 10 },
  });
  const safeName = title.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "stockflow-report";
  doc.save(`${safeName}.pdf`);
}

function addMonthsToDate(value: string, months: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const targetFirst = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(date.getUTCDate(), lastDay))).toISOString().slice(0, 10);
}

function addDaysToDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatArabicDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function todayInCairo() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default function Home() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<"admin" | "employee">("admin");
  const [view, setView] = useState<View>("dashboard");
  const [sidebar, setSidebar] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const globalSearchRef=useRef<HTMLDivElement>(null);
  const [selectedService, setSelectedService] = useState(services[0]);
  const [dark, setDark] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importService, setImportService] = useState("ChatGPT Plus");
  const [employeeBlocked, setEmployeeBlocked] = useState(false);
  const [inventoryData, setInventoryData] = useState<InventoryRow[]>([]);
  const [serviceData, setServiceData] = useState<ServiceRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [withdrawalCredentials, setWithdrawalCredentials] = useState<WithdrawalCredentials[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [allowedServiceIds, setAllowedServiceIds] = useState<string[]>([]);
  const [employeeAccess, setEmployeeAccess] = useState<EmployeeAccessStats | null>(null);

  useEffect(()=>{
    const closeOnOutside=(event:PointerEvent)=>{if(searchOpen&&!globalSearchRef.current?.contains(event.target as Node))setSearchOpen(false);};
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setSearchOpen(false);};
    document.addEventListener("pointerdown",closeOnOutside);
    document.addEventListener("keydown",closeOnEscape);
    return()=>{document.removeEventListener("pointerdown",closeOnOutside);document.removeEventListener("keydown",closeOnEscape);};
  },[searchOpen]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const user = data.user as CurrentUser;
        setCurrentUser(user);
        setRole(user.role);
        setLoggedIn(true);
        setEmployeeBlocked(user.role === "employee" && !user.active);
        setView(user.role === "employee" ? (user.permissions?.includes("withdrawals.create")?"withdraw":user.permissions?.includes("dashboard.view")?"dashboard":"activity") : "dashboard");
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (role !== "employee" || !loggedIn || !currentUser) return;
    const sync = () =>
      fetch(`/api/employee-access?employeeId=${encodeURIComponent(currentUser.id)}`)
        .then((r) => r.json())
        .then((data) => {
          setEmployeeBlocked(!data.enabled);
          setEmployeeAccess({ dailyLimit: data.dailyLimit, usedToday: data.usedToday ?? 0, permissions: data.permissions ?? [] });
          const ids = (data.permissions ?? []).filter((permission: { enabled: boolean }) => permission.enabled).map((permission: { service_id: string }) => permission.service_id);
          setAllowedServiceIds(ids);
        })
        .catch(() => {});
    sync();
    const timer = window.setInterval(sync, 2000);
    return () => window.clearInterval(timer);
  }, [role, loggedIn, currentUser]);

  const withdrawServices = useMemo(() => {
    const live = serviceData.map((record) => {
      const visual = services.find((service) => service.name === record.name);
      return {
        name: record.name,
        code: visual?.code ?? record.name.slice(0, 2),
        color: visual?.color ?? "#2563eb",
        stock: record.available_slots ?? record.available,
        used: record.used_slots ?? Math.max(0, record.total - record.available),
        total: record.total_capacity ?? record.total,
        type: record.available_shared_slots > 0 ? "مشترك" : "فردي",
        price: visual?.price ?? 0,
      };
    });
    const source = (live.length ? live : services).slice().sort((a, b) => serviceRank(a.name) - serviceRank(b.name) || a.name.localeCompare(b.name, "ar"));
    if (role !== "employee") return source;
    return source.filter((service) => {
      const id = serviceData.find((record) => record.name === service.name)?.id ?? serviceIds[service.name];
      return allowedServiceIds.includes(id);
    });
  }, [serviceData, role, allowedServiceIds]);
  const effectiveSelectedService = withdrawServices.find((service) => service.name === selectedService.name)
    ?? withdrawServices[0]
    ?? selectedService;

  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/services").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
      data.services = (data.services as ServiceRecord[]).slice().sort((a, b) => serviceRank(a.name) - serviceRank(b.name) || a.name.localeCompare(b.name, "ar"));
      setServiceData(data.services);
      const selected = data.services.find((s: ServiceRecord) => s.name === selectedService.name);
      if (selected) setSelectedService((current) => ({
        ...current,
        stock: selected.available_slots,
        total: selected.total_capacity,
        type: selected.available_shared_slots > 0 ? "مشترك" : "فردي",
      }));
    }).catch(() => {});
    if (role === "admin" || currentUser?.permissions?.includes("inventory.view")) {
      fetch("/api/inventory").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
        setInventoryData(data.items.map((item: Record<string, unknown>) => ({
          id: String(item.id), serviceId: String(item.service_id), service: String(item.service), account: String(item.email),
          password: String(item.password ?? ""), otpKey: String(item.otp_secret ?? ""), otpUrl: String(item.otp_url ?? ""),
          type: item.account_type === "SHARED" ? "مشترك" : "فردي", accountType: item.account_type as "INDIVIDUAL" | "SHARED",
          usage: `${item.current_usage} / ${item.max_usage}`, currentUsage: Number(item.current_usage), maxUsage: Number(item.max_usage),
          rawStatus: String(item.status), status: item.status === "AVAILABLE" ? "متاح" : item.status === "FULL" ? "ممتلئ" : item.status === "DISABLED" ? "معطل" : String(item.status),
          added: new Date(String(item.created_at)).toLocaleString("ar-EG"), otpReady: Boolean(item.otp_ready),
          expiryDate: item.expiry_date ? String(item.expiry_date).slice(0, 10) : null,
        })));
      }).catch(() => {});
    }
    if (role === "admin" || currentUser?.permissions?.includes("dashboard.view")) {
      fetch("/api/dashboard").then((r) => r.ok ? r.json() : Promise.reject()).then(setDashboardStats).catch(() => {});
    }
  }, [loggedIn, role, dataVersion, selectedService.name,currentUser?.permissions]);

  async function attemptWithdrawal(details: WithdrawalCustomerDetails) {
    const selectedId = serviceData.find((service) => service.name === effectiveSelectedService.name)?.id ?? serviceIds[effectiveSelectedService.name];
    const paidAmount = details.paidInFull ? details.sellingPrice : details.paidAmount;
    const response = await fetch("/api/withdrawals", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:currentUser?.id ?? "",serviceId:selectedId,idempotencyKey:crypto.randomUUID(),...details,paidAmount})});
    const result = await response.json();
    if (!response.ok) {
      if(result.error==="EMPLOYEE_DISABLED") setEmployeeBlocked(true);
      const messages:Record<string,string>={EMPLOYEE_DISABLED:"تم إيقاف صلاحية السحب لحسابك بواسطة الأدمن",EMPLOYEE_NOT_FOUND:"حساب السحب غير موجود ضمن هذه المؤسسة — السحب متاح لحسابات الموظفين فقط",SERVICE_NOT_ALLOWED:"هذه الخدمة غير مسموحة لك",DAILY_LIMIT_REACHED:"وصلت إلى الحد اليومي العام",SERVICE_LIMIT_REACHED:"وصلت إلى حد هذه الخدمة",OUT_OF_STOCK:"لا يوجد مخزون متاح لهذه الخدمة — أضف حسابات لهذه الخدمة أولًا",INVENTORY_CONFLICT:"تعارض في المخزون، برجاء المحاولة مرة أخرى",INVALID_INPUT:"بيانات الطلب غير مكتملة أو غير صحيحة",INVALID_DATE:"تاريخ بداية الاشتراك غير صحيح"};
      flash(messages[result.error]||`تعذر تنفيذ السحب (${result.error||response.status})`);
      return;
    }
    setWithdrawalCredentials(result.credentials ?? []);
    setWithdrawn(true);
    setDataVersion((value) => value + 1);
    flash("تم تخصيص الحساب وتسجيل السحب بنجاح");
  }

  const filteredInventory = useMemo(
    () =>
      role === "employee"
        ? []
        : inventoryData.filter((r) =>
            `${r.id} ${r.service} ${r.account}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ),
    [query, role, inventoryData],
  );
  const healthTotal = dashboardStats?.inventory.total ?? serviceData.reduce((total, service) => total + (service.total_capacity ?? service.total), 0);
  const healthAvailable = dashboardStats?.inventory.available ?? serviceData.reduce((total, service) => total + (service.available_slots ?? service.available), 0);
  const inventoryHealth = healthTotal
    ? Math.round((healthAvailable / healthTotal) * 100)
    : 0;
  const liveDate = new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  const liveTime = new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }, []);
  if (!authChecked) return <main className="login" dir="rtl" />;
  if (!loggedIn)
    return (
      <Login
        onLogin={(user) => {
          setInventoryData([]); setServiceData([]); setDashboardStats(null); setWithdrawalCredentials([]); setWithdrawn(false); setQuery("");
          setCurrentUser(user);
          setRole(user.role);
          setLoggedIn(true);
          setEmployeeBlocked(user.role === "employee" && !user.active);
          setView(user.role === "employee" ? (user.permissions?.includes("withdrawals.create")?"withdraw":user.permissions?.includes("dashboard.view")?"dashboard":"activity") : "dashboard");
        }}
      />
    );

  return (
    <main dir="rtl" className={dark ? "app dark" : "app"}>
      {notice && (
        <div className="toast">
          <CircleCheck size={18} strokeWidth={2.2} />
          {notice}
        </div>
      )}
      <aside className={sidebar ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brandmark">
            <Boxes size={21} strokeWidth={2.2} />
          </div>
          <div>
            <b>
              Stock<span>Flow</span>
            </b>
            <small>إدارة المخزون بذكاء</small>
          </div>
        </div>
        <nav>
          {nav
            .filter(
              (item) => item.id === "organizations"
                ? Boolean(currentUser?.isSuperAdmin)
                : role === "admin" || (item.id === "withdraw"&&Boolean(currentUser?.permissions?.includes("withdrawals.create"))) || item.id === "activity" || Boolean(viewPermissions[item.id]&&currentUser?.permissions?.includes(viewPermissions[item.id] as string)),
            )
            .map((item) => {
              const NavIcon = item.icon;
              return (
                <button
                  key={item.id}
                  className={view === item.id ? "active" : ""}
                  onClick={() => {
                    setView(item.id);
                    setSidebar(false);
                  }}
                >
                  <NavIcon className="navIcon" size={18} strokeWidth={1.9} />
                  <span>{item.label}</span>
                  {item.id === "withdraw" && <em>سريع</em>}
                </button>
              );
            })}
        </nav>
        <div className="sidebarCard">
          <span>المخزون بحالة جيدة</span>
          <b>{inventoryHealth}%</b>
          <div>
            <i />
          </div>
          <small>{healthAvailable} عنصرًا متاحًا من {healthTotal}</small>
        </div>
        <div className="userMini">
          <div className="avatar">{currentUser?.name?.trim()?.[0] ?? (role === "admin" ? "أ" : "ع")}</div>
          <div>
            <b>{currentUser?.name ?? (role === "admin" ? "المدير" : "موظف")}</b>
            <span>
              {role === "admin" ? (currentUser?.isSuperAdmin ? "Platform Super Admin" : `Admin • ${currentUser?.organizationName ?? "الشركة"}`) : `موظف سحب${currentUser?.team ? ` • ${currentUser.team}` : ""}`}
            </span>
          </div>
            <button className="iconButton logoutButton" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});setInventoryData([]);setServiceData([]);setDashboardStats(null);setWithdrawalCredentials([]);setWithdrawn(false);setQuery("");setLoggedIn(false);setCurrentUser(null);setAllowedServiceIds([]);setEmployeeAccess(null)}}><LogOut size={17} strokeWidth={1.9} /></button>
        </div>
      </aside>
      <section className="workspace">
        <header>
          <button className="menu iconButton" aria-label="فتح القائمة" onClick={() => setSidebar(!sidebar)}>
            <Menu size={19} />
          </button>
          <div className="globalSearch" ref={globalSearchRef}>
            <div className="search">
              <Search size={17} strokeWidth={1.8} />
              <input
                value={query}
                onChange={(e) => {setQuery(e.target.value);setSearchOpen(Boolean(e.target.value));}}
                onFocus={()=>{if(query)setSearchOpen(true);}}
                placeholder="ابحث بالإيميل، رقم الحساب، الخدمة..."
              />
              <kbd>⌘ K</kbd>
            </div>
            {query && searchOpen && (
              <div className="searchResults">
                <div className="searchResultHead">
                  <b>نتائج البحث</b>
                  <span>{filteredInventory.length} نتيجة</span>
                </div>
                {filteredInventory.length ? (
                  filteredInventory.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setView("inventory");
                        setQuery(r.account);
                        setSearchOpen(false);
                      }}
                    >
                      <span className="resultIcon">@</span>
                      <div>
                        <b>{r.account}</b>
                        <small>
                          {r.service} • {r.id}
                        </small>
                      </div>
                      <em className={`status ${r.status}`}>{r.status}</em>
                    </button>
                  ))
                ) : (
                  <div className="emptySearch">
                    <b>لا توجد نتائج</b>
                    <span>
                      جرّب البحث بالإيميل أو رقم المخزون أو اسم الخدمة.
                    </span>
                  </div>
                )}
                <button
                  className="allResults"
                  onClick={() => {setView("inventory");setSearchOpen(false);}}
                >
                  عرض كل نتائج المخزون <ArrowLeft size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="headerActions">
            <button className="iconButton" aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"} title={dark ? "الوضع الفاتح" : "الوضع الداكن"} onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="bell iconButton" aria-label="الإشعارات" title="الإشعارات" onClick={() => flash("لا توجد إشعارات جديدة") }>
              <Bell size={17} /><i />
            </button>
            <div className="date">
              {liveDate}<span>{liveTime} • القاهرة</span>
            </div>
          </div>
        </header>
        <div className="page">
          {view === "organizations" && currentUser?.isSuperAdmin && (
            <Organizations onSelected={async () => {
              const response=await fetch("/api/auth/me");if(response.ok){const data=await response.json();setCurrentUser(data.user);}
              setInventoryData([]);setServiceData([]);setDashboardStats(null);setWithdrawalCredentials([]);setWithdrawn(false);setDataVersion((value)=>value+1);setQuery("");setView("dashboard");
            }} />
          )}
          {view === "dashboard" && (
            <Dashboard setView={setView} flash={flash} stats={dashboardStats} inventory={inventoryData} userName={currentUser?.name ?? "بك"} />
          )}
          {view === "withdraw" && (
            <Withdraw
              selected={effectiveSelectedService}
              setSelected={setSelectedService}
              withdrawn={withdrawn}
              credentials={withdrawalCredentials}
              blocked={role === "employee" && employeeBlocked}
              availableServices={withdrawServices}
              employeeName={currentUser?.name ?? "الموظف"}
              access={employeeAccess}
              onWithdraw={attemptWithdrawal}
              onReset={() => { setWithdrawn(false); setWithdrawalCredentials([]); }}
            />
          )}
          {view === "inventory" && (
            <Inventory
              rows={filteredInventory}
              query={query}
              setQuery={setQuery}
              flash={flash}
              onExport={() => downloadCsv("stockflow-inventory.csv", [["ID","Service","Email","Type","Usage","Status","Added"], ...filteredInventory.map((row) => [row.id,row.service,row.account,row.type,row.usage,row.status,row.added])])}
              onImport={() => setImportOpen(true)}
              onDelete={async (id: string) => {
                const response = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                  flash(result.error === "ITEM_HAS_HISTORY" ? "لا يمكن حذف حساب تم السحب عليه من قبل — احتفظنا به لحماية سجل المبيعات" : result.error === "NOT_FOUND" ? "الحساب غير موجود" : "تعذر حذف الحساب");
                  return false;
                }
                flash("تم حذف الحساب من المخزون");
                setDataVersion((value) => value + 1);
                return true;
              }}
              onBulkDelete={async (ids: string[]) => {
                let deleted = 0, blocked = 0, failed = 0;
                for (const id of ids) {
                  const response = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
                  if (response.ok) { deleted++; continue; }
                  const result = await response.json().catch(() => ({}));
                  if (result.error === "ITEM_HAS_HISTORY") blocked++; else failed++;
                }
                if (deleted) setDataVersion((value) => value + 1);
                return { deleted, blocked, failed };
              }}
              onUpdate={async (id: string, patch: Record<string, unknown>) => {
                const response = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) { flash(result.error === "NOT_FOUND" ? "الحساب غير موجود" : "تعذر حفظ التعديل"); return false; }
                setDataVersion((value) => value + 1);
                return true;
              }}
            />
          )}
          {view === "services" && (
            <Services
              records={serviceData}
              onAdd={() => setAddServiceOpen(true)}
              onView={(service) => { setQuery(service); setView("inventory"); }}
              onImport={(service) => {
                setImportService(service);
                setImportOpen(true);
              }}
              flash={flash}
              onUpdated={() => setDataVersion((value) => value + 1)}
            />
          )}
          {view === "employees" && <Employees flash={flash} />}
          {view === "reports" && <Reports />}
          {view === "sales" && <Sales flash={flash} services={serviceData} />}
          {view === "accounting" && (role === "admin" || currentUser?.permissions?.includes("accounting.view")) && <Accounting flash={flash} dataVersion={dataVersion} onChanged={() => setDataVersion((value) => value + 1)} />}
          {view === "suppliers" && <Suppliers flash={flash} services={serviceData} />}
          {view === "activity" &&
            (role === "admin" || currentUser?.permissions?.includes("activity.view") ? <Activity /> : <EmployeeHistory access={employeeAccess} />)}
          {view === "settings" && (
            <Settings dark={dark} setDark={setDark} flash={flash} />
          )}
        </div>
      </section>
      {importOpen && (
        <ImportModal
          defaultService={importService}
          services={serviceData}
          onClose={() => setImportOpen(false)}
          flash={flash}
          onImported={() => { setDataVersion((value) => value + 1); setImportOpen(false); }}
        />
      )}
      {addServiceOpen && <AddServiceModal onClose={() => setAddServiceOpen(false)} onCreated={(message) => { flash(message); setAddServiceOpen(false); setDataVersion((value) => value + 1); }} />}
    </main>
  );
}

function Login({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError,setLoginError]=useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const email = (
      e.currentTarget.querySelector('input[type="email"]') as HTMLInputElement
    ).value.toLowerCase();
    const password=(e.currentTarget.querySelector('input[type="password"],input[data-password]') as HTMLInputElement).value;
    const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const result=await response.json();setLoading(false);
    if(!response.ok){setLoginError("البريد الإلكتروني أو كلمة المرور غير صحيحة");return;}
    onLogin(result.user as CurrentUser);
  }
  return (
    <main className="login" dir="rtl">
      <section className="loginIntro">
        <div className="loginBrand">
          <div className="brandmark">S</div>
          <b>StockFlow</b>
        </div>
        <div className="heroCopy">
          <span className="eyebrow">منصة إدارة المخزون</span>
          <h1>
            كل حساب.
            <br />
            <em>تحت السيطرة.</em>
          </h1>
          <p>
            نظام واحد لإدارة مخزون الاشتراكات، متابعة فريقك، واتخاذ قرارات أسرع
            بثقة.
          </p>
          <div className="heroStats">
            <div>
              <b>2,480+</b>
              <span>عملية سحب آمنة</span>
            </div>
            <div>
              <b>99.9%</b>
              <span>دقة تخصيص المخزون</span>
            </div>
            <div>
              <b>24/7</b>
              <span>متابعة لحظية</span>
            </div>
          </div>
        </div>
        <div className="orb one" />
        <div className="orb two" />
        <small>بياناتك مشفرة ومحمية بمعايير أمان متقدمة</small>
      </section>
      <section className="loginForm">
        <form onSubmit={submit} autoComplete="off">
          <div className="mobileBrand">
            <div className="brandmark">S</div>
            <b>StockFlow</b>
          </div>
          <span className="welcome">مرحبًا بعودتك 👋</span>
          <h2>تسجيل الدخول</h2>
          <p>أدخل بيانات الحساب التي أنشأها لك مسؤول النظام.</p>
          <label>
            البريد الإلكتروني
            <input type="email" autoComplete="off" required />
          </label>
          <label>
            كلمة المرور
            <div className="password">
              <input
                type={show ? "text" : "password"}
                  data-password
                  autoComplete="new-password"
                required
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </label>
          {loginError&&<div className="loginError">{loginError}</div>}
          <div className="loginOptions">
            <label>
              <input type="checkbox" defaultChecked /> تذكرني
            </label>
            <button type="button" onClick={() => setLoginError("تواصل مع الأدمن لإعادة تعيين كلمة المرور")}>نسيت كلمة المرور؟</button>
          </div>
          <button className="loginButton" disabled={loading}>
            {loading ? "جارٍ الدخول..." : <>تسجيل الدخول <ArrowLeft size={16} /></>}
          </button>
          <div className="noSignup">
            ليس لديك حساب؟ <b>تواصل مع مسؤول النظام</b>
          </div>
        </form>
        <small>© 2026 StockFlow. جميع الحقوق محفوظة.</small>
      </section>
    </main>
  );
}

function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="pageHead">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
function Dashboard({
  setView,
  flash,
  stats,
  inventory,
  userName,
}: {
  setView: (v: View) => void;
  flash: (s: string) => void;
  stats: DashboardStats | null;
  inventory: InventoryRow[];
  userName: string;
}) {
  const trend = stats?.withdrawalTrend ?? [];
  const chartMax = Math.max(1, ...trend.map((entry) => Number(entry.count)));
  const chartPoints = trend.map((entry,index) => {
    const x = trend.length > 1 ? (index/(trend.length-1))*700 : 350;
    const y = 205-(Number(entry.count)/chartMax)*175;
    return `${x},${y}`;
  }).join(" ");
  const chartAreaPoints = chartPoints ? `0,220 ${chartPoints} 700,220` : "0,220 700,220";
  const yLabels = [chartMax,Math.round(chartMax*.75),Math.round(chartMax*.5),Math.round(chartMax*.25),0];
  const totalWithdrawals = trend.reduce((total, entry) => total + Number(entry.count), 0);
  const dailyAverage = trend.length ? Math.round(totalWithdrawals / trend.length) : 0;
  const availablePercent = stats?.inventory.total
    ? Math.round((stats.inventory.available/stats.inventory.total)*100)
    : 0;
  const employeeColors = ["#2563eb","#7c3aed","#db2777"];
  return (
    <>
      <PageHead
        title={`أهلًا، ${userName} 👋`}
        subtitle="إليك ملخص حركة المخزون والفريق اليوم."
      >
        <button
          className="secondary"
          onClick={() => {
            downloadCsv("stockflow-dashboard.csv", [
              ["المؤشر", "القيمة"],
              ["إجمالي المخزون", stats?.inventory.total ?? 0],
              ["المتاح", stats?.inventory.available ?? 0],
              ["سحوبات اليوم", stats?.withdrawalsToday ?? 0],
              ["الموظفون النشطون", stats?.employees.active ?? 0],
              ["إيراد اليوم (ج.م)", stats?.revenue?.today ?? 0],
              ["إيراد الشهر (ج.م)", stats?.revenue?.month ?? 0],
            ]);
            flash("تم تنزيل تقرير لوحة التحكم");
          }}
        >
          <Download size={15} strokeWidth={1.9} /> تصدير التقرير
        </button>
        <button className="primary" onClick={() => setView("withdraw")}>
          <Plus size={16} strokeWidth={2} /> سحب حساب
        </button>
      </PageHead>
      <div className="metrics">
        <Metric
          icon={Boxes}
          label="إجمالي المخزون"
          value={String(stats?.inventory.total ?? inventory.length)}
          change={`${stats?.inventory.used ?? 0} مستخدم`}
          note="بيانات مباشرة من المخزون"
          tone="blue"
        />
        <Metric
          icon={PackageCheck}
          label="المتاح الآن"
          value={String(stats?.inventory.available ?? inventory.filter((row) => row.rawStatus === "AVAILABLE").length)}
          change={`${availablePercent}%`}
          note="من إجمالي المخزون"
          tone="green"
        />
        <Metric
          icon={TrendingUp}
          label="سحوبات اليوم"
          value={String(stats?.withdrawalsToday ?? 0)}
          change="اليوم"
          note="عمليات مكتملة"
          tone="purple"
        />
        <Metric
          icon={UsersRound}
          label="الموظفون النشطون"
          value={String(stats?.employees.active ?? 0)}
          change={`من ${stats?.employees.total ?? 0}`}
          note={`${Math.max(0, (stats?.employees.total ?? 0) - (stats?.employees.active ?? 0))} موقوفين`}
          tone="orange"
        />
        <Metric
          icon={FileBarChart}
          label="إيراد اليوم"
          value={`${(stats?.revenue?.today ?? 0).toLocaleString("ar-EG")} ج.م`}
          change={`${(stats?.revenue?.month ?? 0).toLocaleString("ar-EG")} ج.م هذا الشهر`}
          note="من أسعار البيع المسجّلة"
          tone="green"
        />
      </div>
      <div className="dashboardGrid">
        <section className="panel chartPanel">
          <div className="panelHead">
            <div>
              <h3>نشاط السحوبات</h3>
              <p>إجمالي السحوبات خلال آخر 7 أيام</p>
            </div>
            <div className="chartSummary" aria-label="ملخص نشاط السحوبات">
              <span><b>{totalWithdrawals}</b> إجمالي</span>
              <span><b>{dailyAverage}</b> متوسط يومي</span>
            </div>
          </div>
          <div className="chart">
            <div className="yLabels">
              {yLabels.map((label,index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
            <div className="plot">
              <div className="gridlines" />
              <svg
                viewBox="0 0 700 220"
                preserveAspectRatio="none"
                aria-label="رسم نشاط السحوبات"
              >
                <defs>
                  <linearGradient id="withdrawalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5b5bd6" stopOpacity=".3" />
                    <stop offset="1" stopColor="#5b5bd6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon className="area" points={chartAreaPoints} />
                <polyline className="line" points={chartPoints} />
                {trend.map((entry,index) => {
                  const x = trend.length > 1 ? (index/(trend.length-1))*700 : 350;
                  const y = 205-(Number(entry.count)/chartMax)*175;
                  return <circle key={entry.day} className="chartPoint" cx={x} cy={y} r="4.5"><title>{`${entry.count} سحب`}</title></circle>;
                })}
              </svg>
              <div className="xLabels">
                {trend.map((entry) => <span key={entry.day}>{new Date(`${entry.day}T12:00:00`).toLocaleDateString("ar-EG",{weekday:"short"})}</span>)}
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panelHead">
            <div>
              <h3>تنبيهات المخزون</h3>
              <p>خدمات تحتاج إلى انتباهك</p>
            </div>
            <button className="link" onClick={() => setView("services")}>عرض الكل</button>
          </div>
          <div className="alerts">
            {(stats?.lowStock ?? []).map((service) => {
              const count = Number(service.available_slots);
              const visual = services.find((item) => item.name === service.name);
              return <Alert key={service.id} name={service.name} count={`${count} متبقي`}
                level={count===0 ? "نفد" : count<=2 ? "حرج" : count<=5 ? "منخفض" : "جيد"}
                color={visual?.color ?? "#2563eb"} onOpen={() => setView("inventory")} />;
            })}
            {!stats?.lowStock?.length && <div className="emptyState">لا توجد خدمات لعرضها.</div>}
          </div>
        </section>
      </div>
      <div className="dashboardGrid lower">
        <section className="panel">
          <div className="panelHead">
            <div>
              <h3>أفضل الموظفين</h3>
              <p>حسب عدد السحوبات هذا الشهر</p>
            </div>
            <button className="link" onClick={() => setView("employees")}>
              كل الموظفين <ArrowLeft size={13} />
            </button>
          </div>
          <div className="leaderboard">
            {(stats?.topEmployees ?? []).map((employee, i) => (
              <div key={employee.id}>
                <strong>{i + 1}</strong>
                <span className="avatar" style={{ background: employeeColors[i%employeeColors.length] }}>
                  {employee.name.split(" ").map((part) => part[0]).slice(0,2).join(" ")}
                </span>
                <p>
                  <b>{employee.name}</b>
                  <span>{employee.team}</span>
                </p>
                <em>
                  {employee.withdrawals}
                  <small> سحب</small>
                </em>
              </div>
            ))}
            {!stats?.topEmployees?.length && <div className="emptyState">لا يوجد موظفون في هذه المساحة.</div>}
          </div>
        </section>
        <section className="panel">
          <div className="panelHead">
            <div>
              <h3>آخر النشاطات</h3>
              <p>تحديثات مباشرة من النظام</p>
            </div>
            <span className="live">● مباشر</span>
          </div>
          <div className="activityList">
            {(stats?.recentActivity ?? []).map((entry) => (
              <div key={entry.id}>
                <i className="blue"><ActivityIcon size={15} strokeWidth={1.9} /></i>
                <p>
                  <b>{entry.name}</b>
                  <span>سحب {entry.service}{entry.customer_name ? ` — ${entry.customer_name}` : ""}</span>
                </p>
                <time>{new Date(entry.created_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"})}</time>
              </div>
            ))}
            {!stats?.recentActivity?.length && <div className="emptyState">لا توجد سحوبات مسجلة بعد.</div>}
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  change,
  note,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change: string;
  note: string;
  tone: string;
}) {
  const MetricIcon = icon;
  return (
    <div className="metric">
      <div className={`metricIcon ${tone}`}><MetricIcon size={18} strokeWidth={2} /></div>
      <span>{label}</span>
      <b>{value}</b>
      <p>
        <em className={tone}>{change}</em> {note}
      </p>
      <div className={`metricAccent ${tone}`} />
    </div>
  );
}
function Alert({
  name,
  count,
  level,
  color,
  onOpen,
}: {
  name: string;
  count: string;
  level: string;
  color: string;
  onOpen: () => void;
}) {
  return (
    <div className="alert">
      <div className="serviceIcon" style={{ background: color }}>
        {name.slice(0, 2)}
      </div>
      <p>
        <b>{name}</b>
        <span>{count}</span>
      </p>
      <em>{level}</em>
      <button className="iconButton" aria-label={`عرض مخزون ${name}`} onClick={onOpen}><ArrowLeft size={15} /></button>
    </div>
  );
}

function Withdraw({
  selected,
  setSelected,
  withdrawn,
  credentials,
  onWithdraw,
  onReset,
  blocked,
  availableServices,
  employeeName,
  access,
}: {
  selected: (typeof services)[0];
  setSelected: (s: (typeof services)[0]) => void;
  withdrawn: boolean;
  credentials: WithdrawalCredentials[];
  blocked: boolean;
  availableServices: (typeof services);
  employeeName: string;
  access: EmployeeAccessStats | null;
  onWithdraw: (details: WithdrawalCustomerDetails) => Promise<void>;
  onReset: () => void;
}) {
  const [details, setDetails] = useState<WithdrawalCustomerDetails>({
    customerName: "", customerPhone: "", customerContact: "واتساب", customerReference: "", customerNotes: "",
    subscriptionStartDate: todayInCairo(), subscriptionMonths: 1, warrantyDays: 30, quantity: 1, sellingPrice: 0, paidInFull: true, paidAmount: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const fallbackAccount: WithdrawalCredentials = {
    inventoryId: "", email: "", password: "", otpSecret: null, otpUrl: null,
    accountType: selected.type === "مشترك" ? "SHARED" : "INDIVIDUAL",
    allocatedUses: details.quantity, previousUsage: 0, newUsage: details.quantity,
    maxUsage: Math.max(1, details.quantity), remainingUsage: 0, status: "AVAILABLE",
    customerName: details.customerName, customerPhone: details.customerPhone, customerContact: details.customerContact,
    customerReference: details.customerReference, customerNotes: details.customerNotes,
    subscriptionStartDate: details.subscriptionStartDate, subscriptionMonths: details.subscriptionMonths,
    subscriptionEndDate: addMonthsToDate(details.subscriptionStartDate, details.subscriptionMonths),
    warrantyDays: details.warrantyDays, warrantyEndDate: details.warrantyDays ? addDaysToDate(details.subscriptionStartDate, details.warrantyDays) : null,
    sellingPrice: details.sellingPrice,
  };
  const accounts = credentials.length ? credentials : [fallbackAccount];
  const account = accounts[0];
  const usedToday = access?.usedToday ?? 0;
  const dailyLimit = access?.dailyLimit ?? 0;
  const remainingToday = Math.max(0, dailyLimit - usedToday);
  const usagePercent = dailyLimit > 0 ? Math.min(100, Math.round((usedToday / dailyLimit) * 100)) : 0;
  const previewEndDate = addMonthsToDate(details.subscriptionStartDate, details.subscriptionMonths);
  const previewWarrantyEnd = details.warrantyDays ? addDaysToDate(details.subscriptionStartDate, details.warrantyDays) : null;
  const totalAllocatedUses = accounts.reduce((total, item) => total + item.allocatedUses, 0);
  const accountLines = accounts.map((item, index) => `${item.accountType === "SHARED" ? "الحساب المشترك" : "الحساب"} ${index + 1}\n📧 الإيميل: ${item.email}\n🔑 كلمة المرور: ${item.password}\n🔐 مفتاح OTP: ${item.otpSecret || "غير متوفر"}\n🌐 رابط استخراج OTP: ${item.otpUrl || "غير متوفر"}${item.accountType === "SHARED" ? `\n👥 عدد مرات السحب: ${item.allocatedUses}\n📊 الاستخدام بعد السحب: ${item.newUsage} من ${item.maxUsage}\n📦 المتبقي: ${item.remainingUsage}` : ""}`).join("\n\n");
  const priceLine = account.sellingPrice ? `\n💵 سعر البيع: ${account.sellingPrice} ج.م` : "";
  const deliveryMessage = `أهلًا ${account.customerName || "بك"} 👋\nتم تسجيل ${totalAllocatedUses} ${totalAllocatedUses === 1 ? "عملية سحب" : "عمليات سحب"} في خدمة ${selected.name} بنجاح.\n\n${accountLines}\n\n📅 بداية الاشتراك: ${formatArabicDate(account.subscriptionStartDate)}\n⏳ مدة الاشتراك: ${account.subscriptionMonths} ${account.subscriptionMonths === 1 ? "شهر" : "شهور"}\n🏁 تاريخ الانتهاء: ${formatArabicDate(account.subscriptionEndDate)}\n🛡️ الضمان: ${account.warrantyDays ? `${account.warrantyDays} يوم — حتى ${formatArabicDate(account.warrantyEndDate)}` : "بدون ضمان"}${priceLine}\n\n⚠️ برجاء عدم تغيير بيانات الحسابات.\nشكرًا لاختيارك لنا 💙`;
  function resetForNext() {
    setDetails({ customerName: "", customerPhone: "", customerContact: "واتساب", customerReference: "", customerNotes: "", subscriptionStartDate: todayInCairo(), subscriptionMonths: 1, warrantyDays: 30, quantity: 1, sellingPrice: 0, paidInFull: true, paidAmount: 0 });
    onReset();
  }
  async function submitWithdrawal() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onWithdraw(details);
    } finally {
      setSubmitting(false);
    }
  }
  async function copyDeliveryMessage() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(deliveryMessage);
    setMessageCopied(true);
    window.setTimeout(() => setMessageCopied(false), 1800);
  }
  return (
    <>
      <PageHead
        title="سحب وتسليم حساب"
        subtitle="رحلة كاملة من اختيار الخدمة إلى تسليم بيانات الحساب للعميل."
      />
      {blocked && <div className="blockedBanner"><i>!</i><div><b>صلاحية السحب متوقفة</b><span>قام الأدمن بإيقاف حساب {employeeName} من تنفيذ أي عمليات سحب جديدة.</span></div></div>}
      <div className="journeySteps">
        <div className="active">
          <b>1</b>
          <span>
            اختيار الخدمة<small>حدد الخدمة المطلوبة</small>
          </span>
        </div>
        <i />
        <div className={!withdrawn ? "active" : "done"}>
          <b>{withdrawn ? <Check size={15} strokeWidth={2.4} /> : "2"}</b>
          <span>
            تأكيد السحب<small>مراجعة وتخصيص آمن</small>
          </span>
        </div>
        <i />
        <div className={withdrawn ? "success" : ""}>
          <b>3</b>
          <span>
            التسليم للعميل<small>نسخ الرسالة الجاهزة</small>
          </span>
        </div>
      </div>
      <div className="withdrawLayout">
        <section className="panel withdrawMain">
          <div className="stepTitle">
            <b>1</b>
            <div>
              <h3>اختر الخدمة</h3>
              <p>الخدمات المسموح لك بالسحب منها</p>
            </div>
          </div>
          <div className="servicePicker">
            {availableServices.map((s) => (
              <button
                key={s.name}
                onClick={() => { setSelected(s); if (withdrawn) resetForNext(); }}
                className={selected.name === s.name ? "selected" : ""}
              >
                <span className="serviceIcon" style={{ background: s.color }}>
                  {s.code}
                </span>
                <b>{s.name}</b>
                <small>{s.stock} {s.type === "مشترك" ? "مقعد متاح" : "حساب متاح"}</small>
                <i><Check size={13} strokeWidth={2.6} /></i>
              </button>
            ))}
            {!availableServices.length && <div className="emptyState">لا توجد خدمات مسموحة لهذا الموظف. راجع صلاحياته من حساب الأدمن.</div>}
          </div>
          <div className="stepTitle">
            <b>{withdrawn ? "3" : "2"}</b>
            <div>
              <h3>
                {withdrawn ? "بيانات الحساب ورسالة التسليم" : "تأكيد السحب"}
              </h3>
              <p>
                {withdrawn
                  ? "انسخ الرسالة كاملة وأرسلها مباشرة للعميل"
                  : "راجع تفاصيل الخدمة وحدودك قبل التأكيد"}
              </p>
            </div>
          </div>
          {!withdrawn && (
            <>
              <div className="withdrawSummary">
                <div>
                  <span
                    className="serviceIcon"
                    style={{ background: selected.color }}
                  >
                    {selected.code}
                  </span>
                  <p>
                    <b>{selected.name}</b>
                    <span>حساب {selected.type} • تخصيص ذكي</span>
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>المتاح حاليًا</dt>
                    <dd>{selected.stock} {selected.type === "مشترك" ? "مرة سحب" : "حساب"}</dd>
                  </div>
                  <div>
                    <dt>طريقة التخصيص</dt>
                    <dd>FIFO — الأقدم أولًا</dd>
                  </div>
                  <div>
                    <dt>وقت التنفيذ</dt>
                    <dd>فوري وآمن</dd>
                  </div>
                </dl>
              </div>
              <div className="customerSubscriptionForm">
                <div className="formSectionHead">
                  <div>
                    <h4>بيانات العميل والاشتراك</h4>
                    <p>تُحفظ مع عملية السحب ويُحسب الانتهاء والضمان تلقائيًا.</p>
                  </div>
                  <span>مطلوب قبل السحب</span>
                </div>
                <div className="customerFields">
                  <label>{selected.type === "مشترك" ? "عدد مرات سحب الإيميل المشترك" : "عدد الحسابات المطلوبة"} *
                    <input type="number" min={1} max={Math.min(20, Math.max(1, selected.stock))} value={details.quantity} onChange={(event) => setDetails({ ...details, quantity: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} />
                    <small>{selected.type === "مشترك" ? "يمكن سحب نفس الإيميل أكثر من مرة حتى يصل إلى الحد الأقصى." : "سيتم تخصيص العدد بالكامل في عملية واحدة آمنة."}</small>
                  </label>
                  <label>اسم العميل *
                    <input value={details.customerName} onChange={(event) => setDetails({ ...details, customerName: event.target.value })} placeholder="مثال: أحمد محمد" required />
                  </label>
                  <label>رقم الهاتف
                    <input value={details.customerPhone} onChange={(event) => setDetails({ ...details, customerPhone: event.target.value })} placeholder="01xxxxxxxxx" dir="ltr" />
                  </label>
                  <label>وسيلة التواصل
                    <select value={details.customerContact} onChange={(event) => setDetails({ ...details, customerContact: event.target.value })}>
                      <option>واتساب</option><option>فيسبوك</option><option>إنستجرام</option><option>تليجرام</option><option>أخرى</option>
                    </select>
                  </label>
                  <label>رقم الطلب / المرجع
                    <input value={details.customerReference} onChange={(event) => setDetails({ ...details, customerReference: event.target.value })} placeholder="اختياري" />
                  </label>
                  <label>تاريخ بداية الاشتراك
                    <input type="date" value={details.subscriptionStartDate} onChange={(event) => setDetails({ ...details, subscriptionStartDate: event.target.value })} />
                  </label>
                  <label>مدة الاشتراك
                    <select value={details.subscriptionMonths} onChange={(event) => setDetails({ ...details, subscriptionMonths: Number(event.target.value) })}>
                      <option value={1}>شهر واحد</option><option value={2}>شهران</option><option value={3}>3 شهور</option><option value={6}>6 شهور</option><option value={12}>سنة</option>
                    </select>
                  </label>
                  <label>مدة الضمان
                    <select value={details.warrantyDays} onChange={(event) => setDetails({ ...details, warrantyDays: Number(event.target.value) })}>
                      <option value={0}>بدون ضمان</option><option value={7}>7 أيام</option><option value={14}>14 يومًا</option><option value={30}>30 يومًا</option><option value={60}>60 يومًا</option><option value={90}>90 يومًا</option><option value={180}>6 شهور</option><option value={365}>سنة</option>
                    </select>
                  </label>
                  <label>سعر البيع (ج.م)
                    <input type="number" min={0} value={details.sellingPrice || ""} onChange={(event) => setDetails({ ...details, sellingPrice: Math.max(0, Number(event.target.value) || 0) })} placeholder="0" />
                  </label>
                  <label>حالة الدفع
                    <select value={details.paidInFull ? "FULL" : "PARTIAL"} onChange={(event) => setDetails({ ...details, paidInFull: event.target.value === "FULL" })}>
                      <option value="FULL">مدفوع بالكامل</option>
                      <option value="PARTIAL">آجل / دفعة جزئية</option>
                    </select>
                  </label>
                  {!details.paidInFull && (
                    <label>المدفوع الآن (ج.م)
                      <input type="number" min={0} max={details.sellingPrice} value={details.paidAmount || ""} onChange={(event) => setDetails({ ...details, paidAmount: Math.max(0, Math.min(details.sellingPrice, Number(event.target.value) || 0)) })} placeholder="0" />
                      <small>المتبقي على العميل: {Math.max(0, details.sellingPrice - details.paidAmount)} ج.م لكل حساب</small>
                    </label>
                  )}
                  <label className="wideField">ملاحظات العميل
                    <textarea value={details.customerNotes} onChange={(event) => setDetails({ ...details, customerNotes: event.target.value })} placeholder="أي تعليمات أو تفاصيل إضافية..." />
                  </label>
                </div>
                <div className="datePreview">
                  <div><span>{selected.type === "مشترك" ? "مرات السحب" : "عدد الحسابات"}</span><b>{details.quantity} {selected.type === "مشترك" ? "مرة" : details.quantity === 1 ? "حساب" : "حسابات"}</b></div><div><span>بداية الاشتراك</span><b>{formatArabicDate(details.subscriptionStartDate)}</b></div>
                  <i>←</i>
                  <div><span>نهاية الاشتراك</span><b>{formatArabicDate(previewEndDate)}</b></div>
                  <div><span>الضمان</span><b>{previewWarrantyEnd ? `حتى ${formatArabicDate(previewWarrantyEnd)}` : "بدون ضمان"}</b></div>
                </div>
              </div>
              <div className="atomicNotice">
                <i><ShieldCheck size={19} strokeWidth={1.9} /></i>
                <div>
                  <b>تخصيص آمن بدون تعارض</b>
                  <span>يتم حجز كل الحسابات وتخصيصها لك داخل عملية قاعدة بيانات واحدة.</span>
                </div>
              </div>
              <button className="withdrawButton" disabled={submitting || blocked || details.customerName.trim().length < 2 || !details.subscriptionStartDate || details.quantity < 1 || details.quantity > selected.stock} onClick={submitWithdrawal}>
                {submitting ? "جاري تنفيذ السحب..." : <>تأكيد سحب {details.quantity} {selected.type === "مشترك" ? "مرة" : details.quantity === 1 ? "حساب" : "حسابات"} <ArrowLeft size={17} /></>}
              </button>
            </>
          )}
          {withdrawn && (
            <div className="deliveryCard">
              <div className="deliverySuccess">
                <i><Check size={18} strokeWidth={2.5} /></i>
                <div>
                  <b>تم تسجيل {totalAllocatedUses} {totalAllocatedUses === 1 ? "عملية سحب" : "عمليات سحب"} بنجاح</b>
                  <span>{accounts.length} {accounts.length === 1 ? "إيميل مستخدم" : "إيميلات مستخدمة"} • تمت العملية كوحدة واحدة</span>
                </div>
              </div>
              <div className="batchCredentials">
                {accounts.map((item, index) => (
                  <div className="accountDeliveryBlock" key={item.inventoryId || index}>
                    <div className="accountDeliveryTitle">
                      <b>{item.accountType === "SHARED" ? "الحساب المشترك" : "الحساب"} {index + 1}</b>
                      <span>{item.accountType === "SHARED" ? `${item.allocatedUses} مرة • ${item.newUsage}/${item.maxUsage} • متبقي ${item.remainingUsage}` : item.inventoryId}</span>
                    </div>
                    <div className="credentials">
                      <Credential label="الإيميل" value={item.email} />
                      <Credential label="كلمة المرور" value={item.password} />
                      <Credential label="مفتاح OTP" value={item.otpSecret || "غير متوفر"} />
                      <Credential label="موقع استخراج OTP" value={item.otpUrl || "غير متوفر"} link={Boolean(item.otpUrl)} />
                    </div>
                    {item.otpSecret && <div className="otpLiveRow"><LiveOtp secret={item.otpSecret} /></div>}
                    {item.accountType === "SHARED" && (
                      <div className={`sharedAccountState ${item.status === "FULL" ? "full" : "available"}`}>
                        {item.status === "FULL"
                          ? "اكتمل الحد الأقصى — الحساب محفوظ في المخزون لكنه لن يظهر في السحب."
                          : `الحساب ما زال متاحًا — يمكن سحبه ${item.remainingUsage} ${item.remainingUsage === 1 ? "مرة إضافية" : "مرات إضافية"}.`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="subscriptionReceipt">
                <div><span>العميل</span><b>{account.customerName}</b><small>{[account.customerPhone, account.customerContact].filter(Boolean).join(" • ") || "بدون بيانات تواصل"}</small></div>
                <div><span>مدة الاشتراك</span><b>{account.subscriptionMonths} {account.subscriptionMonths === 1 ? "شهر" : "شهور"}</b><small>{formatArabicDate(account.subscriptionStartDate)} — {formatArabicDate(account.subscriptionEndDate)}</small></div>
                <div><span>الضمان</span><b>{account.warrantyDays ? `${account.warrantyDays} يوم` : "بدون ضمان"}</b><small>{account.warrantyEndDate ? `ينتهي ${formatArabicDate(account.warrantyEndDate)}` : "غير مضاف"}</small></div>
                <div><span>سعر البيع</span><b>{account.sellingPrice ? `${account.sellingPrice} ج.م` : "—"}</b><small>{accounts.length > 1 ? `إجمالي: ${(account.sellingPrice || 0) * accounts.length} ج.م` : "سعر فردي"}</small></div>
              </div>
              <div className="templateHead">
                <div>
                  <b>رسالة جاهزة للعميل</b>
                  <span>تم إنشاؤها تلقائيًا من قالب الخدمة</span>
                </div>
                <span>قالب افتراضي</span>
              </div>
              <pre>{deliveryMessage}</pre>
              <button
                className="copyMessage"
                onClick={copyDeliveryMessage}
              >
                {messageCopied ? <><Check size={16} strokeWidth={2.3} /> تم نسخ الرسالة ✓</> : <><ClipboardCopy size={16} strokeWidth={1.9} /> نسخ الرسالة كاملة</>}
              </button>
              <button className="secondary newWithdrawal" onClick={resetForNext}>تنفيذ عملية سحب جديدة</button>
            </div>
          )}
          <p className="secureNote">
            🔒 بيانات الحساب تظهر للموظف بعد نجاح السحب فقط.
          </p>
        </section>
        <aside className="withdrawSide">
          <section className="panel limitCard">
            <div className="limitRing">
              <span>{usagePercent}%</span>
            </div>
            <div>
              <h3>الحد اليومي للموظف</h3>
              <b>{usedToday} / {dailyLimit}</b>
              <small>{remainingToday} عمليات متبقية اليوم</small>
            </div>
            <div className="progress">
              <i style={{ width: `${usagePercent}%` }} />
            </div>
            <hr />
            {access?.permissions.filter((permission) => permission.enabled).map((permission) => (
              <div className="miniLimit" key={permission.service_id}>
                <span>{permission.name}</span>
                <b>{permission.usedToday} / {permission.daily_limit}</b>
              </div>
            ))}
          </section>
          <section className="panel templateInfo">
            <span><Sparkles size={19} strokeWidth={1.8} /></span>
            <h3>قوالب تسليم ذكية</h3>
            <p>
              يمكن للأدمن تخصيص رسالة مختلفة لكل خدمة وتحديد ترتيب الحقول
              والتعليمات التي ستظهر للعميل.
            </p>
            <div>
              <b>الحقول الحالية</b>
              <em>إيميل</em>
              <em>باسورد</em>
              <em>OTP</em>
              <em>رابط OTP</em>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function Credential({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copyValue() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <span>{label}</span>
      <b dir="ltr">
        {link ? (
          <a href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </b>
      <button onClick={copyValue}>{copied ? "تم النسخ ✓" : "نسخ"}</button>
    </div>
  );
}

function Inventory({
  rows,
  query,
  setQuery,
  onImport,
  onExport,
  onDelete,
  onBulkDelete,
  onUpdate,
  flash,
}: {
  rows: InventoryRow[];
  query: string;
  setQuery: (s: string) => void;
  flash: (s: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDelete: (id: string) => Promise<boolean>;
  onBulkDelete: (ids: string[]) => Promise<{ deleted: number; blocked: number; failed: number }>;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  async function handleDelete(row: InventoryRow, closeModal?: boolean) {
    if (deletingId) return;
    if (!window.confirm(`حذف الحساب ${row.account} (${row.id}) نهائيًا من المخزون؟`)) return;
    setDeletingId(row.id);
    try {
      const ok = await onDelete(row.id);
      if (ok && closeModal) setSelected(null);
    } finally {
      setDeletingId(null);
    }
  }
  function toggleOne(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const visibleRows = useMemo(() => rows.filter((row) =>
    (serviceFilter === "ALL" || row.service === serviceFilter) &&
    (statusFilter === "ALL" || row.rawStatus === statusFilter) &&
    (typeFilter === "ALL" || row.accountType === typeFilter)
  ), [rows, serviceFilter, statusFilter, typeFilter]);
  const total = rows.length;
  const available = rows.filter((row) => row.rawStatus === "AVAILABLE").length;
  const used = rows.filter((row) => row.currentUsage > 0).length;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id));
  const selectedCount = visibleRows.filter((row) => selectedIds.has(row.id)).length;
  function toggleAll() {
    setSelectedIds((prev) => (visibleRows.every((row) => prev.has(row.id)) ? new Set() : new Set(visibleRows.map((row) => row.id))));
  }
  async function bulkDelete() {
    const ids = visibleRows.filter((row) => selectedIds.has(row.id)).map((row) => row.id);
    if (!ids.length || bulkBusy) return;
    if (!window.confirm(`حذف ${ids.length} حساب محدد؟ (الحسابات التي تم السحب عليها لن تُحذف)`)) return;
    setBulkBusy(true);
    try {
      const { deleted, blocked, failed } = await onBulkDelete(ids);
      setSelectedIds(new Set());
      flash(`تم حذف ${deleted} حساب${blocked ? ` — تعذّر حذف ${blocked} (لها سجل سحب)` : ""}${failed ? ` — فشل ${failed}` : ""}`);
    } finally {
      setBulkBusy(false);
    }
  }
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [editForm, setEditForm] = useState({ password: "", otpSecret: "", otpUrl: "", maxUsage: 1, accountType: "INDIVIDUAL" as "INDIVIDUAL" | "SHARED", expiryDate: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  function openEdit(row: InventoryRow) {
    setEditForm({ password: row.password, otpSecret: row.otpKey, otpUrl: row.otpUrl, maxUsage: row.maxUsage, accountType: row.accountType, expiryDate: row.expiryDate ?? "" });
    setEditing(row);
  }
  async function saveEdit() {
    if (!editing || savingEdit) return;
    setSavingEdit(true);
    try {
      const patch: Record<string, unknown> = { password: editForm.password, accountType: editForm.accountType, expiryDate: editForm.expiryDate || null, otpSecret: editForm.otpSecret || null, otpUrl: editForm.otpUrl || null };
      if (editForm.accountType === "SHARED") patch.maxUsage = editForm.maxUsage;
      const ok = await onUpdate(editing.id, patch);
      if (ok) { flash("تم حفظ التعديل"); setEditing(null); }
    } finally { setSavingEdit(false); }
  }
  async function toggleDisabled(row: InventoryRow) {
    const disable = row.rawStatus !== "DISABLED";
    const ok = await onUpdate(row.id, { status: disable ? "DISABLED" : "AVAILABLE" });
    if (ok) flash(disable ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
  }
  return (
    <>
      <PageHead
        title="المخزون"
        subtitle="إدارة كل الحسابات والاشتراكات من مكان واحد."
      >
        <button className="secondary" onClick={() => { exportToExcel("stockflow-inventory.xls", "تقرير المخزون الشامل", ["رقم العنصر","الخدمة","الإيميل","النوع","الاستخدام","الحالة","تاريخ الإضافة"], visibleRows.map((row) => [row.id,row.service,row.account,row.type,row.usage,row.status,row.added])); flash("تم تصدير ملف Excel للمخزون"); }}><Download size={15} /> تصدير Excel</button>
        <button className="secondary" onClick={() => { exportToPdf("تقرير المخزون الشامل", ["رقم العنصر","الخدمة","الإيميل","النوع","الاستخدام","الحالة","تاريخ الإضافة"], visibleRows.map((row) => [row.id,row.service,row.account,row.type,row.usage,row.status,row.added])); flash("فتح تقرير PDF للمخزون"); }}><FileText size={15} /> تصدير PDF</button>
        <button className="secondary" onClick={() => { onExport(); flash("تم تنزيل ملف CSV للمخزون"); }}><Download size={15} /> CSV</button>
        <button className="primary" onClick={onImport}>
          <Plus size={16} /> رفع بيانات الحسابات
        </button>
      </PageHead>
      <div className="metrics compact">
        <Metric
          icon={Boxes}
          label="كل العناصر"
          value={String(total)}
          change="100%"
          note="الإجمالي"
          tone="blue"
        />
        <Metric
          icon={PackageCheck}
          label="متاح"
          value={String(available)}
          change="45.1%"
          note="جاهز للسحب"
          tone="green"
        />
        <Metric
          icon={TrendingUp}
          label="مستخدم"
          value={String(used)}
          change="50.2%"
          note="تم تخصيصه"
          tone="purple"
        />
        <Metric
          icon={AlertTriangle}
          label="منتهي / معطل"
          value={String(rows.filter((row) => !["AVAILABLE", "FULL"].includes(row.rawStatus)).length)}
          change="4.7%"
          note="يحتاج مراجعة"
          tone="orange"
        />
      </div>
      <section className="panel tablePanel">
        <div className="tableTools">
          <div className="search wide">
            <Search size={17} strokeWidth={1.8} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالإيميل، الخدمة أو رقم المخزون..."
            />
          </div>
          <select aria-label="فلتر الخدمة" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
            <option value="ALL">كل الخدمات</option>
            {[...new Set(rows.map((row) => row.service))].map((service) => <option key={service}>{service}</option>)}
          </select>
          <select aria-label="فلتر الحالة" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">كل الحالات</option><option value="AVAILABLE">متاح</option><option value="FULL">ممتلئ</option>
          </select>
          <select aria-label="فلتر النوع" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="ALL">كل الأنواع</option><option value="INDIVIDUAL">فردي</option><option value="SHARED">مشترك</option>
          </select>
          <button onClick={() => { setServiceFilter("ALL"); setStatusFilter("ALL"); setTypeFilter("ALL"); setQuery(""); }}>مسح الفلاتر</button>
        </div>
        {selectedCount > 0 && (
          <div className="bulkBar">
            <span>تم تحديد {selectedCount} حساب</span>
            <div>
              <button onClick={() => exportToExcel("stockflow-inventory-selected.xls", "المخزون المحدد", ["رقم العنصر","الخدمة","الإيميل","النوع","الاستخدام","الحالة","تاريخ الإضافة"], visibleRows.filter((row) => selectedIds.has(row.id)).map((row) => [row.id,row.service,row.account,row.type,row.usage,row.status,row.added]))}><Download size={14} /> Excel المحدد</button>
              <button onClick={() => exportToPdf("المخزون المحدد", ["رقم العنصر","الخدمة","الإيميل","النوع","الاستخدام","الحالة","تاريخ الإضافة"], visibleRows.filter((row) => selectedIds.has(row.id)).map((row) => [row.id,row.service,row.account,row.type,row.usage,row.status,row.added]))}><FileText size={14} /> PDF المحدد</button>
              <button className="danger" disabled={bulkBusy} onClick={bulkDelete}><Trash2 size={14} /> حذف المحدد</button>
              <button onClick={() => setSelectedIds(new Set())}>إلغاء التحديد</button>
            </div>
          </div>
        )}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="تحديد الكل" checked={allVisibleSelected} onChange={toggleAll} />
                </th>
                <th>رقم العنصر</th>
                <th>الخدمة</th>
                <th>الإيميل</th>
                <th>OTP</th>
                <th>النوع</th>
                <th>الاستخدام</th>
                <th>الحالة</th>
                <th>ينتهي في</th>
                <th>تاريخ الإضافة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" aria-label={`تحديد ${r.account}`} checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} />
                  </td>
                  <td>
                    <b className="mono">{r.id}</b>
                  </td>
                  <td>
                    <b>{r.service}</b>
                  </td>
                  <td className="mono accountCell">{r.account}</td>
                  <td>
                    <span className={r.otpReady ? "otpReady" : "status"}>{r.otpReady ? <><Check size={12} /> جاهز</> : "غير متوفر"}</span>
                  </td>
                  <td>{r.type}</td>
                  <td>
                    <span className="usage">{r.usage}</span>
                  </td>
                  <td>
                    <span className={`status ${r.status}`}>{r.status}</span>
                  </td>
                  <td>{r.expiryDate ? formatArabicDate(r.expiryDate) : "—"}</td>
                  <td>{r.added}</td>
                  <td>
                    <div className="rowActions">
                      <button className="dots" aria-label={`عرض ${r.account}`} onClick={() => setSelected(r)}>عرض</button>
                      <button className="dots" aria-label={`تعديل ${r.account}`} onClick={() => openEdit(r)}><Pencil size={14} /></button>
                      <button className="dots" aria-label={r.rawStatus === "DISABLED" ? `تفعيل ${r.account}` : `تعطيل ${r.account}`} onClick={() => toggleDisabled(r)}>{r.rawStatus === "DISABLED" ? <Power size={14} /> : <PowerOff size={14} />}</button>
                      <button className="dots danger" aria-label={`حذف ${r.account}`} disabled={deletingId === r.id} onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>عرض {visibleRows.length} من {rows.length}</span>
          <div><button className="active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>أعلى الصفحة</button></div>
        </div>
      </section>
      {selected && (
        <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="accountModal">
            <header><div><h2>{selected.service}</h2><p>{selected.id}</p></div><button onClick={() => setSelected(null)}>×</button></header>
            <div className="credentials">
              <Credential label="الإيميل" value={selected.account} />
              <Credential label="كلمة المرور" value={selected.password} />
              <Credential label="مفتاح OTP" value={selected.otpKey || "غير متوفر"} />
              <Credential label="موقع استخراج OTP" value={selected.otpUrl || "غير متوفر"} link={Boolean(selected.otpUrl)} />
            </div>
            {selected.otpKey && <div className="otpLiveRow"><LiveOtp secret={selected.otpKey} /></div>}
            <footer><button className="danger" disabled={deletingId === selected.id} onClick={() => handleDelete(selected, true)}><Trash2 size={14} /> حذف من المخزون</button><button className="primary" onClick={() => setSelected(null)}>تم</button></footer>
          </section>
        </div>
      )}
      {editing && (
        <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <section className="accountModal">
            <header><div><h2>تعديل الحساب</h2><p>{editing.id} — {editing.account}</p></div><button onClick={() => setEditing(null)}>×</button></header>
            <div className="editForm">
              <label className="editField wide">الإيميل (لا يمكن تعديله)
                <input value={editing.account} readOnly disabled dir="ltr" />
              </label>
              <label className="editField wide">كلمة المرور
                <input value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} dir="ltr" />
              </label>
              <label className="editField">نوع الحساب
                <select value={editForm.accountType} onChange={(event) => setEditForm({ ...editForm, accountType: event.target.value as "INDIVIDUAL" | "SHARED" })}>
                  <option value="INDIVIDUAL">فردي</option><option value="SHARED">مشترك</option>
                </select>
              </label>
              {editForm.accountType === "SHARED" ? (
                <label className="editField">عدد مرات السحب (السعة)
                  <input type="number" min={Math.max(1, editing.currentUsage)} max={100} value={editForm.maxUsage} onChange={(event) => setEditForm({ ...editForm, maxUsage: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })} />
                </label>
              ) : (
                <label className="editField">تاريخ انتهاء الحساب (اختياري)
                  <input type="date" value={editForm.expiryDate} onChange={(event) => setEditForm({ ...editForm, expiryDate: event.target.value })} />
                </label>
              )}
              {editForm.accountType === "SHARED" && (
                <label className="editField">تاريخ انتهاء الحساب (اختياري)
                  <input type="date" value={editForm.expiryDate} onChange={(event) => setEditForm({ ...editForm, expiryDate: event.target.value })} />
                </label>
              )}
              <label className="editField">مفتاح OTP (اختياري)
                <input value={editForm.otpSecret} onChange={(event) => setEditForm({ ...editForm, otpSecret: event.target.value })} dir="ltr" placeholder="JBSWY3DPEHPK3PXP" />
              </label>
              <label className="editField wide">رابط استخراج OTP (اختياري)
                <input value={editForm.otpUrl} onChange={(event) => setEditForm({ ...editForm, otpUrl: event.target.value })} dir="ltr" placeholder="https://2fa.live" />
              </label>
            </div>
            <footer><button onClick={() => setEditing(null)}>إلغاء</button><button className="primary" disabled={savingEdit} onClick={saveEdit}>حفظ التعديل</button></footer>
          </section>
        </div>
      )}
    </>
  );
}

function ImportModal({
  onClose,
  flash,
  defaultService,
  services: serviceRecords,
  onImported,
}: {
  onClose: () => void;
  flash: (s: string) => void;
  defaultService: string;
  services: ServiceRecord[];
  onImported: () => void;
}) {
  const [tab, setTab] = useState<"single" | "paste" | "file">("single");
  const [rows, setRows] = useState("");
  const [serviceName,setServiceName]=useState(defaultService);
  const [accountType,setAccountType]=useState<"SHARED"|"INDIVIDUAL">("INDIVIDUAL");
  const [sharedMaxUsage,setSharedMaxUsage]=useState(5);
  const [saving,setSaving]=useState(false);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [single, setSingle] = useState({ email: "", password: "", otpSecret: "", otpUrl: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRows = tab === "single" ? (single.email || single.password ? [`${single.email} | ${single.password} | ${single.otpSecret} | ${single.otpUrl}`] : []) : rows.trim().split(/\r?\n/).filter(Boolean);
  const parsedRows = sourceRows.map((line) => line.split("|").map((value) => value.trim()));
  const validRows = parsedRows.filter(([email, password, , otpUrl]) => /^\S+@\S+\.\S+$/.test(email || "") && Boolean(password) && (!otpUrl || /^https?:\/\//i.test(otpUrl)));
  const count = validRows.length;
  const invalidCount = parsedRows.length - validRows.length;

  async function loadFile(file: File) {
    setFileName(file.name); setFileError("");
    try {
      let matrix: unknown[][] = [];
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        matrix = await readSheet(file) as unknown as unknown[][];
      } else {
        const text = await file.text();
        matrix = text.split(/\r?\n/).filter(Boolean).map((line) => {
          const delimiter = line.includes("|") ? "|" : line.includes("\t") ? "\t" : ",";
          return line.split(delimiter);
        });
      }
      const headerIndex = matrix.findIndex((row) => {
        const values = row.map((value) => String(value ?? "").trim().toLowerCase());
        return values.some((value) => value.includes("email") || value.includes("الإيميل"))
          && values.some((value) => value.includes("password") || value.includes("كلمة المرور"));
      });
      if (headerIndex >= 0) matrix = matrix.slice(headerIndex + 1);

      // Excel templates may contain title and instruction rows before the real
      // data table. Only import rows that actually start with an email address.
      const normalized = matrix
        .filter((row) => /^\S+@\S+\.\S+$/.test(String(row[0] ?? "").trim()))
        .map((row) => row.slice(0, 4).map((value) => String(value ?? "").trim()).join(" | "))
        .join("\n");
      setRows(normalized);
      if (!normalized) setFileError("الملف لا يحتوي على صفوف قابلة للاستيراد");
    } catch {
      setRows(""); setFileError("تعذر قراءة الملف. تأكد أن ترتيب الأعمدة: Email, Password, OTP Key, OTP Website");
    }
  }
  async function importAccounts(){
    if (!count || invalidCount) { flash("راجع الإيميل والباسورد ورابط OTP في الصفوف غير الصحيحة"); return; }
    const selectedId = serviceRecords.find((service) => service.name === serviceName)?.id ?? serviceIds[serviceName];
    const items=validRows.map(([email,password,otpSecret,otpUrl])=>({serviceId:selectedId,email,password,otpSecret:otpSecret||null,otpUrl:otpUrl||null,accountType,maxUsage:accountType==="SHARED"?Math.max(1,Math.min(100,sharedMaxUsage)):1}));
    setSaving(true);
    try {
      const response=await fetch("/api/inventory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});
      const result=await response.json();
      if(!response.ok){flash(result.error === "INVALID_ITEMS" ? "بيانات بعض الحسابات غير صحيحة" : "تعذر حفظ الحسابات");return;}
      flash(`تمت إضافة ${result.inserted} حساب وتخطي ${result.duplicates} مكرر`);
      onImported();
    } finally { setSaving(false); }
  }
  return (
    <div
      className="modalBackdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="importModal">
        <header>
          <div>
            <span className="uploadIcon"><Upload size={22} strokeWidth={1.8} /></span>
            <div>
              <h2>رفع حسابات {serviceName}</h2>
              <p>سيتم حفظ الحسابات داخل مخزون هذه الخدمة فقط.</p>
            </div>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="importService">
          <label>
            الخدمة
            <select value={serviceName} onChange={e=>setServiceName(e.target.value)}>
              {(serviceRecords.length ? serviceRecords : services.map((service) => ({ id: serviceIds[service.name], name: service.name }))).map(s=><option key={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            نوع الحساب
            <select value={accountType} onChange={e=>setAccountType(e.target.value as "SHARED"|"INDIVIDUAL")}>
              <option value="SHARED">مشترك</option>
              <option value="INDIVIDUAL">فردي</option>
            </select>
          </label>
          {accountType === "SHARED" && (
            <label>
              عدد مرات السحب (سعة الحساب المشترك)
              <input type="number" min={1} max={100} value={sharedMaxUsage} onChange={(e) => setSharedMaxUsage(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
              <small>سيظهر الحساب المشترك في السحب حتى يُستخدم {Math.max(1, Math.min(100, sharedMaxUsage))} مرة، ثم يُصبح ممتلئًا.</small>
            </label>
          )}
        </div>
        <div className="fieldMap">
          <div>
            <span>1</span>
            <b>الإيميل</b>
            <em>مطلوب</em>
          </div>
          <i>←</i>
          <div>
            <span>2</span>
            <b>كلمة المرور</b>
            <em>مطلوب</em>
          </div>
          <i>←</i>
          <div>
            <span>3</span>
            <b>مفتاح OTP</b>
            <em>اختياري</em>
          </div>
          <i>←</i>
          <div>
            <span>4</span>
            <b>رابط OTP</b>
            <em>اختياري</em>
          </div>
        </div>
        <div className="importTabs">
          <button className={tab === "single" ? "active" : ""} onClick={() => setTab("single")}>إضافة حساب واحد</button>
          <button
            className={tab === "paste" ? "active" : ""}
            onClick={() => setTab("paste")}
          >
            لصق البيانات
          </button>
          <button
            className={tab === "file" ? "active" : ""}
            onClick={() => setTab("file")}
          >
            رفع Excel / CSV / TXT
          </button>
        </div>
        {tab === "single" ? (
          <div className="singleAccountForm">
            <label>الإيميل *<input type="email" value={single.email} onChange={(event) => setSingle({ ...single, email: event.target.value })} placeholder="account@example.com" dir="ltr" /></label>
            <label>كلمة المرور *<input value={single.password} onChange={(event) => setSingle({ ...single, password: event.target.value })} placeholder="Password" dir="ltr" /></label>
            <label>مفتاح OTP<input value={single.otpSecret} onChange={(event) => setSingle({ ...single, otpSecret: event.target.value })} placeholder="JBSWY3DPEHPK3PXP" dir="ltr" /></label>
            <label>موقع استخراج OTP<input type="url" value={single.otpUrl} onChange={(event) => setSingle({ ...single, otpUrl: event.target.value })} placeholder="https://2fa.live" dir="ltr" /></label>
          </div>
        ) : tab === "paste" ? (
          <>
            <div className="pasteHint">
              <span>
                استخدم علامة <b>|</b> للفصل بين الحقول، وكل حساب في سطر جديد.
              </span>
              <button onClick={() => setRows("")}>مسح الكل</button>
            </div>
            <textarea
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              spellCheck={false}
            />
            <div className="importPreview">
              <span>
                <Check size={14} /> تم اكتشاف <b>{count} حساب</b>
              </span>
              <span>سيتم فحص التكرار والحقول الناقصة قبل الحفظ</span>
            </div>
          </>
        ) : (
          <div className="dropZone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) loadFile(file); }}>
            <span><Upload size={18} /></span>
            <b>{fileName || "اسحب الملف هنا أو اضغط للاختيار"}</b>
            <p>يدعم XLSX وCSV وTXT حتى 10,000 صف</p>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) loadFile(file); }} />
            <button type="button" onClick={() => fileRef.current?.click()}>اختيار ملف من الجهاز</button>
            {fileError && <em className="fileError">{fileError}</em>}
            {rows && <div className="importPreview"><span><Check size={14} /> تم اكتشاف <b>{count} حساب</b></span><span>{invalidCount ? `${invalidCount} صف غير صحيح` : "الملف جاهز للحفظ"}</span></div>}
          </div>
        )}
        <footer>
          <button className="secondary" onClick={onClose}>
            إلغاء
          </button>
          <button
            className="primary"
            disabled={!count || invalidCount > 0 || saving}
            onClick={importAccounts}
          >
            {saving?"جارٍ الحفظ...":"استيراد الحسابات وحفظها"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ServiceCostEditor({ id, cost, onSave }: { id: string; cost: number; onSave: (id: string, value: number) => Promise<void> }) {
  const [value, setValue] = useState(cost);
  const [busy, setBusy] = useState(false);
  if (!id) return null;
  return (
    <span className="costEditor">
      التكلفة
      <input type="number" min={0} value={value || ""} onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))} placeholder="0" />
      {value !== cost && <button disabled={busy} onClick={async () => { setBusy(true); try { await onSave(id, value); } finally { setBusy(false); } }}>حفظ</button>}
    </span>
  );
}

function Services({
  onImport,
  records,
  onAdd,
  onView,
  flash,
  onUpdated,
}: {
  onImport: (service: string) => void;
  records: ServiceRecord[];
  onAdd: () => void;
  onView: (service: string) => void;
  flash: (s: string) => void;
  onUpdated: () => void;
}) {
  async function saveCost(id: string, value: number) {
    const res = await fetch(`/api/services?id=${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultCost: value }) });
    if (!res.ok) { flash("تعذر حفظ التكلفة"); return; }
    flash("تم حفظ سعر التكلفة"); onUpdated();
  }
  const cards = records.length ? records.map((record, index) => {
    const preset = services.find((service) => service.name === record.name);
    return { id: record.id, name: record.name, code: preset?.code ?? record.name.slice(0, 2).toUpperCase(), color: preset?.color ?? ["#2563eb", "#7c3aed", "#0f766e", "#d97706"][index % 4], stock: record.available, used: Math.max(0, record.total - record.available), total: record.total, type: preset?.type ?? "مخصص", price: preset?.price ?? 0, defaultCost: record.default_cost };
  }) : services.map((s) => ({ ...s, id: "", defaultCost: 0 }));
  return (
    <>
      <PageHead
        title="الخدمات"
        subtitle="كل خدمة لها مخزونها وإعداداتها وحساباتها الخاصة."
      >
        <button
          className="primary"
          onClick={onAdd}
        >
          <Plus size={16} /> إضافة خدمة
        </button>
      </PageHead>
      <div className="serviceGrid">
        {cards.map((s) => (
          <section className="serviceCard" key={s.name}>
            <div>
              <span
                className="serviceIcon large"
                style={{ background: s.color }}
              >
                {s.code}
              </span>
              <button onClick={() => onView(s.name)} aria-label={`عرض مخزون ${s.name}`}>المخزون</button>
            </div>
            <h3>{s.name}</h3>
            <p>
              <span>{s.type}</span>
              <span className={s.stock < 15 ? "low" : "good"}>
                {s.stock < 15 ? "مخزون منخفض" : "نشطة"}
              </span>
            </p>
            <div className="serviceNumbers">
              <div>
                <span>المتاح</span>
                <b>{s.stock}</b>
              </div>
              <div>
                <span>المستخدم</span>
                <b>{s.used}</b>
              </div>
              <div>
                <span>الإجمالي</span>
                <b>{s.total}</b>
              </div>
            </div>
            <div className="progress">
              <i style={{ width: `${(s.stock / s.total) * 100}%` }} />
            </div>
            <footer>
              <ServiceCostEditor key={`${s.id}-${s.defaultCost}`} id={s.id} cost={s.defaultCost} onSave={saveCost} />
              <div>
                <button
                  className="uploadService"
                  onClick={() => onImport(s.name)}
                >
                  <Upload size={14} /> رفع حسابات
                </button>
                <button onClick={() => onView(s.name)}>
                  عرض المخزون <ArrowLeft size={13} />
                </button>
              </div>
            </footer>
          </section>
        ))}
      </div>
    </>
  );
}

function Organizations({onSelected}:{onSelected:()=>void}){
  const [organizations,setOrganizations]=useState<OrganizationRecord[]>([]);
  const [createOpen,setCreateOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [form,setForm]=useState({name:"",slug:"",adminName:"",adminEmail:"",adminPassword:"",employeeLimit:25,inventoryLimit:10000,plan:"PRO"});
  const load=()=>fetch("/api/organizations").then((response)=>response.ok?response.json():Promise.reject()).then((data)=>setOrganizations(data.organizations)).catch(()=>setError("تعذر تحميل الشركات"));
  useEffect(()=>{load();},[]);
  async function createOrganization(){
    setSaving(true);setError("");
    const response=await fetch("/api/organizations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const result=await response.json();setSaving(false);
    if(!response.ok){setError(result.error==="DUPLICATE_ORGANIZATION_OR_EMAIL"?"اسم المساحة أو بريد الأدمن مستخدم بالفعل":"راجع البيانات المطلوبة");return;}
    setCreateOpen(false);setForm({name:"",slug:"",adminName:"",adminEmail:"",adminPassword:"",employeeLimit:25,inventoryLimit:10000,plan:"PRO"});load();
  }
  async function selectOrganization(id:string){
    const response=await fetch("/api/organizations/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId:id})});
    if(response.ok)onSelected();
  }
  async function toggleOrganization(organization:OrganizationRecord){
    await fetch("/api/organizations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:organization.id,active:!organization.active})});load();
  }
  return <>
    <PageHead title="الشركات والمساحات" subtitle="كل شركة تعمل في مساحة مستقلة بموظفيها وخدماتها ومخزونها وتقاريرها.">
      <button className="primary" onClick={()=>setCreateOpen(true)}><Plus size={16} /> إنشاء شركة ومساحة</button>
    </PageHead>
    <div className="orgMetrics">
      <div><span>إجمالي الشركات</span><b>{organizations.length}</b></div>
      <div><span>الشركات النشطة</span><b>{organizations.filter((organization)=>organization.active).length}</b></div>
      <div><span>إجمالي الموظفين</span><b>{organizations.reduce((sum,organization)=>sum+Number(organization.employees),0)}</b></div>
      <div><span>إجمالي المخزون</span><b>{organizations.reduce((sum,organization)=>sum+Number(organization.inventory),0)}</b></div>
    </div>
    <section className="panel tablePanel orgTable"><div className="tableWrap"><table><thead><tr><th>الشركة</th><th>الأدمن</th><th>الباقة</th><th>الموظفون</th><th>المخزون</th><th>السحوبات</th><th>الحالة</th><th></th></tr></thead><tbody>
      {organizations.map((organization)=><tr key={organization.id}>
        <td><b>{organization.name}</b><small className="tableSubtext">/{organization.slug}</small></td>
        <td className="mono">{organization.admin_email}</td><td><span className="orgPlan">{organization.plan}</span></td>
        <td>{organization.employees} / {organization.employee_limit}</td><td>{organization.inventory} / {organization.inventory_limit}</td><td>{organization.withdrawals}</td>
        <td><span className={`status ${organization.active?"متاح":"ممتلئ"}`}>{organization.active?"نشطة":"موقوفة"}</span></td>
        <td><div className="orgActions"><button disabled={!organization.active} onClick={()=>selectOrganization(organization.id)}>دخول المساحة</button><button className={organization.active?"dangerText":""} onClick={()=>toggleOrganization(organization)}>{organization.active?"إيقاف":"تفعيل"}</button></div></td>
      </tr>)}
    </tbody></table></div></section>
    {createOpen&&<div className="modalBackdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setCreateOpen(false);}}><section className="simpleModal organizationModal">
      <header><div><h2>إنشاء شركة ومساحة مستقلة</h2><p>سيتم إنشاء الخدمات الأساسية وحساب Admin للشركة تلقائيًا.</p></div><button onClick={()=>setCreateOpen(false)}>×</button></header>
      <div className="modalForm twoCols">
        <label>اسم الشركة<input value={form.name} onChange={(event)=>setForm({...form,name:event.target.value,slug:form.slug||event.target.value.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")})}/></label>
        <label>رابط المساحة<input dir="ltr" value={form.slug} onChange={(event)=>setForm({...form,slug:event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})} placeholder="company-name"/></label>
        <label>اسم أدمن الشركة<input value={form.adminName} onChange={(event)=>setForm({...form,adminName:event.target.value})}/></label>
        <label>بريد الأدمن<input type="email" dir="ltr" value={form.adminEmail} onChange={(event)=>setForm({...form,adminEmail:event.target.value})}/></label>
        <label>كلمة مرور الأدمن<input dir="ltr" value={form.adminPassword} onChange={(event)=>setForm({...form,adminPassword:event.target.value})}/></label>
        <label>الباقة<select value={form.plan} onChange={(event)=>setForm({...form,plan:event.target.value})}><option>STARTER</option><option>PRO</option><option>BUSINESS</option></select></label>
        <label>حد الموظفين<input type="number" min="1" value={form.employeeLimit} onChange={(event)=>setForm({...form,employeeLimit:Number(event.target.value)})}/></label>
        <label>حد المخزون<input type="number" min="1" value={form.inventoryLimit} onChange={(event)=>setForm({...form,inventoryLimit:Number(event.target.value)})}/></label>
        {error&&<p className="formError">{error}</p>}
      </div>
      <footer><button className="secondary" onClick={()=>setCreateOpen(false)}>إلغاء</button><button className="primary" disabled={saving} onClick={createOrganization}>{saving?"جارٍ الإنشاء...":"إنشاء الشركة والأدمن"}</button></footer>
    </section></div>}
  </>;
}

function AddServiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState(5);
  const [cost, setCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (name.trim().length < 2) { setError("اكتب اسم الخدمة"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, defaultDailyLimit: limit, defaultCost: Math.max(0, Math.round(cost)) }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error === "SERVICE_EXISTS" ? "الخدمة موجودة بالفعل" : "تعذر إضافة الخدمة"); return; }
      onCreated(`تمت إضافة خدمة ${result.service.name}`);
    } finally { setSaving(false); }
  }
  return <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="simpleModal"><header><div><h2>إضافة خدمة جديدة</h2><p>سيصبح لها مخزون مستقل ويمكن رفع حساباتها مباشرة.</p></div><button onClick={onClose}>×</button></header>
      <div className="modalForm"><label>اسم الخدمة<input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: Gemini Advanced" /></label><label>الحد اليومي الافتراضي<input type="number" min="0" value={limit} onChange={(event) => setLimit(Math.max(0, Number(event.target.value)))} /></label><label>سعر التكلفة الافتراضي (ج.م)<input type="number" min="0" value={cost || ""} onChange={(event) => setCost(Math.max(0, Number(event.target.value) || 0))} placeholder="0" /></label>{error && <p className="formError">{error}</p>}</div>
      <footer><button className="secondary" onClick={onClose}>إلغاء</button><button className="primary" disabled={saving} onClick={save}>{saving ? "جارٍ الحفظ..." : "إضافة الخدمة"}</button></footer>
    </section>
  </div>;
}

function Employees({ flash }: { flash: (s: string) => void }) {
  const [team, setTeam] = useState<EmployeeRecord[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const employee = editing === null ? null : team[editing];
  const loadEmployees = useCallback(() => fetch("/api/employees").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setTeam(data.employees.map((item: Record<string, unknown>, index: number) => ({
    id: String(item.id), email: String(item.email), name: String(item.name), initials: String(item.name).split(" ").map((part) => part[0]).slice(0, 2).join(" "),
    team: String(item.team ?? "بدون فريق"), today: Number(item.today ?? 0), month: Number(item.month ?? 0), limit: Number(item.daily_limit ?? 0),
    enabled: Boolean(item.active), accessRole:String(item.access_role??"EMPLOYEE") as EmployeeRecord["accessRole"], canManageAccounting:Boolean(item.can_manage_accounting), color: ["#2563eb", "#7c3aed", "#db2777", "#ea580c"][index % 4],
    allowed: (item.permissions as Record<string, unknown>[]).map((permission) => ({ id: String(permission.id), name: String(permission.name), enabled: Boolean(permission.enabled), limit: Number(permission.daily_limit ?? 0) })),
  })))).catch(() => flash("تعذر تحميل بيانات الموظفين")), [flash]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  function updateLimit(index: number, value: number) {
    setTeam((current) =>
      current.map((e, i) =>
        i === index ? { ...e, limit: Math.max(0, value) } : e,
      ),
    );
  }
  async function saveEmployee(updated: (typeof team)[number]) {
    const response=await fetch(`/api/employees/${updated.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:updated.enabled,dailyLimit:updated.limit,accessRole:updated.accessRole,canManageAccounting:updated.accessRole==="ACCOUNTANT",permissions:updated.allowed.map(p=>({serviceId:p.id,enabled:p.enabled,dailyLimit:p.limit}))})});
    if(!response.ok){flash("تعذر حفظ صلاحيات الموظف");return;}
    setTeam((current) => current.map((e, i) => (i === editing ? updated : e)));
    setEditing(null);
    flash(`تم حفظ صلاحيات وحدود ${updated.name}`);
  }
  const visibleTeam = team.filter((employee) => `${employee.name} ${employee.email} ${employee.team}`.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? employee.enabled : !employee.enabled)));
  return (
    <>
      <PageHead
        title="الموظفون وحدود السحب"
        subtitle="حدد لكل موظف الحد العام والخدمات المسموحة وحد كل خدمة."
      >
        <button
          className="primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} /> إنشاء حساب موظف
        </button>
      </PageHead>
      <div className="limitSummary">
        <div>
          <span>إجمالي الموظفين</span>
          <b>{team.length}</b>
        </div>
        <div>
          <span>نشطون الآن</span>
          <b>{team.filter((e) => e.enabled).length}</b>
        </div>
        <div>
          <span>قاربوا على الحد</span>
          <b>
            {
              team.filter((e) => e.today / e.limit >= 0.8 && e.today < e.limit)
                .length
            }
          </b>
        </div>
        <div>
          <span>بلغوا الحد</span>
          <b>{team.filter((e) => e.today >= e.limit).length}</b>
        </div>
      </div>
      <section className="panel tablePanel">
        <div className="tableTools">
          <div className="search wide">
            <Search size={17} strokeWidth={1.8} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الموظف أو الفريق..." />
          </div>
          <select aria-label="حالة الموظف" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">كل الحالات</option><option value="ACTIVE">نشط</option><option value="DISABLED">موقوف</option></select>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>الموظف</th>
                <th>الفريق / الصفحة</th>
                <th>المسحوب اليوم</th>
                <th>الحد اليومي</th>
                <th>المتبقي</th>
                <th>نسبة الاستخدام</th>
                <th>الخدمات المسموحة</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleTeam.map((e) => {
                const index = team.findIndex((item) => item.id === e.id);
                const remaining = Math.max(0, e.limit - e.today);
                const ratio = e.limit
                  ? Math.min(100, (e.today / e.limit) * 100)
                  : 100;
                const status = !e.enabled
                  ? "موقوف"
                  : remaining === 0
                    ? "بلغ الحد"
                    : ratio >= 80
                      ? "قارب على الحد"
                      : "نشط";
                return (
                  <tr key={e.name}>
                    <td>
                      <div className="person">
                        <span
                          className="avatar"
                          style={{ background: e.color }}
                        >
                          {e.initials}
                        </span>
                        <p>
                          <b>{e.name}</b>
                          <span>
                            {e.email}
                          </span>
                        </p>
                      </div>
                    </td>
                    <td>{e.team}</td>
                    <td>
                      <b className="usedCount">{e.today}</b> سحب
                    </td>
                    <td>
                      <div className="inlineLimit">
                        <input
                          type="number"
                          min="0"
                          value={e.limit}
                          onChange={(x) =>
                            updateLimit(index, Number(x.target.value))
                          }
                          onBlur={() => { const current = team[index]; if (current) saveEmployee(current); }}
                        />
                        <span>يوميًا</span>
                      </div>
                    </td>
                    <td>
                      <b
                        className={
                          remaining === 0 ? "noneLeft" : "remainingCount"
                        }
                      >
                        {remaining}
                      </b>{" "}
                      سحب
                    </td>
                    <td>
                      <div className="usageCell">
                        <div
                          className={`rowProgress ${ratio >= 100 ? "full" : ratio >= 80 ? "warning" : ""}`}
                        >
                          <i style={{ width: `${ratio}%` }} />
                        </div>
                        <span>{Math.round(ratio)}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="allowedServices">
                        {e.allowed
                          .filter((s) => s.enabled)
                          .slice(0, 3)
                          .map((s) => (
                            <span key={s.name}>{s.name.split(" ")[0]}</span>
                          ))}
                        {e.allowed.filter((s) => s.enabled).length > 3 && (
                          <em>
                            +{e.allowed.filter((s) => s.enabled).length - 3}
                          </em>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status ${status}`}>{status}</span>
                    </td>
                    <td>
                      <button
                        className="editEmployee"
                        onClick={() => setEditing(index)}
                      >
                        تعديل
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {employee && (
        <EmployeeEditor
          employee={employee}
          onClose={() => setEditing(null)}
          onSave={saveEmployee}
        />
      )}
      {createOpen && <CreateEmployeeModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); loadEmployees(); flash("تم إنشاء حساب الموظف ويمكنه تسجيل الدخول الآن"); }} />}
    </>
  );
}

function EmployeeEditor({
  employee,
  onClose,
  onSave,
}: {
  employee: EmployeeRecord;
  onClose: () => void;
  onSave: (e: typeof employee) => void;
}) {
  const [draft, setDraft] = useState(employee);
  const remaining = Math.max(0, draft.limit - draft.today);
  function changeService(
    index: number,
    patch: Partial<{ enabled: boolean; limit: number }>,
  ) {
    setDraft((current) => ({
      ...current,
      allowed: current.allowed.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    }));
  }
  return (
    <div
      className="modalBackdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="employeeModal">
        <header>
          <div className="person">
            <span className="avatar" style={{ background: draft.color }}>
              {draft.initials}
            </span>
            <div>
              <h2>تعديل الموظف — {draft.name}</h2>
              <p>
                {draft.team} • {draft.email}
              </p>
            </div>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="employeeStatus">
          <div>
            <span>المسحوب اليوم</span>
            <b>{draft.today}</b>
          </div>
          <div>
            <span>الحد اليومي</span>
            <b>{draft.limit}</b>
          </div>
          <div>
            <span>المتبقي</span>
            <b className={remaining === 0 ? "danger" : ""}>{remaining}</b>
          </div>
        </div>
        <section className="generalLimit">
          <div>
            <h3>الحد اليومي العام</h3>
            <p>أقصى عدد حسابات يمكن للموظف سحبها من جميع الخدمات في اليوم.</p>
          </div>
          <div className="limitInput">
            <button
              onClick={() =>
                setDraft({ ...draft, limit: Math.max(0, draft.limit - 1) })
              }
            >
              −
            </button>
            <input
              type="number"
              min="0"
              value={draft.limit}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  limit: Math.max(0, Number(e.target.value)),
                })
              }
            />
            <button
              aria-label="زيادة الحد اليومي"
              onClick={() => setDraft({ ...draft, limit: draft.limit + 1 })}
            >
              <Plus size={15} />
            </button>
          </div>
        </section>
        <section className="generalLimit">
          <div><h3>الدور الوظيفي والصلاحيات</h3><p>كل دور يمنح أقل مجموعة صلاحيات لازمة، وجميعها تعمل داخل الشركة الحالية فقط.</p></div>
          <select value={draft.accessRole} onChange={(event)=>setDraft({...draft,accessRole:event.target.value as EmployeeRecord["accessRole"]})} aria-label="الدور الوظيفي">
            <option value="EMPLOYEE">موظف سحب</option><option value="SALES">موظف مبيعات</option><option value="ACCOUNTANT">محاسب</option><option value="AUDITOR">مراجع - قراءة فقط</option><option value="ADMIN">أدمن شركة</option>
          </select>
        </section>
        <div className="servicePermissions">
          <div className="permissionHead">
            <div>
              <h3>الخدمات المسموح بها</h3>
              <p>فعّل الخدمات وحدد حدًا يوميًا مستقلًا لكل واحدة.</p>
            </div>
            <span>
              {draft.allowed.filter((s) => s.enabled).length} من{" "}
              {draft.allowed.length} مفعلة
            </span>
          </div>
          {draft.allowed.map((service, index) => (
            <div
              className={
                service.enabled ? "permissionRow enabled" : "permissionRow"
              }
              key={service.name}
            >
              <button
                className={service.enabled ? "toggle on" : "toggle"}
                onClick={() =>
                  changeService(index, { enabled: !service.enabled })
                }
              >
                <i />
              </button>
              <span
                className="serviceIcon"
                style={{
                  background: services.find((s) => s.name === service.name)
                    ?.color,
                }}
              >
                {services.find((s) => s.name === service.name)?.code}
              </span>
              <div>
                <b>{service.name}</b>
                <small>
                  {service.enabled ? "مسموح للموظف بالسحب" : "غير مسموح"}
                </small>
              </div>
              <label>
                الحد اليومي
                <input
                  type="number"
                  min="0"
                  disabled={!service.enabled}
                  value={service.limit}
                  onChange={(e) =>
                    changeService(index, {
                      limit: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <div className="employeeAccess">
          <div>
            <b>السماح بالسحب</b>
            <span>إيقاف الموظف يمنع أي عملية سحب جديدة فورًا.</span>
          </div>
          <button
            className={draft.enabled ? "toggle on" : "toggle"}
            onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
          >
            <i />
          </button>
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            إلغاء
          </button>
          <button className="primary" onClick={() => onSave(draft)}>
            حفظ التعديلات
          </button>
        </footer>
      </section>
    </div>
  );
}

function CreateEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", team: "صفحة القاهرة", dailyLimit: 20 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) { setError(result.error === "EMAIL_EXISTS" ? "البريد مستخدم بالفعل" : "راجع الاسم والبريد والباسورد (6 أحرف على الأقل)"); return; }
      onCreated();
    } finally { setSaving(false); }
  }
  return <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="simpleModal"><header><div><h2>إنشاء حساب موظف</h2><p>الموظف سيسجل الدخول بالبريد وكلمة المرور التي تحددها.</p></div><button onClick={onClose}>×</button></header>
      <div className="modalForm twoCols">
        <label>اسم الموظف<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>البريد الإلكتروني<input type="email" dir="ltr" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>كلمة المرور<input dir="ltr" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label>الفريق / الصفحة<input value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })} /></label>
        <label>الحد اليومي<input type="number" min="0" value={form.dailyLimit} onChange={(event) => setForm({ ...form, dailyLimit: Math.max(0, Number(event.target.value)) })} /></label>
        {error && <p className="formError">{error}</p>}
      </div>
      <footer><button className="secondary" onClick={onClose}>إلغاء</button><button className="primary" disabled={saving} onClick={save}>{saving ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button></footer>
    </section>
  </div>;
}

function Reports() {
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([]);
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [applied, setApplied] = useState(false);
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = preset === "custom" ? custom : periodRange(preset);
  const qs = `${range.from ? `from=${range.from}&` : ""}${range.to ? `to=${range.to}` : ""}`;
  useEffect(() => { fetch(`/api/withdrawals?${qs}`).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setWithdrawals(data.withdrawals)).catch(() => {}); }, [qs]);
  const visible = withdrawals.filter((row) => (serviceFilter === "ALL" || row.service === serviceFilter) && (employeeFilter === "ALL" || row.user_id === employeeFilter));
  const serviceCounts = visible.reduce<Record<string, number>>((counts, row) => { const name=String(row.service); counts[name]=(counts[name]??0)+1; return counts; }, {});
  const topService = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—";
  const distinctDays = new Set(visible.map((row) => new Date(String(row.created_at)).toDateString())).size;
  const averageDaily = distinctDays ? Math.round(visible.length / distinctDays) : 0;
  const uniqueEmployees = Array.from(new Map(withdrawals.map((row) => [String(row.user_id), String(row.employee)])).entries());
  const sharedCount = visible.filter((row) => row.account_type === "SHARED").length;
  const sharedPercent = visible.length ? Math.round((sharedCount / visible.length) * 100) : 0;
  const maxServiceCount = Math.max(1, ...Object.values(serviceCounts));
  const [returningId, setReturningId] = useState<string | null>(null);
  async function returnWithdrawal(id: string) {
    if (returningId) return;
    if (!window.confirm(`إرجاع العملية ${id} إلى المخزون؟ سيُعاد رصيد الحساب المستخدم وتصبح العملية مُرتجعة.`)) return;
    setReturningId(id);
    try {
      const response = await fetch(`/api/withdrawals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok) setWithdrawals((prev) => prev.map((row) => (String(row.id) === id ? { ...row, status: "RETURNED" } : row)));
    } finally { setReturningId(null); }
  }
  return (
    <>
      <PageHead
        title="التقارير"
        subtitle="حوّل بيانات المخزون والفريق إلى قرارات واضحة."
      >
        <button className="secondary" onClick={() => exportToExcel("stockflow-withdrawals-report.xls", "تقرير عمليات السحب والاشتراكات التفصيلي", [
          "رقم العملية", "رقم الدفعة", "الموظف", "الخدمة", "رقم المخزون", "نوع الحساب", "إيميل الحساب", "كلمة مرور الحساب", "مفتاح OTP", "رابط OTP",
          "اسم العميل", "هاتف العميل", "وسيلة التواصل", "مرجع العميل", "ملاحظات العميل", "بداية الاشتراك", "عدد الشهور", "نهاية الاشتراك", "أيام الضمان", "نهاية الضمان",
          "سعر البيع", "التكلفة", "المدفوع", "المتبقي", "الاستخدام قبل السحب", "الاستخدام بعد السحب", "حالة العملية", "تاريخ السحب"
        ], visible.map((row) => [
          String(row.id), String(row.batch_id ?? ""), String(row.employee ?? ""), String(row.service ?? ""), String(row.inventory_item_id ?? ""), String(row.account_type ?? ""), String(row.account_email ?? ""), String(row.account_password ?? ""), String(row.otp_secret ?? ""), String(row.otp_url ?? ""),
          String(row.customer_name ?? ""), String(row.customer_phone ?? ""), String(row.customer_contact ?? ""), String(row.customer_reference ?? ""), String(row.customer_notes ?? ""), String(row.subscription_start_date ?? ""), Number(row.subscription_months ?? 0), String(row.subscription_end_date ?? ""), Number(row.warranty_days ?? 0), String(row.warranty_end_date ?? ""),
          Number(row.selling_price ?? 0), Number(row.cost ?? 0), Number(row.paid_amount ?? 0), Number(row.remaining ?? 0), Number(row.previous_usage ?? 0), Number(row.new_usage ?? 0), String(row.status ?? ""), String(row.created_at ?? "")
        ]))}><Download size={15} /> تصدير Excel</button>
        <button className="primary" onClick={() => exportToPdf("تقرير عمليات السحب والاشتراكات التفصيلي", [
          "رقم العملية", "الموظف", "الخدمة", "اسم العميل", "هاتف العميل", "بداية الاشتراك", "نهاية الاشتراك", "سعر البيع", "المدفوع", "الحالة"
        ], visible.map((row) => [
          String(row.id), String(row.employee ?? ""), String(row.service ?? ""), String(row.customer_name ?? "—"), String(row.customer_phone ?? "—"), String(row.subscription_start_date ?? "—"), String(row.subscription_end_date ?? "—"), Number(row.selling_price ?? 0), Number(row.paid_amount ?? 0), String(row.status ?? "")
        ]))}><FileText size={15} /> تصدير PDF</button>
        <button className="secondary" onClick={() => downloadCsv("stockflow-withdrawals-full.csv", [[
          "رقم العملية", "رقم الدفعة", "الموظف", "الخدمة", "رقم المخزون", "نوع الحساب", "إيميل الحساب", "كلمة مرور الحساب", "مفتاح OTP", "رابط OTP",
          "اسم العميل", "هاتف العميل", "وسيلة التواصل", "مرجع العميل", "ملاحظات العميل", "بداية الاشتراك", "عدد الشهور", "نهاية الاشتراك", "أيام الضمان", "نهاية الضمان",
          "سعر البيع", "التكلفة", "المدفوع", "المتبقي", "الاستخدام قبل السحب", "الاستخدام بعد السحب", "حالة العملية", "تاريخ السحب"
        ], ...visible.map((row) => [
          String(row.id), String(row.batch_id ?? ""), String(row.employee ?? ""), String(row.service ?? ""), String(row.inventory_item_id ?? ""), String(row.account_type ?? ""), String(row.account_email ?? ""), String(row.account_password ?? ""), String(row.otp_secret ?? ""), String(row.otp_url ?? ""),
          String(row.customer_name ?? ""), String(row.customer_phone ?? ""), String(row.customer_contact ?? ""), String(row.customer_reference ?? ""), String(row.customer_notes ?? ""), String(row.subscription_start_date ?? ""), Number(row.subscription_months ?? 0), String(row.subscription_end_date ?? ""), Number(row.warranty_days ?? 0), String(row.warranty_end_date ?? ""),
          Number(row.selling_price ?? 0), Number(row.cost ?? 0), Number(row.paid_amount ?? 0), Number(row.remaining ?? 0), Number(row.previous_usage ?? 0), Number(row.new_usage ?? 0), String(row.status ?? ""), String(row.created_at ?? "")
        ])])}><Download size={15} /> CSV</button>
      </PageHead>
      <PeriodFilter preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
      <div className="reportFilters panel">
        <label>
          الخدمة
          <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
            <option value="ALL">كل الخدمات</option>{Array.from(new Set(withdrawals.map((row) => String(row.service)))).map((service) => <option key={service}>{service}</option>)}
          </select>
        </label>
        <label>
          الموظف
          <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="ALL">كل الموظفين</option>{uniqueEmployees.map(([id,name]) => <option value={id} key={id}>{name}</option>)}
          </select>
        </label>
        <button className="primary" onClick={() => setApplied(true)}>{applied ? "تم التطبيق ✓" : "تطبيق"}</button>
      </div>
      <div className="metrics compact">
        <Metric
          icon={TrendingUp}
          label="إجمالي السحوبات"
          value={String(visible.length)}
          change="+14.2%"
          note="عن الفترة السابقة"
          tone="blue"
        />
        <Metric
          icon={Ban}
          label="محاولات محظورة"
          value="0"
          change="0%"
          note="لا توجد محاولات محظورة مسجلة"
          tone="orange"
        />
        <Metric
          icon={Clock3}
          label="متوسط يومي"
          value={String(averageDaily)}
          change="فعلي"
          note="عملية لكل يوم نشط"
          tone="green"
        />
        <Metric
          icon={Trophy}
          label="الأكثر سحبًا"
          value={topService}
          change={visible.length ? `${Math.round(((serviceCounts[topService] ?? 0) / visible.length) * 100)}%` : "0%"}
          note="من السحوبات المعروضة"
          tone="purple"
        />
      </div>
      <div className="dashboardGrid">
        <section className="panel chartPanel">
          <div className="panelHead">
            <h3>السحوبات حسب الخدمة</h3>
          </div>
          <div className="bars">
            {Object.entries(serviceCounts).map(([name,count]) => {
              const visual=services.find((service)=>service.name===name);
              return <div key={name}>
                <span>{name}</span>
                <i>
                  <b style={{ width: `${Math.round((count/maxServiceCount)*100)}%`, background: visual?.color ?? "#2563eb" }} />
                </i>
                <strong>{count}</strong>
              </div>})}
            {!Object.keys(serviceCounts).length && <div className="emptyState">لا توجد سحوبات ضمن الفلاتر الحالية.</div>}
          </div>
        </section>
        <section className="panel">
          <div className="panelHead">
            <h3>ملخص الأداء</h3>
          </div>
          <div className="donut">
            <div>
              <b>{visible.length}</b>
              <span>إجمالي</span>
            </div>
          </div>
          <div className="legend">
            <span>
              <i className="blue" />
              مشترك {sharedPercent}%
            </span>
            <span>
              <i className="purple" />
              فردي {100-sharedPercent}%
            </span>
          </div>
        </section>
      </div>
      <section className="panel tablePanel">
        <div className="panelHead"><h3>أحدث السحوبات</h3></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>رقم العملية</th><th>الخدمة</th><th>العميل</th><th>رقم الحساب</th><th>سعر البيع</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {visible.slice(0, 100).map((row) => (
                <tr key={String(row.id)}>
                  <td className="mono">{String(row.id)}</td>
                  <td>{String(row.service)}</td>
                  <td>{String(row.customer_name ?? "—")}</td>
                  <td className="mono">{String(row.inventory_item_id ?? "—")}</td>
                  <td>{row.selling_price ? `${row.selling_price} ج.م` : "—"}</td>
                  <td><span className="status">{String(row.status) === "COMPLETED" ? "مكتمل" : String(row.status) === "RETURNED" ? "مُرتجع" : String(row.status)}</span></td>
                  <td>{String(row.status) === "COMPLETED" && <button className="dots danger" disabled={returningId === String(row.id)} onClick={() => returnWithdrawal(String(row.id))}><RotateCcw size={14} /> إرجاع</button>}</td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan={7} className="emptyState">لا توجد سحوبات ضمن الفلاتر الحالية.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

type SaleRow = { id:string; source:string; service_name:string|null; item_description:string; customer_name:string; customer_phone:string|null; quantity:number; total_amount:number; cost_amount:number; paid_amount:number; status:"COMPLETED"|"PENDING"|"CANCELLED"; notes:string|null; sold_at:string; created_by_name:string|null };
const emptySale = () => ({ customerName:"",customerPhone:"",serviceName:"",quantity:1,totalAmount:0,costAmount:0,paidAmount:0,status:"COMPLETED" as SaleRow["status"],notes:"",soldAt:todayInCairo() });
function Sales({flash,services}:{flash:(message:string)=>void;services:ServiceRecord[]}){
  const [sales,setSales]=useState<SaleRow[]>([]);const [form,setForm]=useState(emptySale);const [editing,setEditing]=useState<string|null>(null);const [version,setVersion]=useState(0);const [saving,setSaving]=useState(false);
  useEffect(()=>{fetch("/api/sales").then(r=>r.ok?r.json():Promise.reject()).then(d=>setSales(d.sales)).catch(()=>setSales([]));},[version]);
  const total=sales.filter(s=>s.status!=="CANCELLED").reduce((n,s)=>n+Number(s.total_amount),0);const paid=sales.filter(s=>s.status!=="CANCELLED").reduce((n,s)=>n+Number(s.paid_amount),0);const profit=sales.filter(s=>s.status!=="CANCELLED").reduce((n,s)=>n+Number(s.total_amount)-Number(s.cost_amount),0);
  async function save(){if(!form.customerName.trim()||!form.serviceName.trim()){flash("اختر الخدمة واكتب اسم العميل");return;}setSaving(true);const response=await fetch(`/api/sales${editing?`?id=${encodeURIComponent(editing)}`:""}`,{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});setSaving(false);if(!response.ok){flash("تعذر حفظ المبيعة");return;}setForm(emptySale());setEditing(null);setVersion(v=>v+1);flash(editing?"تم تعديل المبيعة":"تم تسجيل المبيعة");}
  function edit(s:SaleRow){setEditing(s.id);setForm({customerName:s.customer_name,customerPhone:s.customer_phone??"",serviceName:s.service_name??s.item_description,quantity:Number(s.quantity),totalAmount:Number(s.total_amount),costAmount:Number(s.cost_amount),paidAmount:Number(s.paid_amount),status:s.status,notes:s.notes??"",soldAt:String(s.sold_at).slice(0,10)});window.scrollTo({top:0,behavior:"smooth"});}
  function selectService(serviceName:string){const service=services.find(item=>item.name===serviceName);setForm(current=>({...current,serviceName,costAmount:service?Number(service.default_cost)*current.quantity:current.costAmount}));}
  async function remove(id:string){if(!window.confirm("حذف هذه المبيعة؟"))return;const r=await fetch(`/api/sales?id=${encodeURIComponent(id)}`,{method:"DELETE"});if(r.ok){setVersion(v=>v+1);flash("تم حذف المبيعة");}}
  return <>
    <PageHead title="المبيعات" subtitle="سجل موحد للمبيعات التلقائية من السحب والمبيعات اليدوية." />
    <div className="metrics compact"><Metric icon={ShoppingCart} label="إجمالي المبيعات" value={`${total.toLocaleString("ar-EG")} ج.م`} change={`${sales.length} عملية`} note="يدوي وتلقائي" tone="blue"/><Metric icon={Wallet} label="المحصّل" value={`${paid.toLocaleString("ar-EG")} ج.م`} change={`${Math.max(0,total-paid).toLocaleString("ar-EG")} متبقي`} note="النقدية المحصلة" tone="green"/><Metric icon={TrendingUp} label="مجمل الربح" value={`${profit.toLocaleString("ar-EG")} ج.م`} change="قبل المصروفات" note="البيع − التكلفة" tone="purple"/></div>
    <section className="panel salesEditor"><div className="panelHead"><div><h3>{editing?"تعديل المبيعة":"تسجيل مبيعة يدوية"}</h3><p>لا يشترط سحب حساب لتسجيل البيع.</p></div></div><div className="salesForm">
      <label>العميل<input value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})}/></label><label>الهاتف<input dir="ltr" value={form.customerPhone} onChange={e=>setForm({...form,customerPhone:e.target.value})}/></label><label>الخدمة<select value={form.serviceName} onChange={e=>selectService(e.target.value)}><option value="">اختر الخدمة</option>{services.filter(service=>service.active).map(service=><option key={service.id} value={service.name}>{service.name}</option>)}</select></label>
      <label>الكمية<input type="number" min={1} value={form.quantity} onChange={e=>{const quantity=Math.max(1,Number(e.target.value)||1);const service=services.find(item=>item.name===form.serviceName);setForm({...form,quantity,costAmount:service?Number(service.default_cost)*quantity:form.costAmount});}}/></label><label>الإجمالي<input type="number" min={0} value={form.totalAmount||""} onChange={e=>setForm({...form,totalAmount:Math.max(0,Number(e.target.value)||0)})}/></label><label>التكلفة<input type="number" min={0} value={form.costAmount||""} onChange={e=>setForm({...form,costAmount:Math.max(0,Number(e.target.value)||0)})}/></label><label>المدفوع<input type="number" min={0} max={form.totalAmount} value={form.paidAmount||""} onChange={e=>setForm({...form,paidAmount:Math.min(form.totalAmount,Math.max(0,Number(e.target.value)||0))})}/></label>
      <label>التاريخ<input type="date" value={form.soldAt} onChange={e=>setForm({...form,soldAt:e.target.value})}/></label><label>الحالة<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as typeof form.status})}><option value="COMPLETED">مكتملة</option><option value="PENDING">معلقة</option><option value="CANCELLED">ملغاة</option></select></label><label className="wide">ملاحظات<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </div><footer>{editing&&<button className="secondary" onClick={()=>{setEditing(null);setForm(emptySale());}}>إلغاء التعديل</button>}<button className="primary" disabled={saving} onClick={save}>{saving?"جارٍ الحفظ...":editing?"حفظ التعديل":"تسجيل المبيعة"}</button></footer></section>
    <section className="panel tablePanel"><div className="panelHead"><h3>سجل المبيعات</h3><div style={{ display: "flex", gap: "0.5rem" }}><button className="link" onClick={()=>exportToExcel("stockflow-sales.xls", "سجل المبيعات والتسويات", ["الرقم","المصدر","العميل","الهاتف","الخدمة","الكمية","الإجمالي","التكلفة","المدفوع","الحالة","التاريخ"], sales.map(s=>[s.id,s.source,s.customer_name,s.customer_phone,s.service_name??s.item_description,s.quantity,s.total_amount,s.cost_amount,s.paid_amount,s.status,s.sold_at]))}><Download size={14}/> Excel</button><button className="link" onClick={()=>exportToPdf("سجل المبيعات والتسويات", ["التاريخ","المصدر","العميل","الهاتف","الخدمة","الإجمالي","المدفوع","المتبقي","الحالة"], sales.map(s=>[formatArabicDate(s.sold_at), s.source==="WITHDRAWAL"?"سحب":"يدوي", s.customer_name, s.customer_phone??"—", s.service_name??s.item_description, Number(s.total_amount), Number(s.paid_amount), Math.max(0,Number(s.total_amount)-Number(s.paid_amount)), s.status]))}><FileText size={14}/> PDF</button><button className="link" onClick={()=>downloadCsv("stockflow-sales.csv",[["الرقم","المصدر","العميل","الهاتف","الخدمة","الكمية","الإجمالي","التكلفة","المدفوع","الحالة","التاريخ"],...sales.map(s=>[s.id,s.source,s.customer_name,s.customer_phone,s.service_name??s.item_description,s.quantity,s.total_amount,s.cost_amount,s.paid_amount,s.status,s.sold_at])])}><Download size={14}/> CSV</button></div></div><div className="tableWrap"><table><thead><tr><th>التاريخ</th><th>المصدر</th><th>العميل</th><th>الخدمة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th/></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{formatArabicDate(s.sold_at)}</td><td><span className="status">{s.source==="WITHDRAWAL"?"سحب":"يدوي"}</span></td><td><b>{s.customer_name}</b><small className="tableSubtext">{s.customer_phone}</small></td><td>{s.service_name??s.item_description}</td><td><b>{Number(s.total_amount).toLocaleString("ar-EG")}</b></td><td>{Number(s.paid_amount).toLocaleString("ar-EG")}</td><td>{Math.max(0,Number(s.total_amount)-Number(s.paid_amount)).toLocaleString("ar-EG")}</td><td>{s.status}</td><td><div className="rowActions"><button className="dots" onClick={()=>edit(s)}><Pencil size={13}/></button><button className="dots danger" onClick={()=>remove(s.id)}><Trash2 size={13}/></button></div></td></tr>)}</tbody></table></div></section>
  </>;
}

type PeriodPreset = "today" | "7d" | "30d" | "month" | "all" | "custom";
function periodRange(preset: PeriodPreset): { from: string; to: string } {
  const today = todayInCairo();
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: addDaysToDate(today, -6), to: today };
  if (preset === "30d") return { from: addDaysToDate(today, -29), to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: "", to: "" };
}
function PeriodFilter({ preset, setPreset, custom, setCustom }: {
  preset: PeriodPreset; setPreset: (p: PeriodPreset) => void;
  custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void;
}) {
  const presets: [PeriodPreset, string][] = [["today", "اليوم"], ["7d", "آخر أسبوع"], ["30d", "آخر شهر"], ["month", "الشهر الحالي"], ["all", "كل الفترات"], ["custom", "مخصص"]];
  return (
    <div className="periodFilter panel">
      <div className="periodChips">
        {presets.map(([id, label]) => (
          <button key={id} className={preset === id ? "active" : ""} onClick={() => setPreset(id)}>{label}</button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="periodCustom">
          <label>من <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
          <label>إلى <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
        </div>
      )}
    </div>
  );
}

type AccountingData = {
  summary: { revenue: number; collected: number; cost: number; outstanding: number; expenses: number; grossProfit: number; netProfit: number; treasury: number; sales: number };
  perService: { name: string; revenue: number; cost: number; profit: number; sales: number }[];
  perEmployee: { name: string; revenue: number; profit: number; sales: number }[];
  debts: { customer: string; customer_name: string; total: number; paid: number; remaining: number; sales: number }[];
  expensesByCategory: { category: string; total: number }[];
};
type ExpenseRow = { id: string; description: string; category: string; amount: number; spent_at: string; created_at: string };

function Accounting({ flash, dataVersion, onChanged }: { flash: (s: string) => void; dataVersion: number; onChanged: () => void }) {
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = preset === "custom" ? custom : periodRange(preset);
  const qs = `${range.from ? `from=${range.from}&` : ""}${range.to ? `to=${range.to}` : ""}`;
  const [data, setData] = useState<AccountingData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: 0, category: "عام" });
  useEffect(() => {
    fetch(`/api/accounting?${qs}`).then((r) => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setData(null));
    fetch(`/api/expenses?${qs}`).then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setExpenses(d.expenses)).catch(() => setExpenses([]));
  }, [qs, dataVersion]);
  const s = data?.summary;
  const money = (n: number | undefined) => `${(n ?? 0).toLocaleString("ar-EG")} ج.م`;
  async function addExpense() {
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) { flash("اكتب وصفًا ومبلغًا صحيحًا للمصروف"); return; }
    const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: expenseForm.description, amount: Math.round(expenseForm.amount), category: expenseForm.category || "عام" }) });
    if (!res.ok) { flash("تعذر إضافة المصروف"); return; }
    setExpenseForm({ description: "", amount: 0, category: "عام" }); flash("تمت إضافة المصروف"); onChanged();
  }
  async function deleteExpense(id: string) {
    if (!window.confirm("حذف هذا المصروف؟")) return;
    const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) { flash("تم حذف المصروف"); onChanged(); }
  }
  async function collectDebt(customer: string, remaining: number) {
    const input = window.prompt(`المبلغ المُحصّل من ${customer} (المتبقي ${remaining} ج.م):`, String(remaining));
    if (input === null) return;
    const amount = Math.round(Number(input));
    if (!amount || amount <= 0) return;
    const isPhone = /\d/.test(customer);
    const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isPhone ? { customerPhone: customer, amount } : { customerName: customer, amount }) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) { flash(result.error === "NO_OUTSTANDING" ? "لا يوجد مبلغ مستحق على هذا العميل" : "تعذر تسجيل الدفعة"); return; }
    flash(`تم تحصيل ${result.applied} ج.م`); onChanged();
  }
  return (
    <>
      <PageHead title="المحاسبة" subtitle="الإيرادات والتكلفة والأرباح والمصروفات وديون العملاء خلال الفترة.">
        <button className="secondary" onClick={() => exportToExcel("stockflow-accounting.xls", "ملخص تقرير المحاسبة والخزنة", ["المؤشر", "القيمة (ج.م)"], [["الإيراد", s?.revenue ?? 0], ["المحصّل", s?.collected ?? 0], ["التكلفة", s?.cost ?? 0], ["مجمل الربح", s?.grossProfit ?? 0], ["المصروفات", s?.expenses ?? 0], ["صافي الربح", s?.netProfit ?? 0], ["الخزينة", s?.treasury ?? 0], ["مستحقات العملاء", s?.outstanding ?? 0]])}><Download size={15} /> تصدير Excel</button>
        <button className="secondary" onClick={() => exportToPdf("تقرير المحاسبة والخزنة والربحية", ["المؤشر", "القيمة (ج.م)"], [["الإيراد", s?.revenue ?? 0], ["المحصّل", s?.collected ?? 0], ["التكلفة", s?.cost ?? 0], ["مجمل الربح", s?.grossProfit ?? 0], ["المصروفات", s?.expenses ?? 0], ["صافي الربح", s?.netProfit ?? 0], ["الخزينة", s?.treasury ?? 0], ["مستحقات العملاء", s?.outstanding ?? 0]])}><FileText size={15} /> تصدير PDF</button>
        <button className="secondary" onClick={() => downloadCsv("stockflow-accounting.csv", [["المؤشر", "القيمة (ج.م)"], ["الإيراد", s?.revenue ?? 0], ["المحصّل", s?.collected ?? 0], ["التكلفة", s?.cost ?? 0], ["مجمل الربح", s?.grossProfit ?? 0], ["المصروفات", s?.expenses ?? 0], ["صافي الربح", s?.netProfit ?? 0], ["الخزينة", s?.treasury ?? 0], ["مستحقات العملاء", s?.outstanding ?? 0]])}><Download size={15} /> CSV</button>
      </PageHead>
      <PeriodFilter preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
      <div className="metrics">
        <Metric icon={TrendingUp} label="الإيراد" value={money(s?.revenue)} change={`${s?.sales ?? 0} عملية`} note="إجمالي المبيعات" tone="blue" />
        <Metric icon={Boxes} label="التكلفة" value={money(s?.cost)} change="تكلفة البضاعة" note="حسب تكلفة الخدمة" tone="orange" />
        <Metric icon={Wallet} label="مجمل الربح" value={money(s?.grossProfit)} change="الإيراد − التكلفة" note="قبل المصروفات" tone="green" />
        <Metric icon={FileBarChart} label="صافي الربح" value={money(s?.netProfit)} change={`− ${money(s?.expenses)} مصروفات`} note="بعد المصروفات" tone="purple" />
      </div>
      <div className="metrics">
        <Metric icon={Wallet} label="الخزينة" value={money(s?.treasury)} change="محصّل − مصروفات" note="النقدية المتاحة" tone="green" />
        <Metric icon={PackageCheck} label="المحصّل" value={money(s?.collected)} change="مدفوع" note="من العملاء" tone="blue" />
        <Metric icon={AlertTriangle} label="مستحقات (آجل)" value={money(s?.outstanding)} change="غير محصّل" note="ديون العملاء" tone="orange" />
        <Metric icon={TrendingUp} label="المصروفات" value={money(s?.expenses)} change="مصروفات الفترة" note="إجمالي الخرج" tone="purple" />
      </div>
      <div className="dashboardGrid">
        <section className="panel tablePanel">
          <div className="panelHead"><h3>الربح حسب الخدمة</h3></div>
          <div className="tableWrap"><table>
            <thead><tr><th>الخدمة</th><th>مبيعات</th><th>إيراد</th><th>تكلفة</th><th>ربح</th></tr></thead>
            <tbody>
              {(data?.perService ?? []).map((r) => (<tr key={r.name}><td><b>{r.name}</b></td><td>{r.sales}</td><td>{money(r.revenue)}</td><td>{money(r.cost)}</td><td><b>{money(r.profit)}</b></td></tr>))}
              {!(data?.perService?.length) && <tr><td colSpan={5} className="emptyState">لا توجد مبيعات في الفترة.</td></tr>}
            </tbody>
          </table></div>
        </section>
        <section className="panel tablePanel">
          <div className="panelHead"><h3>ديون العملاء (آجل)</h3></div>
          <div className="tableWrap"><table>
            <thead><tr><th>العميل</th><th>إجمالي</th><th>مدفوع</th><th>متبقي</th><th /></tr></thead>
            <tbody>
              {(data?.debts ?? []).map((r) => (<tr key={r.customer}><td><b>{r.customer_name || r.customer}</b><small className="tableSubtext">{r.customer}</small></td><td>{money(r.total)}</td><td>{money(r.paid)}</td><td><b>{money(r.remaining)}</b></td><td><button className="dots" onClick={() => collectDebt(r.customer, r.remaining)}>تحصيل</button></td></tr>))}
              {!(data?.debts?.length) && <tr><td colSpan={5} className="emptyState">لا توجد مستحقات على العملاء.</td></tr>}
            </tbody>
          </table></div>
        </section>
      </div>
      <section className="panel tablePanel">
        <div className="panelHead"><h3>المصروفات</h3></div>
        <div className="expenseForm">
          <label>الوصف<input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="مثال: إعلان فيسبوك" /></label>
          <label>المبلغ (ج.م)<input type="number" min={1} value={expenseForm.amount || ""} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" /></label>
          <label>التصنيف<input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} placeholder="عام" /></label>
          <button className="primary" onClick={addExpense}><Plus size={15} /> إضافة مصروف</button>
        </div>
        <div className="tableWrap"><table>
          <thead><tr><th>التاريخ</th><th>الوصف</th><th>التصنيف</th><th>المبلغ</th><th /></tr></thead>
          <tbody>
            {expenses.map((e) => (<tr key={e.id}><td>{formatArabicDate(String(e.spent_at))}</td><td>{e.description}</td><td>{e.category}</td><td><b>{money(e.amount)}</b></td><td><button className="dots danger" aria-label="حذف" onClick={() => deleteExpense(e.id)}><Trash2 size={14} /></button></td></tr>))}
            {!expenses.length && <tr><td colSpan={5} className="emptyState">لا توجد مصروفات في الفترة.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}

type SupplierRow = { id: string; name: string; phone: string | null; notes: string | null; total_purchased: number; total_paid: number; owed: number; purchases: number };
type PurchaseRow = { id: string; supplier_id: string; supplier: string; item: string; quantity: number; unit_cost: number; total: number; paid: number; remaining: number; purchased_at: string; notes: string | null };
type WageRow = { id: string; name: string; role: string | null; amount: number; paid_at: string; notes: string | null };

function Suppliers({ flash, services }: { flash: (s: string) => void; services:ServiceRecord[] }) {
  const [tab, setTab] = useState<"suppliers" | "wages">("suppliers");
  const [version, setVersion] = useState(0);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [wages, setWages] = useState<WageRow[]>([]);
  const [wageTotal, setWageTotal] = useState(0);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "" });
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: "", item: "", quantity: 1, unitCost: 0, paid: 0, paidInFull: true });
  const [wageForm, setWageForm] = useState({ name: "", role: "", amount: 0 });
  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setSuppliers(d.suppliers)).catch(() => {});
    fetch("/api/purchases").then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setPurchases(d.purchases)).catch(() => {});
    fetch("/api/wages").then((r) => r.ok ? r.json() : Promise.reject()).then((d) => { setWages(d.wages); setWageTotal(d.total); }).catch(() => {});
  }, [version]);
  const money = (n: number) => `${(n ?? 0).toLocaleString("ar-EG")} ج.م`;
  const refresh = () => setVersion((v) => v + 1);
  async function addSupplier() { if (supplierForm.name.trim().length < 2) { flash("اكتب اسم المورد"); return; } const r = await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(supplierForm) }); if (!r.ok) { flash("تعذر إضافة المورد"); return; } setSupplierForm({ name: "", phone: "" }); flash("تمت إضافة المورد"); refresh(); }
  async function delSupplier(id: string) { if (!window.confirm("حذف المورد وكل مشترياته؟")) return; const r = await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (r.ok) { flash("تم حذف المورد"); refresh(); } }
  async function paySupplier(s: SupplierRow) { const input = window.prompt(`المبلغ المدفوع لـ ${s.name} (المتبقي ${s.owed} ج.م):`, String(s.owed)); if (input === null) return; const pay = Math.round(Number(input)); if (!pay || pay <= 0) return; const r = await fetch(`/api/suppliers?id=${encodeURIComponent(s.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pay }) }); const res = await r.json().catch(() => ({})); if (!r.ok) { flash(res.error === "NO_OUTSTANDING" ? "لا يوجد مبلغ مستحق" : "تعذر تسجيل الدفعة"); return; } flash(`تم دفع ${res.applied} ج.م`); refresh(); }
  async function addPurchase() { if (!purchaseForm.supplierId) { flash("اختر المورد"); return; } if (!purchaseForm.item.trim()) { flash("اكتب الصنف"); return; } const total = purchaseForm.quantity * purchaseForm.unitCost; const paid = purchaseForm.paidInFull ? total : Math.min(purchaseForm.paid, total); const r = await fetch("/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId: purchaseForm.supplierId, item: purchaseForm.item, quantity: purchaseForm.quantity, unitCost: purchaseForm.unitCost, paid }) }); if (!r.ok) { flash("تعذر تسجيل الشراء"); return; } setPurchaseForm({ supplierId: purchaseForm.supplierId, item: "", quantity: 1, unitCost: 0, paid: 0, paidInFull: true }); flash("تم تسجيل الشراء"); refresh(); }
  async function delPurchase(id: string) { if (!window.confirm("حذف عملية الشراء؟")) return; const r = await fetch(`/api/purchases?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (r.ok) { flash("تم الحذف"); refresh(); } }
  async function addWage() { if (wageForm.name.trim().length < 2 || wageForm.amount <= 0) { flash("اكتب الاسم والمبلغ"); return; } const r = await fetch("/api/wages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: wageForm.name, role: wageForm.role, amount: Math.round(wageForm.amount) }) }); if (!r.ok) { flash("تعذر تسجيل الدفعة"); return; } setWageForm({ name: "", role: "", amount: 0 }); flash("تم تسجيل الراتب/الأجر"); refresh(); }
  async function delWage(id: string) { if (!window.confirm("حذف السجل؟")) return; const r = await fetch(`/api/wages?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (r.ok) { flash("تم الحذف"); refresh(); } }
  const totalOwed = suppliers.reduce((sum, x) => sum + x.owed, 0);
  const totalPurchased = suppliers.reduce((sum, x) => sum + x.total_purchased, 0);
  return (
    <>
      <PageHead title="الموردين والمشتريات" subtitle="تابع مشترياتك من كل تاجر والمستحق عليك — منفصل تمامًا عن المصروفات." />
      <div className="periodChips" style={{ marginBottom: 16 }}>
        <button className={tab === "suppliers" ? "active" : ""} onClick={() => setTab("suppliers")}>الموردون والمشتريات</button>
        <button className={tab === "wages" ? "active" : ""} onClick={() => setTab("wages")}>الرواتب والأجور</button>
      </div>
      {tab === "suppliers" ? (
        <>
          <div className="metrics">
            <Metric icon={Truck} label="الموردون" value={String(suppliers.length)} change="مسجّل" note="عدد التجار" tone="blue" />
            <Metric icon={Boxes} label="إجمالي المشتريات" value={money(totalPurchased)} change="مدى الحياة" note="قيمة ما اشتريته" tone="purple" />
            <Metric icon={AlertTriangle} label="المستحق عليك" value={money(totalOwed)} change="آجل الموردين" note="لكل الموردين" tone="orange" />
          </div>
          <div className="dashboardGrid">
            <section className="panel tablePanel">
              <div className="panelHead"><h3>الموردون</h3></div>
              <div className="expenseForm" style={{ gridTemplateColumns: "2fr 1fr auto" }}>
                <label>اسم المورد<input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="مثال: محمد" /></label>
                <label>الهاتف<input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="01xxxxxxxxx" dir="ltr" /></label>
                <button className="primary" onClick={addSupplier}><Plus size={15} /> إضافة مورد</button>
              </div>
              <div className="tableWrap"><table>
                <thead><tr><th>المورد</th><th>مشتريات</th><th>مدفوع</th><th>مستحق</th><th /></tr></thead>
                <tbody>
                  {suppliers.map((s) => (<tr key={s.id}><td><b>{s.name}</b><small className="tableSubtext">{s.phone || "—"}</small></td><td>{money(s.total_purchased)}</td><td>{money(s.total_paid)}</td><td><b>{money(s.owed)}</b></td><td><div className="rowActions">{s.owed > 0 && <button className="dots" onClick={() => paySupplier(s)}>دفع</button>}<button className="dots danger" onClick={() => delSupplier(s.id)}><Trash2 size={14} /></button></div></td></tr>))}
                  {!suppliers.length && <tr><td colSpan={5} className="emptyState">لا يوجد موردون بعد.</td></tr>}
                </tbody>
              </table></div>
            </section>
            <section className="panel tablePanel">
              <div className="panelHead"><h3>تسجيل عملية شراء</h3></div>
              <div className="expenseForm" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label>المورد<select value={purchaseForm.supplierId} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}><option value="">اختر المورد</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label>الخدمة / الصنف<select value={purchaseForm.item} onChange={(e) => {const service=services.find(item=>item.name===e.target.value);setPurchaseForm({ ...purchaseForm, item:e.target.value, unitCost:service?Number(service.default_cost):purchaseForm.unitCost });}}><option value="">اختر من الخدمات</option>{services.filter(service=>service.active).map(service=><option key={service.id} value={service.name}>{service.name}</option>)}</select></label>
                <label>الكمية<input type="number" min={1} value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: Math.max(1, Number(e.target.value) || 1) })} /></label>
                <label>سعر الوحدة (ج.م)<input type="number" min={0} value={purchaseForm.unitCost || ""} onChange={(e) => setPurchaseForm({ ...purchaseForm, unitCost: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" /></label>
                <label>حالة الدفع<select value={purchaseForm.paidInFull ? "FULL" : "PARTIAL"} onChange={(e) => setPurchaseForm({ ...purchaseForm, paidInFull: e.target.value === "FULL" })}><option value="FULL">مدفوع بالكامل</option><option value="PARTIAL">آجل / جزئي</option></select></label>
                {!purchaseForm.paidInFull && <label>المدفوع الآن<input type="number" min={0} value={purchaseForm.paid || ""} onChange={(e) => setPurchaseForm({ ...purchaseForm, paid: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" /></label>}
              </div>
              <div style={{ padding: "0 16px 14px" }}><button className="primary" onClick={addPurchase}><Plus size={15} /> تسجيل الشراء (الإجمالي {money(purchaseForm.quantity * purchaseForm.unitCost)})</button></div>
            </section>
          </div>
          <section className="panel tablePanel">
            <div className="panelHead"><h3>سجل المشتريات</h3></div>
            <div className="tableWrap"><table>
              <thead><tr><th>التاريخ</th><th>المورد</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th>مدفوع</th><th>متبقي</th><th /></tr></thead>
              <tbody>
                {purchases.map((p) => (<tr key={p.id}><td>{formatArabicDate(String(p.purchased_at))}</td><td>{p.supplier}</td><td>{p.item}</td><td>{p.quantity}</td><td>{money(p.unit_cost)}</td><td><b>{money(p.total)}</b></td><td>{money(p.paid)}</td><td><b>{money(p.remaining)}</b></td><td><button className="dots danger" onClick={() => delPurchase(p.id)}><Trash2 size={14} /></button></td></tr>))}
                {!purchases.length && <tr><td colSpan={9} className="emptyState">لا توجد مشتريات مسجّلة.</td></tr>}
              </tbody>
            </table></div>
          </section>
        </>
      ) : (
        <>
          <div className="metrics">
            <Metric icon={UsersRound} label="إجمالي الرواتب والأجور" value={money(wageTotal)} change="مدفوع" note="كل السجلات" tone="purple" />
          </div>
          <section className="panel tablePanel">
            <div className="panelHead"><h3>تسجيل راتب / أجر / تعويض</h3></div>
            <div className="expenseForm">
              <label>الاسم<input value={wageForm.name} onChange={(e) => setWageForm({ ...wageForm, name: e.target.value })} placeholder="اسم الشخص" /></label>
              <label>الصفة<input value={wageForm.role} onChange={(e) => setWageForm({ ...wageForm, role: e.target.value })} placeholder="مثال: موظف / تعويض" /></label>
              <label>المبلغ (ج.م)<input type="number" min={1} value={wageForm.amount || ""} onChange={(e) => setWageForm({ ...wageForm, amount: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" /></label>
              <button className="primary" onClick={addWage}><Plus size={15} /> تسجيل</button>
            </div>
            <div className="tableWrap"><table>
              <thead><tr><th>التاريخ</th><th>الاسم</th><th>الصفة</th><th>المبلغ</th><th /></tr></thead>
              <tbody>
                {wages.map((w) => (<tr key={w.id}><td>{formatArabicDate(String(w.paid_at))}</td><td><b>{w.name}</b></td><td>{w.role || "—"}</td><td><b>{money(w.amount)}</b></td><td><button className="dots danger" onClick={() => delWage(w.id)}><Trash2 size={14} /></button></td></tr>))}
                {!wages.length && <tr><td colSpan={5} className="emptyState">لا توجد سجلات.</td></tr>}
              </tbody>
            </table></div>
          </section>
        </>
      )}
    </>
  );
}
function Activity() {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  useEffect(() => { fetch("/api/activity").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setRecords(data.activity)).catch(() => {}); }, []);
  const actionLabels: Record<string, string> = { WITHDRAWAL: "سحب حساب", EMPLOYEE_CREATED: "إنشاء موظف", EMPLOYEE_DISABLED: "إيقاف موظف", EMPLOYEE_ENABLED: "تفعيل موظف", EMPLOYEE_PERMISSIONS_UPDATED: "تعديل صلاحيات موظف", SERVICE_CREATED: "إضافة خدمة" };
  const visible = records.filter((record) => `${record.action} ${record.actor} ${record.entity_id}`.toLowerCase().includes(search.toLowerCase()) && (type === "ALL" || record.action === type));
  return (
    <>
      <PageHead
        title="سجل النشاط"
        subtitle="سجل تدقيق كامل لكل ما يحدث داخل النظام."
      />
      <section className="panel activityPage">
        <div className="tableTools">
          <div className="search wide">
            <Search size={17} strokeWidth={1.8} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في السجل..." />
          </div>
          <select aria-label="نوع النشاط" value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">كل الأنشطة</option><option value="WITHDRAWAL">سحب</option><option value="EMPLOYEE_PERMISSIONS_UPDATED">صلاحيات</option><option value="SERVICE_CREATED">خدمات</option></select>
          <button onClick={() => { setSearch(""); setType("ALL"); }}>مسح الفلاتر</button>
        </div>
        {visible.map((record) => (
          <div className="activityRow" key={String(record.id)}>
            <i className="blue">{String(record.action).slice(0, 1)}</i>
            <div>
              <b>{actionLabels[String(record.action)] ?? String(record.action)}</b>
              <span>بواسطة {String(record.actor)} • {String(record.entity_id ?? "")}</span>
            </div>
            <em className="blue">{String(record.entity_type ?? "نشاط")}</em>
            <time>{new Date(String(record.created_at)).toLocaleString("ar-EG")}</time>
          </div>
        ))}
        {!visible.length && <div className="emptyState">لا توجد أنشطة مطابقة.</div>}
      </section>
    </>
  );
}
function EmployeeHistory({ access }: { access: EmployeeAccessStats | null }) {
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { fetch("/api/withdrawals").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setWithdrawals(data.withdrawals)).catch(() => {}); }, []);
  const visible = withdrawals.filter((row) => `${row.id} ${row.service} ${row.inventory_item_id} ${row.customer_name} ${row.customer_phone}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <PageHead
        title="سجل سحوباتي"
        subtitle="كل الحسابات التي سحبتها وحالة كل عملية."
      />
      <div className="limitSummary employeeStats">
        <div>
          <span>سحوبات اليوم</span>
          <b>{withdrawals.filter((row) => new Date(String(row.created_at)).toDateString() === new Date().toDateString()).length}</b>
        </div>
        <div>
          <span>المتبقي اليوم</span>
          <b>{Math.max(0,(access?.dailyLimit ?? 0)-(access?.usedToday ?? 0))}</b>
        </div>
        <div>
          <span>هذا الشهر</span>
          <b>{withdrawals.length}</b>
        </div>
        <div>
          <span>الخدمات المسموحة</span>
          <b>{access?.permissions.filter((permission)=>permission.enabled).length ?? 0}</b>
        </div>
      </div>
      <section className="panel tablePanel">
        <div className="tableTools">
          <div className="search wide">
            <Search size={17} strokeWidth={1.8} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في سحوباتك..." />
          </div>
          <button onClick={() => setSearch("")}>مسح البحث</button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>رقم العملية</th>
                <th>الخدمة</th>
                <th>العميل</th>
                <th>رقم الحساب</th>
                <th>الاشتراك</th>
                <th>الضمان</th>
                <th>سعر البيع</th>
                <th>الوقت</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    <b className="mono">{String(row.id)}</b>
                  </td>
                  <td>
                    <b>{String(row.service)}</b>
                  </td>
                  <td><b>{String(row.customer_name ?? "—")}</b><small className="tableSubtext">{String(row.customer_phone ?? "")}</small></td>
                  <td className="mono">{String(row.inventory_item_id)}</td>
                  <td><b>{row.subscription_months ? `${row.subscription_months} شهر` : "—"}</b><small className="tableSubtext">حتى {formatArabicDate(String(row.subscription_end_date ?? ""))}</small></td>
                  <td><b>{Number(row.warranty_days ?? 0) ? `${row.warranty_days} يوم` : "بدون"}</b><small className="tableSubtext">{row.warranty_end_date ? `حتى ${formatArabicDate(String(row.warranty_end_date))}` : ""}</small></td>
                  <td><b>{row.selling_price ? `${row.selling_price} ج.م` : "—"}</b></td>
                  <td>{new Date(String(row.created_at)).toLocaleString("ar-EG")}</td>
                  <td>
                    <span className="status">{String(row.status) === "COMPLETED" ? "مكتمل" : String(row.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Settings({
  dark,
  setDark,
  flash,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
  flash: (s: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("عام");
  const [settings,setSettings]=useState({systemName:"StockFlow",timezone:"Africa/Cairo",currency:"EGP",language:"ar",allocationStrategy:"FIFO",lowStockThreshold:5,sessionTimeoutMinutes:480,allowSharedAccounts:true,notificationsEnabled:true});
  const [saved,setSaved]=useState(settings);const [saving,setSaving]=useState(false);
  const tabs = ["عام", "الذكاء الاصطناعي", "التخصيص والسحب", "الأمان", "الإشعارات"];
  useEffect(()=>{fetch("/api/settings",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).then(({settings:s})=>{const value={systemName:s.system_name,timezone:s.timezone,currency:s.currency,language:s.language,allocationStrategy:s.allocation_strategy,lowStockThreshold:Number(s.low_stock_threshold),sessionTimeoutMinutes:Number(s.session_timeout_minutes),allowSharedAccounts:Boolean(s.allow_shared_accounts),notificationsEnabled:Boolean(s.notifications_enabled)};setSettings(value);setSaved(value);}).catch(()=>flash("تعذر تحميل إعدادات الشركة"));},[flash]);
  async function saveSettings(){setSaving(true);const response=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});setSaving(false);if(!response.ok){flash("تعذر حفظ الإعدادات");return;}setSaved(settings);localStorage.setItem("stockflow-theme",dark?"dark":"light");flash("تم حفظ إعدادات الشركة وتطبيقها");}
  function resetSettings(){setSettings(saved);flash("تم التراجع عن التغييرات غير المحفوظة");}
  return (
    <>
      <PageHead
        title="الإعدادات"
        subtitle="خصص النظام وسياسات التخصيص والحماية."
      />
      <div className="settingsGrid">
        <aside className="panel settingsNav">
          {tabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </aside>
        {activeTab === "الذكاء الاصطناعي" ? <AiConnectionSettings flash={flash} /> : <section className="panel settingsForm">
          <h3>إعدادات {activeTab}</h3>
          <p>اضبط خيارات {activeTab} ثم اضغط حفظ التغييرات.</p>
          <hr />
          {activeTab === "عام"&&<div className="formGrid">
            <label>
              اسم النظام
              <input value={settings.systemName} onChange={(event) => setSettings({...settings,systemName:event.target.value})} />
            </label>
            <label>
              المنطقة الزمنية
              <select value={settings.timezone} onChange={event=>setSettings({...settings,timezone:event.target.value})}>
                <option value="Africa/Cairo">Africa/Cairo</option><option value="UTC">UTC</option>
              </select>
            </label>
            <label>
              العملة
              <select value={settings.currency} onChange={event=>setSettings({...settings,currency:event.target.value})}>
                <option value="EGP">الجنيه المصري</option><option value="USD">الدولار</option><option value="SAR">الريال السعودي</option><option value="AED">الدرهم الإماراتي</option>
              </select>
            </label>
            <label>
              اللغة
              <select value={settings.language} onChange={event=>setSettings({...settings,language:event.target.value})}>
                <option value="ar">العربية</option><option value="en">English</option>
              </select>
            </label>
          </div>}
          {activeTab === "التخصيص والسحب"&&<div className="formGrid"><label>سياسة اختيار المخزون<select value={settings.allocationStrategy} onChange={event=>setSettings({...settings,allocationStrategy:event.target.value})}><option value="FIFO">الأقدم أولًا - FIFO</option><option value="LIFO">الأحدث أولًا - LIFO</option></select></label><label>حد تنبيه انخفاض المخزون<input type="number" min={0} value={settings.lowStockThreshold} onChange={event=>setSettings({...settings,lowStockThreshold:Math.max(0,Number(event.target.value)||0)})}/></label></div>}
          {activeTab === "الأمان"&&<div className="formGrid"><label>مدة الجلسة بالدقائق<input type="number" min={15} max={1440} value={settings.sessionTimeoutMinutes} onChange={event=>setSettings({...settings,sessionTimeoutMinutes:Math.max(15,Number(event.target.value)||15)})}/></label></div>}
          {activeTab === "عام"&&<div className="settingRow">
            <div>
              <b>الوضع الداكن</b>
              <span>استخدم واجهة داكنة مريحة للعين.</span>
            </div>
            <button
              onClick={() => setDark(!dark)}
              className={dark ? "toggle on" : "toggle"}
            >
              <i />
            </button>
          </div>}
          {activeTab === "التخصيص والسحب"&&<div className="settingRow">
            <div>
              <b>السماح بالحسابات المشتركة</b><span>السماح باستخدام الحساب الواحد حتى سعته المحددة.</span>
            </div>
            <button onClick={() => setSettings({...settings,allowSharedAccounts:!settings.allowSharedAccounts})} className={settings.allowSharedAccounts ? "toggle on" : "toggle"}>
              <i />
            </button>
          </div>}
          {activeTab === "الإشعارات"&&<div className="settingRow"><div><b>إشعارات النظام</b><span>تنبيهات انخفاض المخزون والأحداث المهمة.</span></div><button onClick={()=>setSettings({...settings,notificationsEnabled:!settings.notificationsEnabled})} className={settings.notificationsEnabled?"toggle on":"toggle"}><i/></button></div>}
          <footer>
            <button className="secondary" onClick={resetSettings}>إلغاء</button>
            <button
              className="primary"
              onClick={saveSettings} disabled={saving}
            >
              {saving?"جارٍ الحفظ...":"حفظ التغييرات"}
            </button>
          </footer>
        </section>}
      </div>
    </>
  );
}

type AiConnectionStatus = {
  connected: boolean;
  connection: null | { provider: string; keyHint: string; model: string; enabled: boolean; updatedAt: string };
};

function AiConnectionSettings({ flash }: { flash: (message: string) => void }) {
  const [status, setStatus] = useState<AiConnectionStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-5.6-terra");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/ai-connection", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as AiConnectionStatus;
      setStatus(data);
      if (data.connection?.model) setModel(data.connection.model);
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/ai-connection", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: AiConnectionStatus) => {
        if (!active) return;
        setStatus(data);
        if (data.connection?.model) setModel(data.connection.model);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function connect() {
    if (!apiKey.trim()) { setError("أدخل مفتاح OpenAI API أولًا."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/ai-connection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey.trim(), model }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(result.error === "INVALID_KEY" || result.error === "INVALID_INPUT"
        ? "المفتاح غير صحيح أو غير مكتمل."
        : "تعذر التحقق من OpenAI حاليًا. حاول مرة أخرى.");
      return;
    }
    setApiKey(""); setShowKey(false); await loadStatus();
    flash("تم تشفير وربط مفتاح OpenAI بحسابك");
  }

  async function disconnect() {
    setBusy(true); setError("");
    const response = await fetch("/api/ai-connection", { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { setError("تعذر فصل الاتصال."); return; }
    await loadStatus(); flash("تم فصل مفتاح OpenAI من حسابك");
  }

  return (
    <section className="panel settingsForm aiSettings">
      <div className="aiSettingsHead">
        <span className="aiSettingsIcon"><Sparkles size={22} /></span>
        <div><h3>ربط النموذج الذكي</h3><p>اربط مفتاح OpenAI الخاص بك لتفعيل مساعد StockFlow.</p></div>
        <span className={status?.connected ? "connectionBadge connected" : "connectionBadge"}>{status?.connected ? "متصل" : "غير متصل"}</span>
      </div>
      <div className="securityNote"><ShieldCheck size={18} /><div><b>المفتاح مشفّر</b><span>يُرسل من السيرفر فقط، ولن يظهر مرة أخرى بعد الحفظ.</span></div></div>
      {status?.connected && status.connection && (
        <div className="connectedKey"><div><span>OpenAI API</span><b>•••• •••• •••• {status.connection.keyHint}</b></div><div><span>النموذج</span><b>{status.connection.model}</b></div><button className="dangerButton" disabled={busy} onClick={disconnect}>فصل الاتصال</button></div>
      )}
      <div className="formGrid aiConnectionForm">
        <label>مفتاح OpenAI API
          <div className="secretInput"><input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-proj-..." autoComplete="off" spellCheck={false} /><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? "إخفاء" : "إظهار"}</button></div>
        </label>
        <label>النموذج الافتراضي
          <select value={model} onChange={(event) => setModel(event.target.value)}><option value="gpt-5.6-terra">GPT-5.6 Terra — متوازن</option><option value="gpt-5.6-sol">GPT-5.6 Sol — أعلى جودة</option><option value="gpt-5.6-luna">GPT-5.6 Luna — أقل تكلفة</option></select>
        </label>
      </div>
      {error && <p className="formError aiConnectionError">{error}</p>}
      <div className="aiCapabilities"><b>التمهيد الحالي يجهز:</b><span>تقارير ذكية</span><span>تنبيهات المخزون</span><span>تحليل الأرباح</span><span>إجراءات بعد التأكيد</span></div>
      <footer><button className="primary" disabled={busy || !apiKey.trim()} onClick={connect}>{busy ? "جارٍ التحقق..." : status?.connected ? "استبدال المفتاح" : "تحقق وربط المفتاح"}</button></footer>
    </section>
  );
}
