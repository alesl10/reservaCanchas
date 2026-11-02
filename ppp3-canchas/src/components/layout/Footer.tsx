import { Link } from "react-router-dom";
import { LuMapPin, LuClock, LuPhone } from "react-icons/lu";

export function Footer() {
  return (
    <footer
      style={{
        background: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-lg">
                ⚽
              </div>
              <span className="text-white font-extrabold text-lg tracking-tight">
                FutbolReservas
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              El sistema más rápido y confiable para reservar tu cancha de
              fútbol. Disponible las 24hs.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase text-xs text-slate-400">
              Navegación
            </h4>
            <ul className="space-y-2.5">
              {[
                { to: "/", label: "Inicio" },
                { to: "/login", label: "Reservar una cancha" },
                { to: "/login", label: "Mis reservas" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-slate-400 hover:text-emerald-400 text-sm transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-600 flex-shrink-0" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase text-xs text-slate-400">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-slate-400 text-sm">
                <LuMapPin
                  size={15}
                  className="text-emerald-500 flex-shrink-0 mt-0.5"
                />
                Buenos Aires, Argentina
              </li>
              <li className="flex items-start gap-2.5 text-slate-400 text-sm">
                <LuClock
                  size={15}
                  className="text-emerald-500 flex-shrink-0 mt-0.5"
                />
                Lun – Dom, 08:00 a 23:00
              </li>
              <li className="flex items-start gap-2.5 text-slate-400 text-sm">
                <LuPhone
                  size={15}
                  className="text-emerald-500 flex-shrink-0 mt-0.5"
                />
                (011) 1234-5678
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-slate-500 text-xs">
            &copy; 2026 FutbolReservas — Todos los derechos reservados
          </p>
          <p className="text-slate-500 text-xs">
            Desarrollado por{" "}
            <span className="text-emerald-500">Luciano Salazar</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
