import { Link, useLocation } from "react-router-dom";

const CATS = [
  { slug: "", label: "Todo" },
  { slug: "refacciones", label: "Refacciones" },
  { slug: "rines", label: "Rines" },
  { slug: "autos", label: "Autos" },
];

export default function CategoryChips({ active = "" }) {
  const location = useLocation();
  return (
    <div className="border-b border-white/10 bg-[#0b0b0d]/90 backdrop-blur-md sticky top-[68px] z-40">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-3 overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {CATS.map((c) => {
            const params = new URLSearchParams(location.search);
            if (c.slug) params.set("category", c.slug);
            else params.delete("category");
            const isActive = (active || "") === c.slug;
            return (
              <Link
                key={c.slug || "all"}
                to={`/browse${params.toString() ? "?" + params.toString() : ""}`}
                data-testid={`chip-${c.slug || "all"}`}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-[#ff3d00] text-black border-[#ff3d00]"
                    : "bg-transparent text-zinc-300 border-white/10 hover:border-[#ff3d00]/60 hover:text-white"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
