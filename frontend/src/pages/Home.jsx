import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import CategoryChips from "@/components/CategoryChips";
import ListingCard from "@/components/ListingCard";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const HERO_BG =
  "https://images.unsplash.com/photo-1668037069509-ba4c569475b1?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000";

const SECTIONS = [
  { slug: "refacciones", num: "01", title: "Piezas que marcan la diferencia", desc: "Motor, suspensión, frenos, transmisión, carrocería, sistema eléctrico y más." },
  { slug: "rines", num: "02", title: "Estilo sobre ruedas", desc: "Rines deportivos, réplica y forjados. Diseño, ligereza y resistencia." },
  { slug: "autos", num: "03", title: "Autos listos para rodar", desc: "Vehículos seminuevos revisados pieza por pieza. Entrega inmediata." },
];

export default function Home() {
  const [bySection, setBySection] = useState({});

  useEffect(() => {
    (async () => {
      const results = await Promise.all(
        SECTIONS.map((s) => api.get(`/listings?category=${s.slug}&limit=8`).then((r) => [s.slug, r.data]).catch(() => [s.slug, []]))
      );
      setBySection(Object.fromEntries(results));
    })();
  }, []);

  return (
    <div className="App grain font-body">
      <Navbar />

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        data-testid="hero-section"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0d]/60 via-[#0b0b0d]/80 to-[#0b0b0d]" aria-hidden />
        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-32 lg:py-40">
          <div className="mb-6" data-testid="hero-eyebrow">
            <img
              src="/logo.png"
              alt="DannyZCars"
              className="h-24 sm:h-32 lg:h-40 xl:h-48 w-auto object-contain drop-shadow-[0_0_40px_rgba(255,61,0,0.45)]"
            />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tighter text-white max-w-4xl leading-[0.95] text-glow" data-testid="hero-title">
            Refacciones, rines y autos. <br />
            <span className="text-[#ff3d00]">Listos para rodar.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed" data-testid="hero-desc">
            Encuentra piezas y vehículos seleccionados publicados directamente por DannyZ. Contacta por WhatsApp o mensaje interno.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild className="btn-accent h-12 px-6 text-sm font-bold" data-testid="hero-cta-browse">
              <Link to="/browse">
                Explorar catálogo <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 px-6 text-sm border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white" data-testid="hero-cta-categories">
              <Link to="/browse?category=refacciones">Ver refacciones</Link>
            </Button>
          </div>
        </div>
      </section>

      <CategoryChips />

      {/* Section blocks */}
      {SECTIONS.map((s) => {
        const items = bySection[s.slug] || [];
        return (
          <section
            key={s.slug}
            id={s.slug}
            className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20"
            data-testid={`section-${s.slug}`}
          >
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[#ff3d00] font-bold mb-3">
                  {s.num} / {s.slug.toUpperCase()}
                </div>
                <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white max-w-2xl leading-[1.05]">
                  {s.title}.
                </h2>
                <p className="text-zinc-400 mt-4 max-w-xl">{s.desc}</p>
              </div>
              <Link
                to={`/browse?category=${s.slug}`}
                data-testid={`section-link-${s.slug}`}
                className="text-sm text-[#ff3d00] hover:text-[#ff5722] font-medium inline-flex items-center gap-1 self-start lg:self-auto"
              >
                Ver todo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-[#131318] p-10 text-center text-zinc-500" data-testid={`empty-${s.slug}`}>
                Aún no hay publicaciones en esta categoría.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {items.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </section>
        );
      })}

      <Footer />
    </div>
  );
}
