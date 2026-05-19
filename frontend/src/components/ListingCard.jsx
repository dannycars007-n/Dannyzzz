import { Link } from "react-router-dom";
import { fileUrl } from "@/lib/api";
import { MapPin } from "lucide-react";

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

const CONDITION_LABELS = {
  nuevo: "Nuevo",
  seminuevo: "Seminuevo",
  usado: "Usado",
};

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1778923096146-62bb36b04a87?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

export default function ListingCard({ listing }) {
  const img = listing.images && listing.images[0] ? fileUrl(listing.images[0]) : PLACEHOLDER;
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="card-listing block rounded-lg overflow-hidden group"
      data-testid={`listing-card-${listing.id}`}
    >
      <div className="aspect-square bg-[#0f0f12] overflow-hidden">
        <img
          src={img}
          alt={listing.title}
          className="listing-img w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="font-display font-bold text-base sm:text-lg text-white">
          {formatPrice(listing.price, listing.currency)}
        </div>
        <div className="text-sm text-zinc-200 line-clamp-1 mt-0.5" data-testid={`listing-title-${listing.id}`}>
          {listing.title}
        </div>
        <div className="text-xs text-zinc-500 flex items-center justify-between mt-1.5">
          <span>{CONDITION_LABELS[listing.condition] || listing.condition}</span>
          {listing.location && (
            <span className="flex items-center gap-1 truncate max-w-[55%]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{listing.location}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
