import { useNavigate } from "react-router-dom";
import { PublicLayout, CanchasListado, CanchasMapa, EmptyState, Spinner } from "@/components";
import { LuShieldCheck, LuArrowRight } from "react-icons/lu";
import { useCanchas } from "@/hooks";
import { CARDS, FEATURES, STEPS } from "@/mock";

export function HomePage() {
  const { canchas, loading, error } = useCanchas();
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <section
        className="relative flex items-center justify-center text-center overflow-hidden min-h-[580px]"
        style={{
          background:
            "linear-gradient(135deg, #022c22 0%, #064e3b 45%, #065f46 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(52,211,153,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
        <div
          className="relative z-10 text-white px-6 py-24 max-w-3xl"
          style={{ animation: "fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1)" }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-emerald-300 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-7 tracking-wide">
            <LuShieldCheck size={12} />
            Reservas Confirmadas al Instante
          </div>
          <h1
            className="text-[52px] sm:text-[68px] font-extrabold mb-5 tracking-tight leading-[1.05] text-emerald-50"
            style={{ textShadow: "0 2px 30px rgba(0,0,0,0.3)" }}
          >
            Reservá tu
            <br />
            <span className="text-emerald-400">Cancha de Fútbol</span>
          </h1>
          <p className="text-lg sm:text-xl mb-10 text-white/75 max-w-xl mx-auto leading-relaxed">
            Sistema rápido, fácil y confiable. Elegí horario, confirmá en
            segundos y jugá.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              className="btn btn-white btn-large"
              onClick={() => navigate("/reservar")}
            >
              Hacer una Reserva
              <LuArrowRight size={17} />
            </button>
            <a
              href="#canchas"
              className="btn btn-large bg-white/10 border-white/25 text-white hover:bg-white/20"
            >
              Ver Canchas
            </a>
          </div>
          <div className="flex justify-center gap-8 mt-12 pt-10 border-t border-white/10">
            {[
              ["500+", "Reservas al mes"],
              [canchas?.length, "Canchas disponibles"],
              ["24/7", "Disponibilidad"],
            ].map(([val, label]) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-extrabold text-white leading-none mb-1">
                  {val}
                </div>
                <div className="text-white/50 text-xs font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-24 bg-slate-50">
        <div className="w-full px-6 sm:px-8">
          <p className="text-center text-brand-600 text-sm font-bold uppercase tracking-widest mb-2">
            Ventajas
          </p>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            ¿Por qué elegirnos?
          </h2>
          <div className="w-10 h-1 bg-brand-600 rounded-full mx-auto mb-10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ Icon, color, title, desc }) => (
              <div
                key={title}
                className="bg-white p-7 rounded-2xl border border-slate-200/80 hover:-translate-y-1.5 hover:border-brand-100 transition-all duration-200 flex flex-col"
                style={{ boxShadow: "var(--shadow-card)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow = "var(--shadow-card-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.boxShadow = "var(--shadow-card)")
                }
              >
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ring-1 ${color} mb-5`}
                >
                  <Icon size={22} />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900 mb-2">
                  {title}
                </h3>
                <p className="text-[13px] text-slate-500 leading-relaxed flex-1">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="mapa" className="py-24 bg-slate-50">
        <div className="w-full px-6 sm:px-8">
          <p className="text-center text-brand-600 text-sm font-bold uppercase tracking-widest mb-2">
            Ubicaciones
          </p>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Canchas cerca tuyo
          </h2>
          <div className="w-10 h-1 bg-brand-600 rounded-full mx-auto mb-10" />
          {!loading && !error && <CanchasMapa canchas={canchas} />}
        </div>
      </section>

      <section id="canchas" className="py-24 bg-white">
        <div className="w-full px-6 sm:px-8">
          <p className="text-center text-brand-600 text-sm font-bold uppercase tracking-widest mb-2">
            Instalaciones
          </p>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Nuestras Canchas
          </h2>
          <div className="w-10 h-1 bg-brand-600 rounded-full mx-auto mb-10" />
          {loading && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}
          {error && (
            <p className="text-center text-red-700 py-6 px-8 text-sm bg-red-50 rounded-xl border border-red-200">
              Error al cargar las canchas.
            </p>
          )}
          {!loading && !error && canchas.length === 0 && (
            <EmptyState
              icono="🏟️"
              titulo="No hay canchas disponibles"
              descripcion="En este momento no contamos con canchas activas."
            />
          )}
          {!loading && !error && canchas.length > 0 && <CanchasListado canchas={canchas} />}
        </div>
      </section>

      <section className="py-24 bg-slate-50">
        <div className="w-full px-6 sm:px-8">
          <p className="text-center text-brand-600 text-sm font-bold uppercase tracking-widest mb-2">
            Proceso
          </p>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            ¿Cómo Funciona?
          </h2>
          <div className="w-10 h-1 bg-brand-600 rounded-full mx-auto mb-10" />

          <div className="relative">
            <div className="absolute top-8 left-[calc(12.5%+1rem)] right-[calc(12.5%+1rem)] h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent hidden lg:block" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((s, i) => (
                <div key={i} className="text-center">
                  <div
                    className="relative inline-flex items-center justify-center w-16 h-16 rounded-full mb-5 mx-auto"
                    style={{
                      background: "linear-gradient(135deg, #059669, #047857)",
                      boxShadow: "0 4px 16px rgb(5 150 105 / .3)",
                    }}
                  >
                    <span className="text-white text-xl font-extrabold">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-bold text-slate-900 mb-2">
                    {s.title}
                  </h3>
                  <p className="text-[12.5px] text-slate-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-14">
            <button
              className="btn btn-primary btn-large"
              onClick={() => navigate("/reservar")}
            >
              Hacer mi primera reserva
              <LuArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white border-t border-slate-100">
        <div className="w-full px-6 sm:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {CARDS?.map((c) => (
              <div
                key={c.title}
                className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200/80 hover:border-brand-100 hover:bg-brand-50/30 transition-all"
              >
              
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ring-1 ${c.color} text-2xl mb-4`}
                >
                  {c.icon}
                </div>
                <h3 className="text-[14px] font-bold text-slate-900 mb-2">
                  {c.title}
                </h3>
                {c.lines.map((l) => (
                  <p
                    key={l}
                    className="text-[13px] text-slate-400 leading-relaxed"
                  >
                    {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
