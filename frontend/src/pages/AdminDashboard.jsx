import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { fileUrl, formatApiError } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Search, Package, MessageSquare, Eye, EyeOff } from "lucide-react";

function formatPrice(p, c = "MXN") {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: c || "MXN", maximumFractionDigits: 0 }).format(p);
  } catch { return `$${p}`; }
}

export default function AdminDashboard() {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        api.get("/listings?limit=200"),
        api.get("/admin/stats"),
      ]);
      setListings(l.data);
      setStats(s.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = listings.filter((l) =>
    !q || (l.title + " " + l.description + " " + (l.brand || "") + " " + (l.model || ""))
      .toLowerCase().includes(q.toLowerCase())
  );

  const remove = async (id) => {
    try {
      await api.delete(`/listings/${id}`);
      toast.success("Publicación eliminada");
      fetchAll();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const toggleActive = async (l) => {
    try {
      await api.put(`/listings/${l.id}`, { ...l, is_active: !l.is_active });
      toast.success(l.is_active ? "Publicación pausada" : "Publicación activada");
      fetchAll();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <AdminLayout unread={stats.unread_threads || 0}>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8" data-testid="admin-stats">
        {[
          { label: "Total publicaciones", value: stats.total_listings ?? 0, icon: Package },
          { label: "Activas", value: stats.active_listings ?? 0, icon: Eye },
          { label: "Conversaciones", value: stats.total_threads ?? 0, icon: MessageSquare },
          { label: "Mensajes nuevos", value: stats.unread_threads ?? 0, icon: MessageSquare, accent: true },
        ].map((s) => (
          <div key={s.label} className={`bg-[#131318] border ${s.accent && s.value > 0 ? "border-[#ff3d00]/50" : "border-white/10"} rounded-lg p-4`}>
            <div className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <s.icon className="w-3.5 h-3.5" /> {s.label}
            </div>
            <div className={`mt-2 font-display text-3xl font-bold ${s.accent && s.value > 0 ? "text-[#ff3d00]" : "text-white"}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white" data-testid="admin-title">Publicaciones</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestiona el inventario del marketplace.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar en publicaciones..."
              className="pl-9 bg-[#131318] border-white/10 text-white"
              data-testid="admin-search"
            />
          </div>
          <Button asChild className="btn-accent" data-testid="admin-new-btn">
            <Link to="/admin/new"><Plus className="w-4 h-4 mr-1" /> Nueva</Link>
          </Button>
        </div>
      </div>

      <div className="bg-[#131318] border border-white/10 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500" data-testid="admin-loading">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center" data-testid="admin-empty">
            <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <h3 className="font-display text-xl font-bold mb-1">Aún no hay publicaciones</h3>
            <p className="text-zinc-500 mb-5 text-sm">Crea tu primera publicación para empezar.</p>
            <Button asChild className="btn-accent" data-testid="admin-empty-cta">
              <Link to="/admin/new"><Plus className="w-4 h-4 mr-1" /> Crear publicación</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-listings-table">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500 bg-[#0b0b0d]/50">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-white/5 hover:bg-white/[0.02]" data-testid={`admin-row-${l.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-md bg-[#0b0b0d] overflow-hidden border border-white/10 shrink-0">
                          {l.images && l.images[0] ? (
                            <img src={fileUrl(l.images[0])} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700"><Package className="w-5 h-5" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate max-w-[280px]">{l.title}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-[280px]">{[l.brand, l.model].filter(Boolean).join(" · ")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-300">{l.category}{l.subcategory ? ` · ${l.subcategory}` : ""}</td>
                    <td className="px-4 py-3 font-display font-bold text-white">{formatPrice(l.price, l.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${l.is_active ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"}`}>
                        {l.is_active ? "Activa" : "Pausada"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(l)} className="text-zinc-400 hover:text-white" data-testid={`admin-toggle-${l.id}`}>
                          {l.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button asChild size="icon" variant="ghost" className="text-zinc-400 hover:text-white" data-testid={`admin-edit-${l.id}`}>
                          <Link to={`/admin/edit/${l.id}`}><Pencil className="w-4 h-4" /></Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-zinc-400 hover:text-red-400" data-testid={`admin-delete-${l.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#131318] border-white/10 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                Esta acción no se puede deshacer. La publicación "{l.title}" será eliminada permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-transparent border-white/20 hover:bg-white/5 text-white">Cancelar</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => remove(l.id)} data-testid={`admin-confirm-delete-${l.id}`}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
