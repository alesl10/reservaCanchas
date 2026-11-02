import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useChatCanchas } from "@/hooks";
import { ChatAccionReserva } from "./ChatAccionReserva";
import { MoneyUtils } from "@/utils";
import { LuSend, LuArrowRight, LuBot, LuX, LuMessageCircle } from "react-icons/lu";

const RUTAS_OCULTAS = ["/login", "/admin"];
const CONSULTA_MOVIL = "(max-width: 639px)";

export function ChatCanchasWidget() {
  const location = useLocation();
  const { mensajes, enviando, enviar, iniciarSesion, confirmarReserva, descartarReserva, pagarSena } = useChatCanchas();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando, abierto]);

  // En celular el chat tapa toda la pantalla: se bloquea el scroll de la página de atrás
  // para que el dedo no la mueva mientras se usa el chat.
  useEffect(() => {
    if (!abierto || !window.matchMedia(CONSULTA_MOVIL).matches) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [abierto]);

  if (RUTAS_OCULTAS.some((r) => location.pathname.startsWith(r))) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    enviar(texto);
    setTexto("");
  }

  return (
    <>
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente de canchas"
          className="fixed inset-0 h-dvh z-50 bg-white flex flex-col overflow-hidden
                     sm:inset-auto sm:bottom-24 sm:right-6 sm:h-auto sm:w-[380px] sm:rounded-2xl sm:border sm:border-slate-200/80"
          style={{ boxShadow: "0 20px 45px -10px rgba(15,23,42,0.25)" }}
        >
          <div className="flex items-center justify-between gap-2.5 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:pt-3.5 border-b border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white flex-shrink-0">
                <LuBot size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 leading-tight">Asistente de canchas</p>
                <p className="text-[11px] text-slate-400 leading-tight truncate">
                  Te ayuda a encontrar y elegir una cancha
                </p>
              </div>
            </div>
            <button
              type="button"
              className="-m-2 p-2.5 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
            >
              <LuX size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4 flex-1 min-h-0 overflow-y-auto overscroll-contain sm:flex-none sm:h-[420px] sm:max-h-[calc(100dvh-14rem)]">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.rol === "usuario" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                    m.rol === "usuario"
                      ? "bg-brand-700 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-700 rounded-bl-sm"
                  }`}
                >
                  {m.texto}
                </div>

                {!!m.canchas?.length && (
                  <div className="mt-2 flex flex-col gap-2 w-full max-w-[95%]">
                    {m.canchas.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex flex-col gap-1.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-900 text-[13px] leading-tight">{c.nombre}</span>
                          {c.distanciaKm != null && (
                            <span className="shrink-0 text-[10.5px] font-semibold text-brand-700 bg-brand-50 rounded-full px-2 py-0.5">
                              {c.distanciaKm} km
                            </span>
                          )}
                        </div>
                        {(c.zona || c.formato) && (
                          <p className="text-[12px] text-slate-500">
                            {[c.formato && `Fútbol ${c.formato}`, c.zona].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[14px] font-extrabold text-brand-700">
                            {MoneyUtils.formatear(c.precioPorHora)}
                            <span className="text-[11px] text-slate-400 font-medium">/hora</span>
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline text-[11.5px] py-1"
                            onClick={() => enviar(`Quiero reservar ${c.nombre}`)}
                            disabled={enviando}
                          >
                            Reservar <LuArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {m.accion && (
                  <ChatAccionReserva
                    accion={m.accion}
                    onLogin={iniciarSesion}
                    onConfirmar={() => confirmarReserva(i)}
                    onDescartar={() => descartarReserva(i)}
                    onPagar={(metodo) => pagarSena(i, metodo)}
                  />
                )}
              </div>
            ))}

            {enviando && (
              <div className="flex items-start">
                <div className="bg-slate-100 text-slate-400 rounded-2xl rounded-bl-sm px-4 py-2.5 text-[13px]">
                  Escribiendo…
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 border-t border-slate-100 shrink-0"
          >
            <input
              className="form-input flex-1"
              placeholder="Ej: fútbol 5 techada en Caballito mañana 20hs"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={300}
              disabled={enviando}
              enterKeyHint="send"
              // En celular no se enfoca solo: abriría el teclado y taparía medio chat de entrada.
              autoFocus={!window.matchMedia(CONSULTA_MOVIL).matches}
            />
            <button type="submit" className="btn btn-primary" disabled={enviando || !texto.trim()}>
              <LuSend size={15} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        // Con el chat abierto en celular se oculta: el chat ya tiene su botón de cerrar arriba.
        className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-brand-700 text-white items-center justify-center hover:bg-brand-800 hover:-translate-y-0.5 transition-all ${
          abierto ? "hidden sm:flex" : "flex"
        }`}
        style={{ boxShadow: "0 10px 25px -5px rgba(4,120,87,0.5)" }}
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar chat" : "Abrir chat de canchas"}
      >
        {abierto ? <LuX size={22} /> : <LuMessageCircle size={22} />}
      </button>
    </>
  );
}
