import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import api, { fileUrl, formatApiError } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, X, ImageIcon, Save, ArrowLeft } from "lucide-react";

const EMPTY = {
  title: "",
  description: "",
  price: "",
  currency: "MXN",
  category: "refacciones",
  subcategory: "",
  condition: "usado",
  location: "",
  brand: "",
  model: "",
  year: "",
  images: [],
  whatsapp: "",
  is_active: true,
};

export default function AdminListingForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/listings/${id}`).then((r) => {
      setForm({ ...EMPTY, ...r.data, year: r.data.year || "" });
    }).catch((e) => {
      toast.error(formatApiError(e.response?.data?.detail));
      navigate("/admin");
    }).finally(() => setLoading(false));
  }, [id, isEdit, navigate]);

  const updateField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newPaths = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        newPaths.push(data.path);
      } catch (e) {
        toast.error(`No se pudo subir ${file.name}: ${formatApiError(e.response?.data?.detail)}`);
      }
    }
    if (newPaths.length) {
      setForm((f) => ({ ...f, images: [...f.images, ...newPaths] }));
      toast.success(`${newPaths.length} imagen${newPaths.length === 1 ? "" : "es"} subida${newPaths.length === 1 ? "" : "s"}`);
    }
    setUploading(false);
  };

  const removeImage = (i) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price: parseFloat(form.price) || 0,
      year: form.year ? parseInt(form.year, 10) : null,
      subcategory: form.subcategory || null,
      brand: form.brand || null,
      model: form.model || null,
      whatsapp: form.whatsapp || null,
    };
    try {
      if (isEdit) {
        await api.put(`/listings/${id}`, payload);
        toast.success("Publicación actualizada");
      } else {
        await api.post("/listings", payload);
        toast.success("Publicación creada");
      }
      navigate("/admin");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLayout><div className="text-zinc-500 p-8" data-testid="form-loading">Cargando...</div></AdminLayout>;
  }

  const subcats = categories[form.category]?.subcategories || [];

  return (
    <AdminLayout>
      <button
        onClick={() => navigate("/admin")}
        className="text-sm text-zinc-400 hover:text-[#ff3d00] inline-flex items-center gap-1 mb-4"
        data-testid="form-back"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a publicaciones
      </button>
      <h1 className="font-display text-3xl font-bold text-white mb-2" data-testid="form-title">
        {isEdit ? "Editar publicación" : "Nueva publicación"}
      </h1>
      <p className="text-sm text-zinc-500 mb-8">Llena los datos del producto y sube imágenes.</p>

      <form onSubmit={submit} className="space-y-6" data-testid="listing-form">
        <div className="bg-[#131318] border border-white/10 rounded-lg p-6 space-y-5">
          <h2 className="font-display text-lg font-bold">Información básica</h2>

          <div>
            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Título *</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="bg-[#0b0b0d] border-white/10 text-white mt-1"
              placeholder="Ej. Rines deportivos Apex Black 18&quot; juego completo"
              data-testid="form-title-input"
            />
          </div>

          <div>
            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Descripción *</Label>
            <Textarea
              required
              rows={6}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="bg-[#0b0b0d] border-white/10 text-white mt-1"
              placeholder="Detalles, condición, compatibilidad, número de parte..."
              data-testid="form-description-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Categoría *</Label>
              <Select value={form.category} onValueChange={(v) => { updateField("category", v); updateField("subcategory", ""); }}>
                <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white mt-1" data-testid="form-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categories).map(([slug, c]) => (
                    <SelectItem key={slug} value={slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Subcategoría</Label>
              <Select value={form.subcategory || "none"} onValueChange={(v) => updateField("subcategory", v === "none" ? "" : v)}>
                <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white mt-1" data-testid="form-subcategory">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {subcats.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Condición *</Label>
              <Select value={form.condition} onValueChange={(v) => updateField("condition", v)}>
                <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white mt-1" data-testid="form-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo</SelectItem>
                  <SelectItem value="seminuevo">Seminuevo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Precio *</Label>
              <Input
                required type="number" min="0" step="0.01"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1"
                placeholder="0"
                data-testid="form-price"
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Moneda</Label>
              <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white mt-1" data-testid="form-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Ubicación</Label>
              <Input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1"
                placeholder="CDMX, GDL, MTY..."
                data-testid="form-location"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Marca</Label>
              <Input
                value={form.brand}
                onChange={(e) => updateField("brand", e.target.value)}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1"
                placeholder="Ford, BMW, Honda..."
                data-testid="form-brand"
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Modelo</Label>
              <Input
                value={form.model}
                onChange={(e) => updateField("model", e.target.value)}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1"
                placeholder="Mustang GT, Civic Type R..."
                data-testid="form-model"
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs uppercase tracking-wider">Año</Label>
              <Input
                type="number" min="1900" max="2099"
                value={form.year}
                onChange={(e) => updateField("year", e.target.value)}
                className="bg-[#0b0b0d] border-white/10 text-white mt-1"
                placeholder="2022"
                data-testid="form-year"
              />
            </div>
          </div>

          <div>
            <Label className="text-zinc-400 text-xs uppercase tracking-wider">WhatsApp de contacto</Label>
            <Input
              value={form.whatsapp}
              onChange={(e) => updateField("whatsapp", e.target.value)}
              className="bg-[#0b0b0d] border-white/10 text-white mt-1"
              placeholder="+52 55 1234 5678"
              data-testid="form-whatsapp"
            />
            <p className="text-xs text-zinc-500 mt-1">Si lo dejas vacío se usará el número del perfil admin.</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => updateField("is_active", v)}
              data-testid="form-active"
            />
            <Label className="text-sm text-zinc-300">Publicación activa (visible en el marketplace)</Label>
          </div>
        </div>

        {/* Images */}
        <div className="bg-[#131318] border border-white/10 rounded-lg p-6">
          <h2 className="font-display text-lg font-bold mb-4">Imágenes</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="image-grid">
            {form.images.map((p, i) => (
              <div key={p + i} className="relative aspect-square rounded-md overflow-hidden border border-white/10 group">
                <img src={fileUrl(p)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center"
                  data-testid={`image-remove-${i}`}
                >
                  <X className="w-4 h-4" />
                </button>
                {i === 0 && (
                  <div className="absolute bottom-1.5 left-1.5 bg-[#ff3d00] text-black text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                    Portada
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-md border-2 border-dashed border-white/15 hover:border-[#ff3d00]/60 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-[#ff3d00] transition-colors disabled:opacity-50"
              data-testid="image-upload-btn"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#ff3d00] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Subiendo...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Subir imagen</span>
                </>
              )}
            </button>
            {form.images.length === 0 && !uploading && (
              <div className="col-span-full text-xs text-zinc-500 text-center py-3 flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" /> Sube al menos una imagen (JPG, PNG, WEBP — máx 5MB)
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            hidden
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
            data-testid="image-file-input"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate("/admin")} className="text-zinc-300 hover:text-white" data-testid="form-cancel">
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="btn-accent h-11 px-6" data-testid="form-submit">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Publicar"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
}
