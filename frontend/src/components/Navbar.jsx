import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Menu, X, Shield, LogOut } from "lucide-react";

export default function Navbar({ defaultQuery = "" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(defaultQuery);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQ(defaultQuery);
  }, [defaultQuery]);

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    navigate(`/browse${params.toString() ? "?" + params.toString() : ""}`);
    setOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-50 bg-[#0b0b0d]/85 backdrop-blur-xl border-b border-white/10"
      data-testid="navbar"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-3 sm:gap-6">
        <Link to="/" className="flex items-center gap-2 group shrink-0" data-testid="brand-link">
          <img
            src="/logo.png"
            alt="DannyZCars"
            className="h-11 sm:h-12 w-auto object-contain"
          />
        </Link>

        <form
          onSubmit={submit}
          className="flex-1 max-w-2xl"
          data-testid="navbar-search-form"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar refacciones, rines, autos..."
              className="pl-10 h-11 bg-[#18181f] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-[#ff3d00] focus-visible:ring-2 focus-visible:border-[#ff3d00]"
              data-testid="navbar-search-input"
            />
          </div>
        </form>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { to: "/browse", label: "Explorar" },
            { to: "/browse?category=refacciones", label: "Refacciones" },
            { to: "/browse?category=rines", label: "Rines" },
            { to: "/browse?category=autos", label: "Autos" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
              className={`px-3 py-2 rounded-md text-sm font-medium hover:text-white hover:bg-white/5 transition-colors ${
                location.pathname + location.search === l.to ? "text-white" : "text-zinc-400"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user && user.role === "admin" ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex text-zinc-300 hover:text-white hover:bg-white/5"
                data-testid="nav-admin-btn"
              >
                <Link to="/admin">
                  <Shield className="w-4 h-4 mr-1" /> Admin
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
                className="text-zinc-400 hover:text-white"
                title="Cerrar sesión"
                data-testid="nav-logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-zinc-300 hover:text-white hover:bg-white/5"
              data-testid="nav-login-btn"
            >
              <Link to="/admin/login">
                <Shield className="w-4 h-4 mr-1" /> Admin
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-zinc-300"
            onClick={() => setOpen((v) => !v)}
            data-testid="nav-menu-toggle"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0b0b0d]/95 backdrop-blur-xl" data-testid="mobile-menu">
          <div className="px-4 py-3 flex flex-col gap-1">
            {[
              { to: "/browse", label: "Explorar" },
              { to: "/browse?category=refacciones", label: "Refacciones" },
              { to: "/browse?category=rines", label: "Rines" },
              { to: "/browse?category=autos", label: "Autos" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-white/5"
                data-testid={`mobile-nav-${l.label.toLowerCase()}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
