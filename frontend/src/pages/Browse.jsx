import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import CategoryChips from "@/components/CategoryChips";
import ListingCard from "@/components/ListingCard";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState({});

  const filters = useMemo(() => ({
    q: params.get("q") || "",
    category: params.get("category") || "",
    subcategory: params.get("subcategory") || "",
    condition: params.get("condition") || "",
    min_price: params.get("min_price") || "",
    max_price: params.get("max_price") || "",
    sort: params.get("sort") || "newest",
  }), [params]);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qp.set(k, v); });
    api.get(`/listings?${qp.toString()}`).then((r) => {
      setListings(r.data);
    }).finally(() => setLoading(false));
  }, [filters]);

  const updateFilter = (key, value) => {
    const p = new URLSearchParams(params);
    if (value && value !== "all") p.set(key, value);
    else p.delete(key);
    if (key === "category") p.delete("subcategory");
    setParams(p, { replace: true });
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  const subcats = filters.category && categories[filters.category]
    ? categories[filters.category].subcategories
    : [];

  return (
    <div className="App grain font-body">
      <Navbar defaultQuery={filters.q} />
      <CategoryChips active={filters.category} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters */}
          <aside className="lg:w-64 shrink-0" data-testid="filters-panel">
            <div className="bg-[#131318] border border-white/10 rounded-lg p-5 lg:sticky lg:top-[140px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-bold text-white">Filtros</h3>
                <button
                  onClick={clearAll}
                  className="text-xs text-zinc-400 hover:text-[#ff3d00]"
                  data-testid="filter-clear-btn"
                >
                  Limpiar
                </button>
              </div>

              <div className="space-y-4 text-sm">
                {subcats.length > 0 && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-zinc-500 block mb-2">Subcategoría</label>
                    <Select
                      value={filters.subcategory || "all"}
                      onValueChange={(v) => updateFilter("subcategory", v)}
                    >
                      <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white" data-testid="filter-subcategory">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {subcats.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-500 block mb-2">Condición</label>
                  <Select
                    value={filters.condition || "all"}
                    onValueChange={(v) => updateFilter("condition", v)}
                  >
                    <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white" data-testid="filter-condition">
                      <SelectValue placeholder="Cualquiera" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Cualquiera</SelectItem>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="seminuevo">Seminuevo</SelectItem>
                      <SelectItem value="usado">Usado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-500 block mb-2">Precio</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filters.min_price}
                      onChange={(e) => updateFilter("min_price", e.target.value)}
                      className="bg-[#0b0b0d] border-white/10 text-white h-9"
                      data-testid="filter-min-price"
                    />
                    <span className="text-zinc-600">—</span>
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filters.max_price}
                      onChange={(e) => updateFilter("max_price", e.target.value)}
                      className="bg-[#0b0b0d] border-white/10 text-white h-9"
                      data-testid="filter-max-price"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-zinc-500 block mb-2">Ordenar</label>
                  <Select
                    value={filters.sort}
                    onValueChange={(v) => updateFilter("sort", v)}
                  >
                    <SelectTrigger className="bg-[#0b0b0d] border-white/10 text-white" data-testid="filter-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Más recientes</SelectItem>
                      <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
                      <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white" data-testid="browse-title">
                  {filters.q
                    ? `Resultados para "${filters.q}"`
                    : filters.category
                      ? categories[filters.category]?.name || "Explorar"
                      : "Explorar marketplace"}
                </h1>
                <div className="text-sm text-zinc-500 mt-1" data-testid="results-count">
                  {loading ? "Cargando..." : `${listings.length} publicación${listings.length === 1 ? "" : "es"}`}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-lg bg-[#131318] animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-[#131318] p-16 text-center" data-testid="empty-results">
                <div className="text-2xl font-display font-bold text-white mb-2">Sin resultados</div>
                <p className="text-zinc-500 mb-6">Prueba ajustar los filtros o limpiar la búsqueda.</p>
                <Button onClick={clearAll} className="btn-accent" data-testid="empty-clear-btn">
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5" data-testid="listings-grid">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
