import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      className="border-t border-white/10 bg-[#0b0b0d] mt-24"
      data-testid="footer"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <img src="/logo.png" alt="DannyZCars" className="h-14 w-auto object-contain mb-3" />
          <p className="text-sm text-zinc-500 max-w-sm">
            Refacciones y autos seleccionados. Calidad, estilo y performance.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Categorías</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/browse?category=refacciones" className="text-zinc-300 hover:text-[#ff3d00]">Refacciones</Link></li>
            <li><Link to="/browse?category=autos" className="text-zinc-300 hover:text-[#ff3d00]">Autos</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Cuenta</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/admin/login" className="text-zinc-300 hover:text-[#ff3d00]">Admin Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} DannyZCars · Todos los derechos reservados
      </div>
    </footer>
  );
}
