import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { fileUrl, formatApiError } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MessageSquare, Phone, ChevronLeft, ChevronRight, MapPin, ShieldCheck,
  Calendar, Tag, ArrowLeft,
} from "lucide-react";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1778923096146-62bb36b04a87?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000";

function formatPrice(price, currency = "MXN") {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `$${price}`;
  }
}

const CONDITION_LABELS = { nuevo: "Nuevo", seminuevo: "Seminuevo", usado: "Usado" };

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/listings/${id}`).then((r) => {
      setListing(r.data);
      setForm((f) => ({ ...f, message: `Hola, me interesa "${r.data.title}". ¿Sigue disponible?` }));
    }).catch(() => {
      setListing(false);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="App grain font-body">
        <Navbar />
        <div className="max-w-[1400px] mx-auto px-4 py-12 text-zinc-500" data-testid="detail-loading">
          Cargando publicación...
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="App grain font-body">
        <Navbar />
        <div className="max-w-[1400px] mx-auto px-4 py-20 text-center" data-testid="detail-not-found">
          <h1 className="font-display text-3xl font-bold">Publicación no encontrada</h1>
          <Button asChild className="btn-accent mt-6"><Link to="/browse">Volver al marketplace</Link></Button>
        </div>
      </div>
    );
  }

  const images = listing.images && listing.images.length > 0 ? listing.images : [null];
  const currentImg = images[imgIdx] ? fileUrl(images[imgIdx]) : PLACEHOLDER;

  const next = () => setImgIdx((i) => (i + 1) % images.length);
  const prev = () => setImgIdx((i) => (i - 1 + images.length) % images.length);

  const submitMessage = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/messages", {
        listing_id: listing.id,
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        message: form.message,
      });
      toast.success("Mensaje enviado. Te contactaremos pronto.");
      setContactOpen(false);
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const waPhone = (listing.whatsapp || "").replace(/[^\d+]/g, "");
  const waLink = waPhone
    ? `https://wa.me/${waPhone.replace("+", "")}?text=${encodeURIComponent(`Hola, vi tu publicación "${listing.title}" en DannyZCars y me interesa.`)}`
    : null;

  return (
    <div className="App grain font-body">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-zinc-400 hover:text-[#ff3d00] inline-flex items-center gap-1 mb-6"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Gallery */}
          <div className="lg:col-span-8" data-testid="gallery">
            <div className="relative aspect-[4/3] bg-[#131318] rounded-lg overflow-hidden border border-white/10">
              <img
                src={currentImg}
                alt={listing.title}
                className="w-full h-full object-contain"
                data-testid="gallery-main-image"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff3d00] text-white flex items-center justify-center transition-colors"
                    data-testid="gallery-prev"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff3d00] text-white flex items-center justify-center transition-colors"
                    data-testid="gallery-next"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                    {imgIdx + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar" data-testid="gallery-thumbs">
                {images.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 ${imgIdx === i ? "border-[#ff3d00]" : "border-white/10"}`}
                  >
                    <img src={p ? fileUrl(p) : PLACEHOLDER} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mt-8">
              <Tabs defaultValue="desc" className="w-full">
                <TabsList className="bg-[#131318] border border-white/10">
                  <TabsTrigger value="desc" data-testid="tab-description">Descripción</TabsTrigger>
                  <TabsTrigger value="specs" data-testid="tab-specs">Detalles</TabsTrigger>
                </TabsList>
                <TabsContent value="desc" className="mt-4">
                  <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap" data-testid="listing-description">
                    {listing.description || "Sin descripción."}
                  </div>
                </TabsContent>
                <TabsContent value="specs" className="mt-4">
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Categoría", listing.category],
                      ["Subcategoría", listing.subcategory],
                      ["Marca", listing.brand],
                      ["Modelo", listing.model],
                      ["Año", listing.year],
                      ["Condición", CONDITION_LABELS[listing.condition]],
                      ["Ubicación", listing.location],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="border-b border-white/5 pb-2">
                        <dt className="text-zinc-500 text-xs uppercase tracking-wider">{k}</dt>
                        <dd className="text-white mt-1 capitalize">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="bg-[#131318] border border-white/10 rounded-lg p-6 lg:sticky lg:top-24" data-testid="sidebar">
              <div className="text-xs uppercase tracking-[0.2em] text-[#ff3d00] font-bold mb-2">
                {listing.category}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight" data-testid="listing-title">
                {listing.title}
              </h1>
              <div className="mt-4 font-display text-3xl sm:text-4xl font-bold text-[#ff3d00]" data-testid="listing-price">
                {formatPrice(listing.price, listing.currency)}
              </div>

              <div className="mt-5 space-y-2 text-sm text-zinc-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#ff3d00]" />
                  {CONDITION_LABELS[listing.condition] || listing.condition}
                </div>
                {listing.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#ff3d00]" />
                    {listing.location}
                  </div>
                )}
                {listing.year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#ff3d00]" />
                    {listing.year}
                  </div>
                )}
                {(listing.brand || listing.model) && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#ff3d00]" />
                    {[listing.brand, listing.model].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 my-5"></div>

              <div className="space-y-2">
                {waLink ? (
                  <Button asChild className="w-full h-12 bg-[#25D366] hover:bg-[#1ebe57] text-black font-bold" data-testid="whatsapp-btn">
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                      <Phone className="w-4 h-4 mr-2" /> WhatsApp
                    </a>
                  </Button>
                ) : null}

                <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full h-12 btn-accent" data-testid="contact-btn">
                      <MessageSquare className="w-4 h-4 mr-2" /> Enviar mensaje
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#131318] border-white/10 text-white" data-testid="contact-dialog">
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl">Contactar al vendedor</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitMessage} className="space-y-4">
                      <Input
                        required
                        placeholder="Tu nombre"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="bg-[#0b0b0d] border-white/10 text-white"
                        data-testid="contact-name"
                      />
                      <Input
                        required
                        type="email"
                        placeholder="Tu correo"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="bg-[#0b0b0d] border-white/10 text-white"
                        data-testid="contact-email"
                      />
                      <Input
                        placeholder="Tu teléfono (opcional)"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="bg-[#0b0b0d] border-white/10 text-white"
                        data-testid="contact-phone"
                      />
                      <Textarea
                        required
                        rows={4}
                        placeholder="Tu mensaje"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="bg-[#0b0b0d] border-white/10 text-white"
                        data-testid="contact-message"
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={submitting} className="btn-accent w-full h-11" data-testid="contact-submit">
                          {submitting ? "Enviando..." : "Enviar mensaje"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <p className="mt-5 text-xs text-zinc-500 leading-relaxed">
                Al contactar aceptas que tu información sea utilizada únicamente para responder esta solicitud.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
