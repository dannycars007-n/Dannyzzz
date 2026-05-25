import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck, ArrowLeft } from "lucide-react";

export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(1); // 1: email, 2: questions + new pwd
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchQuestions = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password/questions", { email });
      if (!data.questions || data.questions.length === 0) {
        setError("No hay preguntas configuradas para esa cuenta. Contacta soporte.");
        return;
      }
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(""));
      setStep(2);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail, "No se pudo iniciar la recuperación"));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("Mínimo 8 caracteres"); return; }
    if (newPassword !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (answers.some((a) => !a.trim())) { setError("Responde todas las preguntas"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password/verify", {
        email, answers, new_password: newPassword,
      });
      if (data?.token) localStorage.setItem("dz_token", data.token);
      toast.success("Contraseña restablecida. ¡Bienvenido de vuelta!");
      await refresh();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail, "Respuestas incorrectas"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen App grain flex items-center justify-center px-4 py-12 font-body">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center mb-8" data-testid="forgot-brand">
          <img src="/logo.png" alt="DannyZCars" className="h-16 w-auto object-contain" />
        </Link>
        <div className="bg-[#131318] border border-white/10 rounded-xl p-8 login-glow" data-testid="forgot-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#ff3d00] font-bold mb-2">
            <KeyRound className="w-4 h-4" /> Recuperar contraseña
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">
            {step === 1 ? "¿Olvidaste tu contraseña?" : "Verifica tu identidad"}
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            {step === 1
              ? "Ingresa tu correo de administrador para mostrar tus preguntas de seguridad."
              : "Responde las preguntas que configuraste y elige una nueva contraseña."}
          </p>

          {step === 1 && (
            <form onSubmit={fetchQuestions} className="space-y-4" data-testid="forgot-step1">
              <div>
                <Label className="text-zinc-400 text-xs uppercase tracking-wider">Correo</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dannyzcars.com"
                  className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                  data-testid="forgot-email"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-md px-3 py-2" data-testid="forgot-error">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full h-11 btn-accent" data-testid="forgot-submit-email">
                {loading ? "Buscando..." : "Continuar"}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitReset} className="space-y-4" data-testid="forgot-step2">
              {questions.map((q, idx) => (
                <div key={idx}>
                  <Label className="text-zinc-300 text-sm flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#ff3d00] mt-0.5 shrink-0" />
                    <span>{q}</span>
                  </Label>
                  <Input
                    type="text"
                    required
                    value={answers[idx] || ""}
                    onChange={(e) => setAnswers((a) => a.map((x, i) => (i === idx ? e.target.value : x)))}
                    placeholder="Tu respuesta"
                    className="bg-[#0b0b0d] border-white/10 text-white mt-2 h-11"
                    data-testid={`forgot-answer-${idx}`}
                  />
                </div>
              ))}
              <div className="border-t border-white/10 pt-4">
                <Label className="text-zinc-400 text-xs uppercase tracking-wider">Nueva contraseña</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                  data-testid="forgot-new-pwd"
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-xs uppercase tracking-wider">Confirmar</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                  data-testid="forgot-confirm-pwd"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-md px-3 py-2" data-testid="forgot-error">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full h-11 btn-accent" data-testid="forgot-submit-reset">
                {loading ? "Verificando..." : "Restablecer contraseña"}
              </Button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(""); }}
                className="text-sm text-zinc-500 hover:text-[#ff3d00] flex items-center gap-1 w-full justify-center"
                data-testid="forgot-back-step1"
              >
                <ArrowLeft className="w-3 h-3" /> Usar otro correo
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/admin/login" className="text-sm text-zinc-500 hover:text-[#ff3d00]" data-testid="forgot-back-login">
              ← Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
