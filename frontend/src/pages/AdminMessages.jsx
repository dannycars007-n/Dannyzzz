import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Send, Trash2, MessageSquare, Mail, Phone, ExternalLink } from "lucide-react";

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export default function AdminMessages() {
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const fetchThreads = async () => {
    try {
      const { data } = await api.get("/admin/threads");
      setThreads(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchThreads(); }, []);

  useEffect(() => {
    if (!selectedId) { setActive(null); return; }
    api.get(`/admin/threads/${selectedId}`).then((r) => {
      setActive(r.data);
      setThreads((t) => t.map((x) => x.id === selectedId ? { ...x, unread_for_admin: false } : x));
    }).catch((e) => toast.error(formatApiError(e.response?.data?.detail)));
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    try {
      const { data } = await api.post(`/admin/threads/${selectedId}/reply`, { message: reply });
      setActive((a) => a ? { ...a, messages: [...a.messages, data.message] } : a);
      setReply("");
      await fetchThreads();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  const deleteThread = async (id) => {
    try {
      await api.delete(`/admin/threads/${id}`);
      toast.success("Conversación eliminada");
      if (selectedId === id) { setSelectedId(null); setActive(null); }
      await fetchThreads();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const unreadCount = threads.filter((t) => t.unread_for_admin).length;

  return (
    <AdminLayout unread={unreadCount}>
      <h1 className="font-display text-3xl font-bold text-white mb-1" data-testid="messages-title">Mensajes</h1>
      <p className="text-sm text-zinc-500 mb-6">Conversaciones con compradores interesados.</p>

      <div className="bg-[#131318] border border-white/10 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-[600px]" data-testid="messages-layout">
        {/* Threads list */}
        <div className="border-r border-white/10 max-h-[700px] overflow-y-auto" data-testid="threads-list">
          {loading ? (
            <div className="p-6 text-zinc-500 text-sm">Cargando...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center" data-testid="threads-empty">
              <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Aún no hay mensajes.</p>
            </div>
          ) : (
            threads.map((t) => {
              const last = t.messages?.[t.messages.length - 1];
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 border-b border-white/5 transition-colors ${selectedId === t.id ? "bg-[#ff3d00]/10" : "hover:bg-white/[0.02]"}`}
                  data-testid={`thread-item-${t.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{t.buyer_name}</span>
                        {t.unread_for_admin && <span className="w-2 h-2 bg-[#ff3d00] rounded-full shrink-0" />}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mt-0.5">{t.listing_title || "Mensaje general"}</div>
                      <div className="text-xs text-zinc-400 line-clamp-1 mt-1">{last?.text}</div>
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0">{timeAgo(t.updated_at)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Active conversation */}
        <div className="flex flex-col" data-testid="active-thread">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Selecciona una conversación
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 p-4 flex items-start justify-between gap-3" data-testid="thread-header">
                <div className="min-w-0">
                  <div className="font-display font-bold text-white truncate">{active.buyer_name}</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-3 flex-wrap mt-1">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {active.buyer_email}</span>
                    {active.buyer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {active.buyer_phone}</span>}
                  </div>
                  {active.listing_id && active.listing_title && (
                    <Link
                      to={`/listing/${active.listing_id}`}
                      target="_blank"
                      className="text-xs text-[#ff3d00] hover:underline inline-flex items-center gap-1 mt-1"
                      data-testid="thread-listing-link"
                    >
                      Sobre: {active.listing_title} <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-zinc-400 hover:text-red-400" data-testid="thread-delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#131318] border-white/10 text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent border-white/20 hover:bg-white/5 text-white">Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteThread(active.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]" data-testid="thread-messages">
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.from === "admin" ? "bg-[#ff3d00] text-black" : "bg-[#0b0b0d] border border-white/10 text-zinc-200"}`}>
                      <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                      <div className={`text-[10px] mt-1 ${m.from === "admin" ? "text-black/60" : "text-zinc-500"}`}>{timeAgo(m.at)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={sendReply} className="border-t border-white/10 p-3 flex gap-2" data-testid="reply-form">
                <Textarea
                  rows={2}
                  required
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  className="bg-[#0b0b0d] border-white/10 text-white resize-none"
                  data-testid="reply-input"
                />
                <Button type="submit" disabled={sending} className="btn-accent self-end" data-testid="reply-submit">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
