import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components";
import { useAuth } from "@/context";
import { Paso1Cliente } from "./Paso1Cliente";
import { Paso2Horario } from "./Paso2Horario";
import { Paso3Resumen } from "./Paso3Resumen";
import { Paso4Pago } from "./Paso4Pago";
import { PASOS } from "@/mock";
import type { Cancha, Reserva } from "@/types";

export interface DatosCliente {
  id: number | null;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  esNuevo: boolean;
}

export interface DatosReserva {
  canchaId: number;
  cancha: Cancha;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  observaciones: string;
}

// Selección guardada al mandar al visitante a loguearse: al volver se retoma en la confirmación.
const CLAVE_PENDIENTE = "reservaPendiente";
const VIGENCIA_PENDIENTE_MS = 30 * 60 * 1000;

function leerPendiente(): DatosReserva | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_PENDIENTE);
    if (!raw) return null;
    sessionStorage.removeItem(CLAVE_PENDIENTE);
    const { reserva, guardadaEn } = JSON.parse(raw);
    if (Date.now() - guardadaEn > VIGENCIA_PENDIENTE_MS) return null;
    return reserva as DatosReserva;
  } catch {
    return null;
  }
}

export function ReservarPage() {
  const { sesion } = useAuth();
  const navigate = useNavigate();
  const esCliente = sesion?.rol === "cliente";

  // Cliente que vuelve del login con una selección pendiente: va directo a confirmar.
  const [pendiente] = useState<DatosReserva | null>(() => (esCliente ? leerPendiente() : null));
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(pendiente ? 3 : sesion ? 1 : 2);
  const [cliente, setCliente] = useState<DatosCliente | null>(
    pendiente && sesion
      ? {
          id: sesion.clienteId,
          nombre: sesion.nombre,
          apellido: sesion.apellido,
          telefono: sesion.telefono,
          email: sesion.email,
          esNuevo: !sesion.clienteId,
        }
      : null,
  );
  const [reserva, setReserva] = useState<DatosReserva | null>(pendiente);
  const [reservaCreada, setReservaCreada] = useState<Reserva | null>(null);

  if (sesion?.rol === "admin") return <Navigate to="/admin" replace />;

  function pedirLogin() {
    if (reserva) {
      try {
        sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ reserva, guardadaEn: Date.now() }));
      } catch {
        /* sin sessionStorage el visitante simplemente rehace la selección */
      }
    }
    navigate("/login");
  }

  return (
    <PublicLayout>

      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-center mb-8">
          {PASOS.map((p, i) => (
            <div key={p.n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-[15px] transition-all duration-300
                  ${
                    paso >= p.n && !(p.n === 1 && !sesion)
                      ? "text-white shadow-lg shadow-brand-600/30"
                      : "bg-slate-100 text-slate-400"
                  }`}
                  style={
                    paso >= p.n && !(p.n === 1 && !sesion)
                      ? {
                          background: "linear-gradient(135deg,#059669,#047857)",
                        }
                      : {}
                  }
                >
                  {paso > p.n && !(p.n === 1 && !sesion) ? "✓" : p.n}
                </div>
                <span
                  className={`text-[11px] font-semibold mt-1.5 whitespace-nowrap transition-colors
                  ${paso >= p.n ? "text-brand-700" : "text-slate-400"}`}
                >
                  {p.label}
                </span>
              </div>
              {i < PASOS.length - 1 && (
                <div
                  className={`w-10 sm:w-16 h-px mx-1 sm:mx-2 mb-5 transition-colors duration-300 ${paso > p.n ? "bg-brand-400" : "bg-slate-200"}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[var(--shadow-card)]">
          {paso === 1 && (
            <Paso1Cliente
              onNext={(d) => {
                setCliente(d);
                setPaso(2);
              }}
            />
          )}
          {paso === 2 && (
            <Paso2Horario
              onNext={(d) => {
                setReserva(d);
                setPaso(3);
              }}
              // Sin sesión no hay paso de datos al que volver.
              onBack={sesion ? () => setPaso(1) : undefined}
            />
          )}
          {paso === 3 && reserva && (cliente || !sesion) && (
            <Paso3Resumen
              cliente={cliente}
              onRequireLogin={pedirLogin}
              reserva={reserva}
              onBack={() => setPaso(2)}
              onCreated={(r) => {
                setReservaCreada(r);
                setPaso(4);
              }}
            />
          )}
          {paso === 4 && reservaCreada && <Paso4Pago reserva={reservaCreada} />}
        </div>
      </div>

    </PublicLayout>
  );
}
