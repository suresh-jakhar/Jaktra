import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, Bot, BarChart3, AlertTriangle, Settings, LogOut } from "lucide-react";

export function AppLayout() {
  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Invoices", path: "/invoices", icon: FileText },
    { label: "Agent", path: "/agent", icon: Bot },
    { label: "Analytics", path: "/analytics", icon: BarChart3 },
    { label: "DLQ", path: "/dlq", icon: AlertTriangle },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-slate-900 text-slate-300">
        <div className="flex h-16 items-center px-6 border-b border-slate-800">
          <Bot className="mr-2 h-6 w-6 text-blue-500" />
          <span className="text-lg font-bold text-white tracking-tight">CreditOps AI</span>
        </div>
        
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto flex flex-col bg-slate-50 dark:bg-slate-950">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {/* Breadcrumb placeholder */}
            Dashboard
          </div>
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold dark:bg-blue-900 dark:text-blue-300">
              JS
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
