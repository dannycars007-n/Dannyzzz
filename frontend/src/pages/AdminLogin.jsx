import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === "admin") navigate("/admin", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate("/admin", { replace: true });
    else setError(res.error);
  };

  return (
    <div className="min-h-screen App grain flex items-center justify-center px-4 py-12 font-body">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center mb-8 group" data-testid="login-brand">
          <img src="/logo.png" alt="DannyZCars" className="h-16 w-auto object-contain" />
        </Link>
        <div className="bg-[#131318] border border-white/10 rounded-xl p-8 login-glow" data-testid="login-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#ff3d00] font-bold mb-2">
            <ShieldCheck className="w-4 h-4" /> Acceso admin
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">Inicia sesión</h1>
          <p className="text-sm text-zinc-500 mb-6">Solo el administrador puede publicar y gestionar el marketplace.</p>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-wider">Correo</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dannyzcars.com"
                className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-zinc-400 text-xs uppercase tracking-wider">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                data-testid="login-password"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-md px-3 py-2" data-testid="login-error">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 btn-accent" data-testid="login-submit">
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2">
            <Link to="/admin/forgot" className="text-sm text-[#ff3d00] hover:text-[#ff5722] font-medium" data-testid="login-forgot">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300" data-testid="login-back">
              ← Volver al marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
