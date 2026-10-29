"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Utensils,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  CreditCard,
  History,
  Bell,
  UserCog,
  Briefcase,
  Receipt,
  Pill,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingCart, label: "POS", href: "/dashboard/pos" },
  { icon: Pill, label: "Medical/Pharmacy", href: "/dashboard/pharmacy" },
  { icon: Package, label: "Medicines Catalog", href: "/dashboard/inventory" },
  { icon: History, label: "Sales", href: "/dashboard/orders" },
  { icon: Users, label: "Customers", href: "/dashboard/customers", moduleId: "CRM_LOYALTY" },
  { icon: UserCog, label: "Staff", href: "/dashboard/users" },
  { icon: Receipt, label: "Expenses", href: "/dashboard/expenses" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports", moduleId: "ANALYTICS_AI" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    axios.get("/api/auth/me").then(res => setUser(res.data)).catch(() => { });
  }, []);

  // RBAC Guard: Redirect users to their allowed screens based on role
  useEffect(() => {
    if (user) {
      if (user.role === "CASHIER") {
        if (pathname !== "/dashboard/pos") {
          router.push("/dashboard/pos");
          toast.error("Cashier role is restricted to POS interface only.");
        }
      } else if (user.role === "HR_STAFF") {
        if (pathname !== "/dashboard/users") {
          router.push("/dashboard/users");
          toast.error("HR Staff is restricted to Staff management only.");
        }
      } else if (user.role === "KITCHEN_STAFF") {
        if (pathname !== "/dashboard/kitchen") {
          router.push("/dashboard/kitchen");
          toast.error("Kitchen Staff is restricted to KDS only.");
        }
      } else if (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_MANAGER") {
        if (pathname !== "/dashboard/pos" && pathname !== "/dashboard") {
          router.push("/dashboard/pos");
        }
      }
    }
  }, [user, pathname, router]);

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      toast.success("Logged out successfully");
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden">
      {/* Impersonation Banner */}
      {user?.isImpersonated && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 text-white px-4 py-1 flex items-center justify-between text-xs font-bold shadow-sm z-[100] border-b border-purple-400/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Super Admin Impersonation</span>
            <span>Viewing <strong>{user?.tenant?.name || "Business"}</strong> Portal</span>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await axios.post("/api/admin/impersonate/exit");
                window.location.href = "/tenants";
              } catch {
                window.location.href = "/tenants";
              }
            }}
            className="bg-white text-purple-900 hover:bg-purple-50 font-black h-6 px-2.5 text-[11px] rounded-md shadow-sm"
          >
            Exit & Return to SuperAdmin
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out z-50 lg:static lg:translate-x-0 relative",
          isSidebarOpen ? "w-64" : "w-20",
          isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Floating Desktop Sidebar Collapse/Expand Pill */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          className="hidden lg:flex absolute -right-3 top-3.5 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all z-50 cursor-pointer"
        >
          {isSidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className={cn("h-14 flex items-center justify-between border-b border-slate-100 shrink-0", isSidebarOpen ? "px-5" : "px-3 justify-center")}>
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-100">
                <Store className="w-4 h-4" />
              </div>
              {(isSidebarOpen || isMobileOpen) && (
                <span className="ml-2.5 font-black text-xs text-slate-900 break-words leading-tight uppercase line-clamp-2">
                  {user?.tenant?.name || "LINCOZ POS"}
                </span>
              )}
            </div>
            {/* Mobile Close Button inside Sidebar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
            {sidebarItems.filter(item => {
              // 1. Core items always shown to everyone (Dashboard)
              if (item.label === "Dashboard") return true;

              if (!user) return false;
              
              // RBAC Links Filtering based on Role
              if (user.role === "CASHIER") {
                return item.label === "POS" || item.label === "Point of Sale";
              }
              if (user.role === "HR_STAFF") {
                return item.label === "Staff";
              }
              if (user.role === "KITCHEN_STAFF") {
                return item.label === "Kitchen KDS";
              }

              // Tenant Admin check
              if (user.role === "TENANT_ADMIN" || user.role === "SUPER_ADMIN" || user.role === "BRANCH_MANAGER") {
                if (!item.moduleId) return true;
                const tenantModules = user?.tenant?.modules || [];
                const matchModules = Array.isArray(item.moduleId) ? item.moduleId : [item.moduleId];
                return tenantModules.some((tm: any) => {
                  const mName = typeof tm === "string" ? tm : (tm.module?.name || tm.name || tm.code || tm.moduleId || "");
                  return matchModules.includes(mName);
                });
              }
            }).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                  <div className={cn(
                    "flex items-center px-3 py-3 rounded-xl transition-all group",
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}>
                    <item.icon className={cn(
                      "w-6 h-6 shrink-0",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                    )} />
                    {(isSidebarOpen || isMobileOpen) && (
                      <span className="ml-3 font-semibold">{item.label}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 space-y-2">
            <Button
              variant="ghost"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className={cn(
                "hidden lg:flex w-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl",
                isSidebarOpen ? "justify-start" : "justify-center px-0"
              )}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5 shrink-0" /> : <PanelLeftOpen className="w-5 h-5 shrink-0" />}
              {isSidebarOpen && <span className="ml-3 font-semibold text-sm">Collapse Sidebar</span>}
            </Button>

            <Button
              variant="ghost"
              onClick={handleLogout}
              className={cn(
                "w-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl mb-2",
                (isSidebarOpen || isMobileOpen) ? "justify-start" : "justify-center px-0"
              )}
            >
              <LogOut className="w-6 h-6 shrink-0" />
              {(isSidebarOpen || isMobileOpen) && <span className="ml-3 font-semibold">Logout</span>}
            </Button>
            {(isSidebarOpen || isMobileOpen) && (
              <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Powered by</p>
                <p className="text-[12px] font-bold text-blue-600 text-center mt-0.5 truncate uppercase">Lincoz Tech</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile Toggle */}
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="lg:hidden h-8 w-8 text-slate-500 rounded-lg hover:bg-slate-50">
              <Menu className="w-5 h-5" />
            </Button>

            {/* Desktop Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              className="hidden lg:flex h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></div>
              Live
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 relative rounded-lg">
              <Bell className="w-4 h-4" />
            </Button>
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {user?.name?.charAt(0) || "U"}
            </div>
          </div>
        </header>

        <main className={cn(
          "flex-1 bg-[#f8fafc]",
          pathname === "/dashboard/pos" ? "overflow-hidden p-3 sm:p-4 flex flex-col" : "overflow-y-auto p-4 sm:p-8"
        )}>
          {children}
        </main>
      </div>
    </div>
  </div>
  );
}

