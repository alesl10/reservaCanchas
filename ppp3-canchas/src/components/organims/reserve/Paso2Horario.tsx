import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CanchasService, ReservasService } from "@/services";
import { DateUtils, HorarioUtils, MoneyUtils } from "@/utils";
import { Spinner } from "@/components";
import { Select, SelectItem } from "@/components/atoms";
import { PASO2_EMPTY } from "@/mock";
import type { Cancha, SlotOcupado } from "@/types";
import type { DatosReserva } from "./ReservarPage";

interface Props {
  onNext: (datos: DatosReserva) => void;
  onBack?: () => void;
}

type Errors = {
  cancha: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
};

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <span className="text-red-600 text-[12px] mt-1.5 block font-medium flex items-center gap-1">⚠ {msg}</span>
  );
}

export function Paso2Horario({ onNext, onBack }: Props) {
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [cargandoCanchas, setCargandoCanchas] = useState(true);
  // Viene de "Reservar Ahora" de una cancha concreta (?cancha=ID): queda preseleccionada.
  const [searchParams] = useSearchParams();
  const canchaInicial = Number(searchParams.get("cancha")) || "";
  const [canchaId, setCanchaId] = useState<number | "">(canchaInicial);
  const [fecha, setFecha] = useState(DateUtils.fechaHoy());
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [reservasOcupadas, setReservasOcupadas] = useState<SlotOcupado[]>([]);
  const [cargandoDisp, setCargandoDisp] = useState(false);
  const [errors, setErrors] = useState<Errors>(PASO2_EMPTY);

  useEffect(() => {
    CanchasService.obtenerTodas()
      .then((data) => {
        const disponibles = data.filter((c) => c.estado === "disponible");
        setCanchas(disponibles);
        // Si la cancha pedida ya no está disponible (o no existe), se elige a mano.
        setCanchaId((actual) => (actual && disponibles.some((c) => c.id === actual) ? actual : ""));
      })
      .finally(() => setCargandoCanchas(false));
  }, []);

  useEffect(() => {
    if (!fecha || !canchaId) return;
    setCargandoDisp(true);
    ReservasService.verificarDisponibilidad(fecha, canchaId as number)
      .then(setReservasOcupadas)
      .catch(() => setReservasOcupadas([]))
      .finally(() => setCargandoDisp(false));
    setHoraInicio("");
    setHoraFin("");
    setErrors(PASO2_EMPTY);
  }, [fecha, canchaId]);

  function estaOcupado(hora: string) {
    return reservasOcupadas.some(
      (r) =>
        hora >= DateUtils.formatearHora(r.horaInicio) &&
        hora < DateUtils.formatearHora(r.horaFin),
    );
  }
  function esPasado(hora: string) {
    return DateUtils.esHoy(fecha) && hora <= DateUtils.horaActual();
  }
  function seleccionarHora(hora: string) {
    setHoraInicio(hora);
    const [h, m] = hora.split(":").map(Number);
    setHoraFin(
      `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
    setErrors((e) => ({ ...e, horaInicio: "", horaFin: "" }));
  }

  function siguiente() {
    const errs = { ...PASO2_EMPTY };
    if (!canchaId) errs.cancha = "Seleccioná una cancha";
    if (!fecha) errs.fecha = "La fecha es requerida";
    if (!horaInicio) errs.horaInicio = "Seleccioná un horario de inicio";
    else if (!horaFin) errs.horaFin = "Seleccioná el horario de fin";
    else {
      const dur = DateUtils.calcularDuracion(horaInicio, horaFin);
      if (dur <= 0)
        errs.horaFin = "El horario de fin debe ser posterior al inicio";
      if (dur > 3) errs.horaFin = "La duración máxima es 3 horas";
    }

    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      return;
    }

    const cancha = canchas.find((c) => c.id === (canchaId as number))!;
    onNext({
      canchaId: canchaId as number,
      cancha,
      fecha,
      horaInicio,
      horaFin,
      observaciones: "",
    });
  }

  const cancha = canchas.find((c) => c.id === (canchaId as number));
  const horariosBase = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
  ];
  const opcionesFin = horaInicio
    ? HorarioUtils.generarOpciones(fecha, horaInicio).filter(
        (h) => h > horaInicio,
      )
    : [];

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Cancha y Horario</h2>
      <p className="text-sm text-slate-400 mb-6">
        Elegí la cancha, la fecha y el bloque horario que prefieras.
      </p>

      {cargandoCanchas ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-5">
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Cancha <span className="text-red-500">*</span></label>
            <Select
              value={canchaId ? String(canchaId) : ""}
              onValueChange={(v) => {
                setCanchaId(v ? Number(v) : "");
                setErrors((prev) => ({ ...prev, cancha: "" }));
              }}
              placeholder="Seleccioná una cancha"
              className={errors.cancha ? "border-red-400 focus:border-red-400" : ""}
            >
              {canchas.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre} — {MoneyUtils.formatear(c.precioPorHora)}/hora
                </SelectItem>
              ))}
            </Select>
            <FieldError msg={errors.cancha} />
          </div>

          <div className="mb-5">
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Fecha <span className="text-red-500">*</span></label>
            <input
              type="date"
              className={`form-input ${errors.fecha ? "border-red-400 focus:border-red-400" : ""}`}
              min={DateUtils.fechaHoy()}
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setErrors((v) => ({ ...v, fecha: "" }));
              }}
            />
            <FieldError msg={errors.fecha} />
          </div>

          {canchaId && fecha && (
            <div className="mb-5">
              <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
                Horario de inicio
                {errors.horaInicio && (
                  <span className="text-red-600 text-[12px] font-medium ml-2 inline">
                    ⚠ {errors.horaInicio}
                  </span>
                )}
              </label>
              {cargandoDisp ? (
                <Spinner texto="Verificando disponibilidad…" />
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {horariosBase.map((hora) => {
                    const ocupado = estaOcupado(hora);
                    const pasado = esPasado(hora);
                    const bloqueado = ocupado || pasado;
                    const seleccionado = horaInicio === hora;
                    return (
                      <button
                        key={hora}
                        type="button"
                        className={`btn btn-small ${
                          bloqueado
                            ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed opacity-60"
                            : seleccionado
                              ? "btn-primary"
                              : "btn-outline"
                        }`}
                        disabled={bloqueado}
                        onClick={() => seleccionarHora(hora)}
                        title={
                          ocupado ? "Ocupado" : pasado ? "Hora pasada" : ""
                        }
                      >
                        {hora}
                      </button>
                    );
                  })}
                </div>
              )}

              {!cargandoDisp && (
                <div className="flex gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-brand-700 inline-block" />{" "}
                    Seleccionado
                  </span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-200 inline-block" />{" "}
                    No disponible
                  </span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200 inline-block" />{" "}
                    Disponible
                  </span>
                </div>
              )}
            </div>
          )}

          {horaInicio && (
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-5">
                <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Hora de inicio</label>
                <input
                  type="time"
                  className="form-input bg-slate-50"
                  value={horaInicio}
                  readOnly
                />
              </div>
              <div className="mb-5">
                <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Hora de fin <span className="text-red-500">*</span></label>
                <Select
                  value={horaFin}
                  onValueChange={(v) => {
                    setHoraFin(v);
                    setErrors((prev) => ({ ...prev, horaFin: "" }));
                  }}
                  placeholder="Elegí hora de fin"
                  className={errors.horaFin ? "border-red-400 focus:border-red-400" : ""}
                >
                  {opcionesFin.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </Select>
                <FieldError msg={errors.horaFin} />
              </div>
            </div>
          )}

          {horaInicio && horaFin && cancha && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center justify-between mt-2">
              <span className="text-[13.5px] text-brand-800 font-medium">
                {DateUtils.calcularDuracion(horaInicio, horaFin)}h ·{" "}
                {DateUtils.formatearHora(horaInicio)} a {DateUtils.formatearHora(horaFin)}
              </span>
              <span className="text-lg font-extrabold text-brand-700">
                {MoneyUtils.formatear(
                  cancha.precioPorHora *
                    DateUtils.calcularDuracion(horaInicio, horaFin),
                )}
              </span>
            </div>
          )}
        </>
      )}

      <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
        {onBack ? (
          <button type="button" className="btn btn-outline" onClick={onBack}>
            ← Volver
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="btn btn-primary" onClick={siguiente}>
          Siguiente →
        </button>
      </div>
    </div>
  );
}
