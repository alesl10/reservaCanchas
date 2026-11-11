import { useMemo, useState } from 'react'
import { BadgeReserva } from '@/components/atoms'
import type { AccionItem } from '@/components/organims/tables'
import { MoneyUtils } from '@/utils'
import type { Reserva } from '@/types'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MAX_POR_DIA = 3

const COLOR_ESTADO: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completada: 'bg-sky-100 text-sky-800 border-sky-200',
  cancelada: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
  no_show: 'bg-red-100 text-red-800 border-red-200',
}

const pad = (n: number) => String(n).padStart(2, '0')
const claveFecha = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const hhmm = (h: string) => h.slice(0, 5)

interface Props {
  reservas: Reserva[]
  loading: boolean
  getAcciones: (r: Reserva) => AccionItem[]
}

export function ReservasCalendario({ reservas, loading, getAcciones }: Props) {
  const hoy = new Date()
  const claveHoy = claveFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [seleccionado, setSeleccionado] = useState<string>(claveHoy)

  // Reservas agrupadas por día (clave YYYY-MM-DD), ordenadas por hora.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Reserva[]>()
    for (const r of reservas) {
      const k = r.fecha.slice(0, 10)
      const lista = mapa.get(k)
      if (lista) lista.push(r)
      else mapa.set(k, [r])
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    return mapa
  }, [reservas])

  // Celdas del mes: huecos iniciales (semana empieza en lunes) + días.
  const celdas = useMemo(() => {
    const primero = new Date(anio, mes, 1)
    const offset = (primero.getDay() + 6) % 7
    const diasMes = new Date(anio, mes + 1, 0).getDate()
    const lista: (number | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= diasMes; d++) lista.push(d)
    while (lista.length % 7 !== 0) lista.push(null)
    return lista
  }, [anio, mes])

  function moverMes(delta: number) {
    const f = new Date(anio, mes + delta, 1)
    setAnio(f.getFullYear())
    setMes(f.getMonth())
  }

  function irAHoy() {
    setAnio(hoy.getFullYear())
    setMes(hoy.getMonth())
    setSeleccionado(claveHoy)
  }

  const delDia = porDia.get(seleccionado) ?? []
  const [sy, sm, sd] = seleccionado.split('-').map(Number)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-900">
            {MESES[mes]} {anio}
            {loading && <span className="ml-2 text-xs font-medium text-slate-400">Cargando…</span>}
          </h2>
          <div className="flex gap-2">
            <button className="btn btn-small btn-outline" onClick={() => moverMes(-1)} aria-label="Mes anterior">‹</button>
            <button className="btn btn-small btn-outline" onClick={irAHoy}>Hoy</button>
            <button className="btn btn-small btn-outline" onClick={() => moverMes(1)} aria-label="Mes siguiente">›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DIAS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {celdas.map((dia, i) => {
            if (dia === null) {
              return <div key={i} className="min-h-24 sm:min-h-32 border-b border-r border-slate-100 bg-slate-50/50" />
            }
            const k = claveFecha(anio, mes, dia)
            const lista = porDia.get(k) ?? []
            const esHoy = k === claveHoy
            const activo = k === seleccionado
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSeleccionado(k)}
                className={`min-h-24 sm:min-h-32 border-b border-r border-slate-100 p-1.5 text-left align-top flex flex-col gap-1 cursor-pointer font-[inherit] transition-colors
                  ${activo ? 'bg-brand-50 ring-2 ring-inset ring-brand-600' : 'bg-white hover:bg-slate-50'}`}
              >
                <span
                  className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full
                    ${esHoy ? 'bg-brand-700 text-white' : 'text-slate-600'}`}
                >
                  {dia}
                </span>
                {lista.slice(0, MAX_POR_DIA).map(r => (
                  <span
                    key={r.id}
                    title={`${hhmm(r.horaInicio)} ${r.canchaNombre ?? ''} · ${r.clienteNombre ?? ''}`}
                    className={`hidden sm:block truncate text-[11px] leading-tight px-1.5 py-0.5 rounded border ${COLOR_ESTADO[r.estado] ?? ''}`}
                  >
                    {hhmm(r.horaInicio)} {r.canchaNombre ?? `Cancha ${r.canchaId}`}
                  </span>
                ))}
                {/* En móvil no entran las etiquetas: se muestra solo la cantidad. */}
                {lista.length > 0 && (
                  <span className="sm:hidden text-[11px] font-bold text-brand-700">{lista.length}</span>
                )}
                {lista.length > MAX_POR_DIA && (
                  <span className="hidden sm:block text-[11px] font-semibold text-slate-500">
                    +{lista.length - MAX_POR_DIA} más
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-fit">
        <h3 className="text-[15px] font-extrabold text-slate-900 mb-1">
          {sd} de {MESES[sm - 1]} de {sy}
        </h3>
        <p className="text-[12px] text-slate-400 mb-4">
          {delDia.length === 0 ? 'Sin reservas' : `${delDia.length} reserva${delDia.length === 1 ? '' : 's'}`}
        </p>

        <div className="flex flex-col gap-3">
          {delDia.map(r => {
            const acciones = getAcciones(r)
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] font-bold text-slate-900">
                    {hhmm(r.horaInicio)} – {hhmm(r.horaFin)}
                  </span>
                  <BadgeReserva estado={r.estado} />
                </div>
                <p className="text-[13px] text-slate-700">{r.canchaNombre ?? `Cancha ${r.canchaId}`}</p>
                <p className="text-[12px] text-slate-500">{r.clienteNombre ?? `Cliente ${r.clienteId}`}</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Total {MoneyUtils.formatear(r.precioTotal)}</p>
                {acciones.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {acciones.map(a => (
                      <button
                        key={a.label}
                        className={`btn btn-small ${a.variant === 'danger' ? 'btn-danger' : 'btn-outline'}`}
                        onClick={a.onClick}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
