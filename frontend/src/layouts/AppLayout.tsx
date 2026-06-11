import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, Bot, BarChart3, AlertTriangle, Settings, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function AppLayout() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Invoices", path: "/invoices", icon: FileText },
    { label: "Agent", path: "/agent", icon: Bot },
    { label: "Analytics", path: "/analytics", icon: BarChart3 },
    { label: "DLQ", path: "/dlq", icon: AlertTriangle },
    ...(user?.role !== 'viewer' ? [{ label: "Settings", path: "/settings", icon: Settings }] : []),
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, 200), 500);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentNavItem = navItems.find(item => 
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  );
  const breadcrumb = currentNavItem ? currentNavItem.label : "Dashboard";

  const initials = user?.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <aside 
        style={{ width: isMobile ? undefined : sidebarWidth }}
        className={`relative flex flex-col border-r border-slate-200 bg-white text-slate-600 z-20 flex-shrink-0 ${isMobile ? 'w-16' : ''} ${!isResizing ? 'transition-all duration-300' : ''}`}
      >
        {!isMobile && (
          <div 
            onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
            className="absolute top-0 -right-2 w-4 h-full cursor-col-resize z-50 bg-transparent"
            title="Drag to resize"
          />
        )}
        
        <div className="flex h-16 items-center justify-center md:justify-start md:px-6 border-b border-slate-200">
          <Bot className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <span className="text-lg font-bold text-slate-900 tracking-tight hidden md:block ml-2 whitespace-nowrap overflow-hidden">CreditOps AI</span>
        </div>
        
        <nav className="flex-1 space-y-1 px-2 md:px-3 py-4 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-center md:justify-start rounded-md p-2 md:px-3 md:py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
                title={item.label}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="hidden md:block ml-3 truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-2 md:p-4">
          <button 
            onClick={() => logout()}
            className="flex w-full items-center justify-center md:justify-start rounded-md p-2 md:px-3 md:py-2 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="hidden md:block ml-3 truncate">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50 w-full">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-sm flex-shrink-0">
          <div className="text-sm md:text-base font-semibold text-slate-800">
            {breadcrumb}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold hover:bg-blue-200 transition-colors">
                  {initials}
                </div>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 overflow-hidden transform origin-top-right transition-all">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate mt-1">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button 
                      onClick={() => logout()}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-slate-50 transition-colors"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
