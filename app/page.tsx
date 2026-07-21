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
  History,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  PackageMinus,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Trophy,
  Upload,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type View =
  | "organizations"
  | "dashboard"
  | "withdraw"
  | "inventory"
  | "services"
  | "employees"
  | "reports"
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
  { id: "activity", label: "سجل النشاط", icon: History },
  { id: "settings", label: "الإعدادات", icon: SettingsIcon },
];

const services = [
  {
    name: "ChatGPT Plus",
    code: "GPT",
    color: "#111827",
    stock: 84,
    used: 68,
    total: 152,
    type: "مشترك",
    price: 450,
  },
  {
    name: "Adobe CC",
    code: "Ai",
    color: "#ef4444",
    stock: 12,
    used: 42,
    total: 54,
    type: "فردي",
    price: 620,
  },
  {
    name: "Canva Pro",
    code: "Ca",
    color: "#8b5cf6",
    stock: 38,
    used: 71,
    total: 109,
    type: "مشترك",
    price: 180,
  },
  {
    name: "Claude Pro",
    code: "Cl",
    color: "#d97706",
    stock: 7,
    used: 29,
    total: 36,
    type: "فردي",
    price: 500,
  },
  {
    name: "Perplexity",
    code: "Px",
    color: "#0f766e",
    stock: 25,
    used: 20,
    total: 45,
    type: "مشترك",
    price: 280,
  },
  {
    name: "Midjourney",
    code: "Mj",
    color: "#2563eb",
    stock: 19,
    used: 31,
    total: 50,
    type: "فردي",
    price: 350,
  },
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
};

type ServiceRecord = {
  id: string;
  name: string;
  active: boolean;
  default_daily_limit: number;
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
};

type DashboardStats = {
  inventory: { total: number; available: number; used: number };
  withdrawalsToday: number;
  employees: { total: number; active: number };
  withdrawalTrend: { day: string; count: number }[];
  lowStock: { id: string; name: string; available_slots: number }[];
  topEmployees: { id: string; name: string; team: string; withdrawals: number }[];
  recentActivity: { id: string; name: string; service: string; customer_name: string | null; created_at: string }[];
};

type EmployeeRecord = {
  id: string; email: string; name: string; initials: string; team: string; today: number; limit: number; month: number;
  enabled: boolean; color: string; allowed: { id: string; name: string; enabled: boolean; limit: number }[];
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
  "ChatGPT Plus": "chatgpt", "Adobe CC": "adobe", "Canva Pro": "canva",
  "Claude Pro": "claude", Perplexity: "perplexity", Midjourney: "midjourney",
};

function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const user = data.user as CurrentUser;
        setCurrentUser(user);
        setRole(user.role);
        setLoggedIn(true);
        setEmployeeBlocked(user.role === "employee" && !user.active);
        setView(user.role === "employee" ? "withdraw" : "dashboard");
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
    const source = live.length ? live : services;
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
      setServiceData(data.services);
      const selected = data.services.find((s: ServiceRecord) => s.name === selectedService.name);
      if (selected) setSelectedService((current) => ({
        ...current,
        stock: selected.available_slots,
        total: selected.total_capacity,
        type: selected.available_shared_slots > 0 ? "مشترك" : "فردي",
      }));
    }).catch(() => {});
    if (role === "admin") {
      fetch("/api/inventory").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
        setInventoryData(data.items.map((item: Record<string, unknown>) => ({
          id: String(item.id), serviceId: String(item.service_id), service: String(item.service), account: String(item.email),
          password: String(item.password ?? ""), otpKey: String(item.otp_secret ?? ""), otpUrl: String(item.otp_url ?? ""),
          type: item.account_type === "SHARED" ? "مشترك" : "فردي", accountType: item.account_type as "INDIVIDUAL" | "SHARED",
          usage: `${item.current_usage} / ${item.max_usage}`, currentUsage: Number(item.current_usage), maxUsage: Number(item.max_usage),
          rawStatus: String(item.status), status: item.status === "AVAILABLE" ? "متاح" : item.status === "FULL" ? "ممتلئ" : String(item.status),
          added: new Date(String(item.created_at)).toLocaleString("ar-EG"), otpReady: Boolean(item.otp_ready),
        })));
      }).catch(() => {});
      fetch("/api/dashboard").then((r) => r.ok ? r.json() : Promise.reject()).then(setDashboardStats).catch(() => {});
    }
  }, [loggedIn, role, dataVersion, selectedService.name]);

  async function attemptWithdrawal(details: WithdrawalCustomerDetails) {
    const selectedId = serviceData.find((service) => service.name === effectiveSelectedService.name)?.id ?? serviceIds[effectiveSelectedService.name];
    const response = await fetch("/api/withdrawals", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:currentUser?.id ?? "",serviceId:selectedId,idempotencyKey:crypto.randomUUID(),...details})});
    const result = await response.json();
    if (!response.ok) {
      if(result.error==="EMPLOYEE_DISABLED") setEmployeeBlocked(true);
      const messages:Record<string,string>={EMPLOYEE_DISABLED:"تم إيقاف صلاحية السحب لحسابك بواسطة الأدمن",SERVICE_NOT_ALLOWED:"هذه الخدمة غير مسموحة لك",DAILY_LIMIT_REACHED:"وصلت إلى الحد اليومي العام",SERVICE_LIMIT_REACHED:"وصلت إلى حد هذه الخدمة",OUT_OF_STOCK:"لا يوجد مخزون متاح لهذه الخدمة"};
      flash(messages[result.error]||"تعذر تنفيذ السحب");
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
          setView(user.role === "employee" ? "withdraw" : "dashboard");
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
                : role === "admin" || item.id === "withdraw" || item.id === "activity",
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
          <div className="avatar">{role === "admin" ? "ح" : "ع"}</div>
          <div>
            <b>{currentUser?.name ?? (role === "admin" ? "حسام محمد" : "موظف")}</b>
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
          <div className="globalSearch">
            <div className="search">
              <Search size={17} strokeWidth={1.8} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالإيميل، رقم الحساب، الخدمة..."
              />
              <kbd>⌘ K</kbd>
            </div>
            {query && (
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
                  onClick={() => setView("inventory")}
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
            <Dashboard setView={setView} flash={flash} stats={dashboardStats} inventory={inventoryData} />
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
            />
          )}
          {view === "employees" && <Employees flash={flash} />}
          {view === "reports" && <Reports />}
          {view === "activity" &&
            (role === "admin" ? <Activity /> : <EmployeeHistory access={employeeAccess} />)}
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
        <form onSubmit={submit}>
          <div className="mobileBrand">
            <div className="brandmark">S</div>
            <b>StockFlow</b>
          </div>
          <span className="welcome">مرحبًا بعودتك 👋</span>
          <h2>تسجيل الدخول</h2>
          <p>أدخل بيانات الحساب التي أنشأها لك مسؤول النظام.</p>
          <label>
            البريد الإلكتروني
            <input type="email" required />
          </label>
          <label>
            كلمة المرور
            <div className="password">
              <input
                type={show ? "text" : "password"}
                  data-password
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
}: {
  setView: (v: View) => void;
  flash: (s: string) => void;
  stats: DashboardStats | null;
  inventory: InventoryRow[];
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
  const availablePercent = stats?.inventory.total
    ? Math.round((stats.inventory.available/stats.inventory.total)*100)
    : 0;
  const employeeColors = ["#2563eb","#7c3aed","#db2777"];
  return (
    <>
      <PageHead
        title="مساء الخير، حسام 👋"
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
      </div>
      <div className="dashboardGrid">
        <section className="panel chartPanel">
          <div className="panelHead">
            <div>
              <h3>نشاط السحوبات</h3>
              <p>إجمالي السحوبات خلال آخر 7 أيام</p>
            </div>
            <select>
              <option>آخر 7 أيام</option>
              <option>آخر 30 يومًا</option>
            </select>
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
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2563eb" stopOpacity=".26" />
                    <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon className="area" points={chartAreaPoints} />
                <polyline className="line" points={chartPoints} />
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
    subscriptionStartDate: todayInCairo(), subscriptionMonths: 1, warrantyDays: 30, quantity: 1,
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
  const deliveryMessage = `أهلًا ${account.customerName || "بك"} 👋\nتم تسجيل ${totalAllocatedUses} ${totalAllocatedUses === 1 ? "عملية سحب" : "عمليات سحب"} في خدمة ${selected.name} بنجاح.\n\n${accountLines}\n\n📅 بداية الاشتراك: ${formatArabicDate(account.subscriptionStartDate)}\n⏳ مدة الاشتراك: ${account.subscriptionMonths} ${account.subscriptionMonths === 1 ? "شهر" : "شهور"}\n🏁 تاريخ الانتهاء: ${formatArabicDate(account.subscriptionEndDate)}\n🛡️ الضمان: ${account.warrantyDays ? `${account.warrantyDays} يوم — حتى ${formatArabicDate(account.warrantyEndDate)}` : "بدون ضمان"}\n\n⚠️ برجاء عدم تغيير بيانات الحسابات.\nشكرًا لاختيارك لنا 💙`;
  function resetForNext() {
    setDetails({ customerName: "", customerPhone: "", customerContact: "واتساب", customerReference: "", customerNotes: "", subscriptionStartDate: todayInCairo(), subscriptionMonths: 1, warrantyDays: 30, quantity: 1 });
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
  flash,
}: {
  rows: InventoryRow[];
  query: string;
  setQuery: (s: string) => void;
  flash: (s: string) => void;
  onImport: () => void;
  onExport: () => void;
}) {
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const visibleRows = useMemo(() => rows.filter((row) =>
    (serviceFilter === "ALL" || row.service === serviceFilter) &&
    (statusFilter === "ALL" || row.rawStatus === statusFilter) &&
    (typeFilter === "ALL" || row.accountType === typeFilter)
  ), [rows, serviceFilter, statusFilter, typeFilter]);
  const total = rows.length;
  const available = rows.filter((row) => row.rawStatus === "AVAILABLE").length;
  const used = rows.filter((row) => row.currentUsage > 0).length;
  return (
    <>
      <PageHead
        title="المخزون"
        subtitle="إدارة كل الحسابات والاشتراكات من مكان واحد."
      >
        <button className="secondary" onClick={() => { onExport(); flash("تم تنزيل ملف المخزون"); }}><Download size={15} /> تصدير CSV</button>
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
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th>رقم العنصر</th>
                <th>الخدمة</th>
                <th>الإيميل</th>
                <th>OTP</th>
                <th>النوع</th>
                <th>الاستخدام</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" />
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
                  <td>{r.added}</td>
                  <td>
                    <button className="dots" aria-label={`عرض ${r.account}`} onClick={() => setSelected(r)}>عرض</button>
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
            <footer><button className="primary" onClick={() => setSelected(null)}>تم</button></footer>
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
    const items=validRows.map(([email,password,otpSecret,otpUrl])=>({serviceId:selectedId,email,password,otpSecret:otpSecret||null,otpUrl:otpUrl||null,accountType,maxUsage:accountType==="SHARED"?5:1}));
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

function Services({
  onImport,
  records,
  onAdd,
  onView,
}: {
  onImport: (service: string) => void;
  records: ServiceRecord[];
  onAdd: () => void;
  onView: (service: string) => void;
}) {
  const cards = records.length ? records.map((record, index) => {
    const preset = services.find((service) => service.name === record.name);
    return { name: record.name, code: preset?.code ?? record.name.slice(0, 2).toUpperCase(), color: preset?.color ?? ["#2563eb", "#7c3aed", "#0f766e", "#d97706"][index % 4], stock: record.available, used: Math.max(0, record.total - record.available), total: record.total, type: preset?.type ?? "مخصص", price: preset?.price ?? 0 };
  }) : services;
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
              <span>
                سعر البيع <b>{s.price} ج.م</b>
              </span>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (name.trim().length < 2) { setError("اكتب اسم الخدمة"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, defaultDailyLimit: limit }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error === "SERVICE_EXISTS" ? "الخدمة موجودة بالفعل" : "تعذر إضافة الخدمة"); return; }
      onCreated(`تمت إضافة خدمة ${result.service.name}`);
    } finally { setSaving(false); }
  }
  return <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="simpleModal"><header><div><h2>إضافة خدمة جديدة</h2><p>سيصبح لها مخزون مستقل ويمكن رفع حساباتها مباشرة.</p></div><button onClick={onClose}>×</button></header>
      <div className="modalForm"><label>اسم الخدمة<input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: Gemini Advanced" /></label><label>الحد اليومي الافتراضي<input type="number" min="0" value={limit} onChange={(event) => setLimit(Math.max(0, Number(event.target.value)))} /></label>{error && <p className="formError">{error}</p>}</div>
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
    enabled: Boolean(item.active), color: ["#2563eb", "#7c3aed", "#db2777", "#ea580c"][index % 4],
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
    const response=await fetch(`/api/employees/${updated.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:updated.enabled,dailyLimit:updated.limit,permissions:updated.allowed.map(p=>({serviceId:p.id,enabled:p.enabled,dailyLimit:p.limit}))})});
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
  useEffect(() => { fetch("/api/withdrawals").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setWithdrawals(data.withdrawals)).catch(() => {}); }, []);
  const visible = withdrawals.filter((row) => (serviceFilter === "ALL" || row.service === serviceFilter) && (employeeFilter === "ALL" || row.user_id === employeeFilter));
  const serviceCounts = visible.reduce<Record<string, number>>((counts, row) => { const name=String(row.service); counts[name]=(counts[name]??0)+1; return counts; }, {});
  const topService = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—";
  const distinctDays = new Set(visible.map((row) => new Date(String(row.created_at)).toDateString())).size;
  const averageDaily = distinctDays ? Math.round(visible.length / distinctDays) : 0;
  const uniqueEmployees = Array.from(new Map(withdrawals.map((row) => [String(row.user_id), String(row.employee)])).entries());
  const sharedCount = visible.filter((row) => row.account_type === "SHARED").length;
  const sharedPercent = visible.length ? Math.round((sharedCount / visible.length) * 100) : 0;
  const maxServiceCount = Math.max(1, ...Object.values(serviceCounts));
  return (
    <>
      <PageHead
        title="التقارير"
        subtitle="حوّل بيانات المخزون والفريق إلى قرارات واضحة."
      >
        <button className="primary" onClick={() => downloadCsv("stockflow-withdrawals.csv", [["ID","Employee","Customer","Phone","Contact","Service","Inventory ID","Start Date","Months","End Date","Warranty Days","Warranty End","Status","Created At"], ...visible.map((row) => [String(row.id),String(row.employee),String(row.customer_name??""),String(row.customer_phone??""),String(row.customer_contact??""),String(row.service),String(row.inventory_item_id),String(row.subscription_start_date??""),Number(row.subscription_months??0),String(row.subscription_end_date??""),Number(row.warranty_days??0),String(row.warranty_end_date??""),String(row.status),String(row.created_at)])])}><Download size={15} /> إنشاء وتصدير تقرير</button>
      </PageHead>
      <div className="reportFilters panel">
        <label>
          الفترة الزمنية
          <select defaultValue="30">
            <option value="30">آخر 30 يومًا</option>
          </select>
        </label>
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
  const [systemName, setSystemName] = useState("StockFlow");
  const [fifo, setFifo] = useState(true);
  const tabs = ["عام", "التخصيص والسحب", "الحدود", "الأمان", "الإشعارات", "النسخ الاحتياطي"];
  function saveSettings() {
    localStorage.setItem("stockflow-settings", JSON.stringify({ systemName, fifo, dark }));
    flash("تم حفظ الإعدادات على هذا الجهاز");
  }
  function resetSettings() { setSystemName("StockFlow"); setFifo(true); setDark(false); flash("تم إلغاء التغييرات"); }
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
        <section className="panel settingsForm">
          <h3>إعدادات {activeTab}</h3>
          <p>اضبط خيارات {activeTab} ثم اضغط حفظ التغييرات.</p>
          <hr />
          <div className="formGrid">
            <label>
              اسم النظام
              <input value={systemName} onChange={(event) => setSystemName(event.target.value)} />
            </label>
            <label>
              المنطقة الزمنية
              <select defaultValue="cairo">
                <option value="cairo">Africa/Cairo (GMT+3)</option>
              </select>
            </label>
            <label>
              العملة
              <select>
                <option>الجنيه المصري (ج.م)</option>
              </select>
            </label>
            <label>
              اللغة
              <select>
                <option>العربية</option>
                <option>English</option>
              </select>
            </label>
          </div>
          <div className="settingRow">
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
          </div>
          <div className="settingRow">
            <div>
              <b>تخصيص FIFO</b>
              <span>اختيار أقدم عنصر متاح تلقائيًا.</span>
            </div>
            <button onClick={() => setFifo(!fifo)} className={fifo ? "toggle on" : "toggle"}>
              <i />
            </button>
          </div>
          <footer>
            <button className="secondary" onClick={resetSettings}>إلغاء</button>
            <button
              className="primary"
              onClick={saveSettings}
            >
              حفظ التغييرات
            </button>
          </footer>
        </section>
      </div>
    </>
  );
}
