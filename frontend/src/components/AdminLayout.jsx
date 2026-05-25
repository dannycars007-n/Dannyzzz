import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Plus, MessageSquare, LogOut, ExternalLink, Settings } from "lucide-react";

export default function AdminLayout({ children, unread = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const links = [
    { to: "/admin", label: "Publicaciones", icon: LayoutGrid, testid: "admin-nav-listings" },
    { to: "/admin/new", label: "Nueva publicación", icon: Plus, testid: "admin-nav-new" },
    { to: "/admin/messages", label: "Mensajes", icon: MessageSquare, testid: "admin-nav-messages", badge: unread },
    { to: "/admin/settings", label: "Configuración", icon: Settings, testid: "admin-nav-settings" },
  ];

  return (
    <div className="App grain min-h-screen font-body">
      <header className="border-b border-white/10 bg-[#0b0b0d]/85 backdrop-blur-xl sticky top-0 z-40" data-testid="admin-header">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/admin" className="flex items-center gap-3">
            <img src="/logo.png" alt="DannyZCars" className="h-11 w-auto object-contain" />
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#ff3d00] font-bold hidden sm:block">
              Panel admin
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-zinc-300 hover:text-white hover:bg-white/5" data-testid="admin-view-site">
              <Link to="/" target="_blank">
                <ExternalLink className="w-4 h-4 mr-1" /> Ver sitio
              </Link>
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-400 px-3 border-l border-white/10">
              <span className="text-white">{user?.name || "Admin"}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={async () => { await logout(); navigate("/"); }}
              data-testid="admin-logout"
            >
              <LogOut className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <nav className="lg:sticky lg:top-24 self-start" data-testid="admin-sidebar">
          <div className="bg-[#131318] border border-white/10 rounded-lg p-2 flex lg:flex-col gap-1">
            {links.map((l) => {
              const active = location.pathname === l.to;
              const Icon = l.icon;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  data-testid={l.testid}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    active ? "bg-[#ff3d00] text-black font-semibold" : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{l.label}</span>
                  {l.badge ? (
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${active ? "bg-black/20 text-black" : "bg-[#ff3d00] text-black"}`}>
                      {l.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
