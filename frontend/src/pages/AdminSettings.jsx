import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, ShieldCheck, Save, Plus, Trash2 } from "lucide-react";

const DEFAULT_QUESTION_TEMPLATES = [
  "¿Cuál fue el nombre de tu primer perro?",
  "¿Dónde naciste?",
  "¿Cuál es el nombre de tu mamá?",
  "¿Cuál es el modelo de tu primer auto?",
  "¿Cuál es tu comida favorita?",
];

export default function AdminSettings() {
  const { user, refresh } = useAuth();

  // Profile
  const [profile, setProfile] = useState({ email: "", name: "", whatsapp: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  // Security questions
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [savingQ, setSavingQ] = useState(false);

  useEffect(() => {
    if (user) setProfile({ email: user.email || "", name: user.name || "", whatsapp: user.whatsapp || "" });
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/security-questions");
        // data = [{question, has_answer}]
        setQuestions(
          data.length
            ? data.map((q) => ({ question: q.question, answer: "", has_answer: q.has_answer }))
            : [
                { question: DEFAULT_QUESTION_TEMPLATES[0], answer: "", has_answer: false },
                { question: DEFAULT_QUESTION_TEMPLATES[1], answer: "", has_answer: false },
              ]
        );
      } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail, "No se pudieron cargar las preguntas"));
      } finally {
        setLoadingQ(false);
      }
    })();
  }, []);

  const submitProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put("/admin/profile", profile);
      toast.success("Perfil actualizado");
      await refresh();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail, "Error al guardar perfil"));
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (pwd.new_password.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (pwd.new_password !== pwd.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSavingPwd(true);
    try {
      const { data } = await api.put("/admin/password", {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      });
      if (data?.token) localStorage.setItem("dz_token", data.token);
      toast.success("Contraseña actualizada");
      setPwd({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail, "Error al cambiar contraseña"));
    } finally {
      setSavingPwd(false);
    }
  };

  const updateQ = (idx, field, value) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, { question: "", answer: "", has_answer: false }]);
  };

  const removeQuestion = (idx) => {
    setQuestions((qs) => (qs.length <= 2 ? qs : qs.filter((_, i) => i !== idx)));
  };

  const submitQuestions = async (e) => {
    e.preventDefault();
    for (const q of questions) {
      if (!q.question.trim()) { toast.error("Hay preguntas vacías"); return; }
      if (!q.has_answer && !q.answer.trim()) {
        toast.error(`Falta la respuesta para: "${q.question}"`);
        return;
      }
    }
    setSavingQ(true);
    try {
      const payload = {
        questions: questions.map((q) => ({
          question: q.question.trim(),
          // Only send answer if user typed something new. Empty means keep existing.
          answer: q.answer.trim() ? q.answer.trim() : null,
        })),
      };
      await api.put("/admin/security-questions", payload);
      toast.success("Preguntas de seguridad guardadas");
      // Clear answer fields, mark all as having answers
      setQuestions((qs) => qs.map((q) => ({ ...q, answer: "", has_answer: true })));
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail, "Error al guardar preguntas"));
    } finally {
      setSavingQ(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-8" data-testid="admin-settings">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Configuración</h1>
          <p className="text-sm text-zinc-500 mt-1">Administra tus credenciales y preguntas de recuperación.</p>
        </div>

        {/* Profile */}
        <section className="bg-[#131318] border border-white/10 rounded-xl p-6" data-testid="settings-profile">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-[#ff3d00]" />
            <h2 className="font-display text-xl font-bold">Perfil</h2>
          </div>
          <form onSubmit={submitProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Nombre</Label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                data-testid="settings-name"
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Correo (usuario)</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                data-testid="settings-email"
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">WhatsApp</Label>
              <Input
                value={profile.whatsapp}
                onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                placeholder="+52..."
                className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                data-testid="settings-whatsapp"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={savingProfile} className="btn-accent h-11" data-testid="settings-save-profile">
                <Save className="w-4 h-4 mr-2" /> {savingProfile ? "Guardando..." : "Guardar perfil"}
              </Button>
            </div>
          </form>
        </section>

        {/* Password */}
        <section className="bg-[#131318] border border-white/10 rounded-xl p-6" data-testid="settings-password">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-5 h-5 text-[#ff3d00]" />
            <h2 className="font-display text-xl font-bold">Cambiar contraseña</h2>
          </div>
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Contraseña actual</Label>
              <Input
                type="password"
                required
                value={pwd.current_password}
                onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                data-testid="settings-current-pwd"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-400 text-xs uppercase tracking-wider">Nueva contraseña</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={pwd.new_password}
                  onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                  className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                  data-testid="settings-new-pwd"
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-xs uppercase tracking-wider">Confirmar</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  className="bg-[#0b0b0d] border-white/10 text-white mt-1 h-11"
                  data-testid="settings-confirm-pwd"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPwd} className="btn-accent h-11" data-testid="settings-save-pwd">
                <Save className="w-4 h-4 mr-2" /> {savingPwd ? "Guardando..." : "Actualizar contraseña"}
              </Button>
            </div>
          </form>
        </section>

        {/* Security questions */}
        <section className="bg-[#131318] border border-white/10 rounded-xl p-6" data-testid="settings-security">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-[#ff3d00]" />
            <h2 className="font-display text-xl font-bold">Preguntas de seguridad</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-5">
            Si olvidas tu contraseña, podrás recuperarla respondiendo estas preguntas. Mínimo 2.
          </p>
          {loadingQ ? (
            <div className="text-zinc-500 text-sm">Cargando...</div>
          ) : (
            <form onSubmit={submitQuestions} className="space-y-4">
              {questions.map((q, idx) => (
                <div key={idx} className="bg-[#0b0b0d] border border-white/5 rounded-lg p-4 space-y-3" data-testid={`security-q-${idx}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Label className="text-zinc-400 text-xs uppercase tracking-wider">Pregunta {idx + 1}</Label>
                      <Input
                        value={q.question}
                        onChange={(e) => updateQ(idx, "question", e.target.value)}
                        placeholder="Ej. ¿Cuál fue el nombre de tu primer perro?"
                        className="bg-[#131318] border-white/10 text-white mt-1 h-10"
                        data-testid={`security-q-input-${idx}`}
                      />
                    </div>
                    {questions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx)}
                        className="mt-6 text-zinc-500 hover:text-red-400"
                        title="Eliminar"
                        data-testid={`security-q-remove-${idx}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs uppercase tracking-wider">
                      Respuesta {q.has_answer && <span className="text-zinc-600 normal-case ml-1">(dejar vacío para mantener la actual)</span>}
                    </Label>
                    <Input
                      type="text"
                      value={q.answer}
                      onChange={(e) => updateQ(idx, "answer", e.target.value)}
                      placeholder={q.has_answer ? "••••••• (guardada)" : "Tu respuesta"}
                      className="bg-[#131318] border-white/10 text-white mt-1 h-10"
                      data-testid={`security-a-input-${idx}`}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addQuestion}
                  className="h-10 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  data-testid="security-add"
                >
                  <Plus className="w-4 h-4 mr-2" /> Agregar pregunta
                </Button>
                <Button type="submit" disabled={savingQ} className="btn-accent h-11" data-testid="security-save">
                  <Save className="w-4 h-4 mr-2" /> {savingQ ? "Guardando..." : "Guardar preguntas"}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
