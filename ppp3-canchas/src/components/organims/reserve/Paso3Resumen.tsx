import { useState } from "react";
import { ClientesService, ReservasService } from "@/services";
import { DateUtils, MoneyUtils } from "@/utils";
import { useAlert } from "@/components";
import { useAuth } from "@/context";
import type { Reserva } from "@/types";
import type { DatosCliente, DatosReserva } from "./ReservarPage";

interface Props {
  cliente: DatosCliente | null;
  onRequireLogin: () => void;
  reserva: DatosReserva;
  onBack: () => void;
  onCreated: (reserva: Reserva) => void;
}

export function Paso3Resumen({ cliente, reserva, onBack, onCreated, onRequireLogin }: Props) {
  const { mostrar, AlertComponent } = useAlert();
  const { sesion, login } = useAuth();
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  const duracion = DateUtils.calcularDuracion(
    reserva.horaInicio,
    reserva.horaFin,
  );
  const precioTotal = reserva.cancha.precioPorHora * duracion;
  const sena = MoneyUtils.calcularSena(precioTotal);

  async function confirmar() {
    if (!cliente) return onRequireLogin();
    setEnviando(true);
    try {
      let clienteId = cliente.id;
      if (cliente.esNuevo || !clienteId) {
        const nuevo = await ClientesService.crear({
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          telefono: cliente.telefono,
          email: cliente.email || undefined,
        });
        clienteId = nuevo.id;
      } else if (sesion?.rol === "cliente" && sesion.clienteId === clienteId) {
        // El cliente logueado pudo editar sus datos en el Paso 1: persistir si cambió algo
        // y refrescar la sesión para que el cambio quede guardado y se vea más adelante.
        const cambiado =
          sesion.nombre !== cliente.nombre ||
          sesion.apellido !== cliente.apellido ||
          sesion.telefono !== cliente.telefono ||
          (sesion.email ?? "") !== cliente.email;
        if (cambiado) {
          await ClientesService.actualizar(clienteId, {
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            telefono: cliente.telefono,
            email: cliente.email || undefined,
          });
          login({
            ...sesion,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            telefono: cliente.telefono,
            email: cliente.email,
          });
        }
      }
      const creada = await ReservasService.crear({
        canchaId: reserva.canchaId,
        clienteId: clienteId!,
        fecha: reserva.fecha,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        observaciones: observaciones.trim() || undefined,
      });
      mostrar("¡Reserva creada! Pagá la seña para confirmarla.", "success");
      onCreated(creada);
    } catch (err) {
      const e = err as Error & { status?: number };
      const msg = e.message || "Error al crear la reserva. Intentá de nuevo.";
      mostrar(msg, "error");
      setEnviando(false);
      // La cancha pasó a mantenimiento/fuera de servicio entre la selección y el envío
      // (el backend la rechaza con 400). Volvemos al Paso 2, que recarga la lista de
      // canchas disponibles al remontarse.
      if (e.status === 400 && /no admite reservas/i.test(msg)) {
        onBack();
      }
    }
  }

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div>
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </span>
      <p className="text-[14px] font-semibold text-slate-800 mt-0.5">{value}</p>
    </div>
  );

  return (
    <div className="p-6">
      {AlertComponent}
      <h2 className="text-lg font-bold text-slate-900 mb-1">Paso 3: Confirmación</h2>
      <p className="text-sm text-slate-400 mb-6">
        {cliente
          ? "Revisá los datos antes de confirmar tu reserva."
          : "Ese horario está disponible. Iniciá sesión o creá tu cuenta para confirmarlo; tu selección se conserva."}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
        {cliente && (
          <>
            <InfoRow
              label="Cliente"
              value={`${cliente.nombre} ${cliente.apellido}`}
            />
            <InfoRow label="Teléfono" value={cliente.telefono} />
          </>
        )}
        <InfoRow label="Cancha" value={reserva.cancha.nombre} />
        <InfoRow
          label="Fecha"
          value={DateUtils.formatearFechaCompleta(reserva.fecha)}
        />
        <InfoRow
          label="Horario"
          value={`${DateUtils.formatearHora(reserva.horaInicio)} – ${DateUtils.formatearHora(reserva.horaFin)}`}
        />
        <InfoRow
          label="Duración"
          value={`${duracion} hora${duracion !== 1 ? "s" : ""}`}
        />
      </div>

      <div className="text-center mb-6 py-5 rounded-2xl bg-brand-50 border border-brand-100">
        <p className="text-[13px] text-brand-700 font-semibold mb-1">
          Precio total
        </p>
        <p className="text-4xl font-extrabold text-brand-700 tracking-tight leading-none">
          {MoneyUtils.formatear(precioTotal)}
        </p>
        <p className="text-[12.5px] text-slate-400 mt-2">
          Seña requerida (30%):{" "}
          <strong className="text-slate-600">
            {MoneyUtils.formatear(sena)}
          </strong>
        </p>
      </div>

      <div className="mb-5">
        <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
          Observaciones{" "}
          <span className="text-slate-400 font-normal text-[12px]">
            (opcional)
          </span>
        </label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Alguna indicación especial para el personal…"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
        <button
          type="button"
          className="btn btn-outline"
          onClick={onBack}
          disabled={enviando}
        >
          ← Volver
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={confirmar}
          disabled={enviando}
        >
          {enviando ? "Procesando…" : cliente ? "Continuar al pago →" : "Iniciar sesión para confirmar →"}
        </button>
      </div>
    </div>
  );
}
