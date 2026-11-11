import { useMemo, useState } from 'react'
import { useReservas, useCanchas, useClientes } from '@/hooks'
import { ReservasService, PagosService } from '@/services'
import type { MetodoPago, Reserva } from '@/types'
import { Modal, useAlert } from '@/components'
import { Select, SelectItem } from '@/components/atoms'
import { MoneyUtils, ReservaUtils } from '@/utils'
import { AdminReservationsTable, type AccionItem } from '@/components/organims/tables'
import { ReservasCalendario } from './reservas-calendario'

interface ConfirmModal {
  id: number
  estado: string
  titulo: string
  mensaje: string
}

export function ReservasTab() {
  const { mostrar, AlertComponent } = useAlert()
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista')
  const params: Record<string, string> = {}
  // El calendario necesita todo el mes: el filtro de un solo día aplica solo al listado.
  if (filtroFecha && vista === 'lista') params.fecha = filtroFecha
  if (filtroEstado) params.estado = filtroEstado
  const { reservas, loading, error, recargar } = useReservas(params)
  const { canchas } = useCanchas()
  const { clientes } = useClientes({ limite: '1000' })
  const [modalPago, setModalPago] = useState<Reserva | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [procesando, setProcesando] = useState(false)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)
  const [ejecutando, setEjecutando] = useState(false)

  const [ordenFecha, setOrdenFecha] = useState<'desc' | 'asc'>('desc')
  const reservasOrdenadas = useMemo(() => {
    const ordenadas = [...reservas].sort((a, b) =>
      ordenFecha === 'desc'
        ? b.fecha.localeCompare(a.fecha)
        : a.fecha.localeCompare(b.fecha)
    )
    return ReservaUtils.enriquecer(ordenadas, canchas, clientes)
  }, [reservas, ordenFecha, canchas, clientes])

  async function accion(id: number, estado: string) {
    setEjecutando(true)
    try {
      await ReservasService.actualizarEstado(id, estado)
      mostrar('Estado actualizado', 'success')
      recargar()
    } catch (err) {
      mostrar((err as Error).message, 'error')
    } finally {
      setEjecutando(false)
      setConfirmModal(null)
    }
  }

  async function confirmarPago() {
    if (!modalPago || !montoPago) return
    setProcesando(true)
    try {
      await PagosService.registrar(modalPago.id, parseFloat(montoPago), metodoPago as MetodoPago)
      mostrar('Pago registrado. La reserva se confirma al cubrir la seña.', 'success')
      setModalPago(null)
      recargar()
    } catch (err) {
      mostrar((err as Error).message, 'error')
    } finally {
      setProcesando(false)
    }
  }

  function getAcciones(r: Reserva): AccionItem[] {
    const items: AccionItem[] = []

    if (r.estado === 'pendiente') {
      items.push({
        label: 'Confirmar',
        onClick: () => { setModalPago(r); setMontoPago(String(r.senaRequerida ?? '')) },
      })
      items.push({
        label: 'Cancelar',
        variant: 'danger',
        onClick: () => setConfirmModal({
          id: r.id,
          estado: 'cancelada',
          titulo: 'Cancelar reserva',
          mensaje: `¿Querés cancelar la reserva #${r.id}? Esta acción no se puede deshacer.`,
        }),
      })
    }

    if (r.estado === 'confirmada') {
      items.push({
        label: 'Completar',
        onClick: () => setConfirmModal({
          id: r.id,
          estado: 'completada',
          titulo: 'Completar reserva',
          mensaje: `¿Querés marcar la reserva #${r.id} como completada?`,
        }),
      })
      items.push({
        label: 'Cancelar',
        variant: 'danger',
        onClick: () => setConfirmModal({
          id: r.id,
          estado: 'cancelada',
          titulo: 'Cancelar reserva',
          mensaje: `¿Querés cancelar la reserva #${r.id}? Esta acción no se puede deshacer.`,
        }),
      })
      items.push({
        label: 'No Mostrar',
        variant: 'danger',
        onClick: () => setConfirmModal({
          id: r.id,
          estado: 'no_show',
          titulo: 'Marcar como No Show',
          mensaje: `¿Querés marcar la reserva #${r.id} como No Show?`,
        }),
      })
    }

    return items
  }

  return (
    <div>
      {AlertComponent}
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-6">Gestión de Reservas</h1>

      <div className="flex gap-4 mb-6 flex-wrap items-end">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Vista">
          {(['lista', 'calendario'] as const).map(v => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => setVista(v)}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold border-none cursor-pointer font-[inherit] transition-colors
                ${vista === v ? 'bg-brand-700 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
            >
              {v === 'lista' ? 'Listado' : 'Calendario'}
            </button>
          ))}
        </div>
        {vista === 'lista' && (
          <div style={{ margin: 0 }}>
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Fecha</label>
            <input type="date" className="form-input" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
          </div>
        )}
        <div style={{ margin: 0 }}>
          <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Estado</label>
          <Select value={filtroEstado} onValueChange={setFiltroEstado} placeholder="Todos">
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="confirmada">Confirmada</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </Select>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3.5 rounded-xl flex items-start gap-3 text-[13.5px] border bg-red-50 text-red-800 border-red-200 mb-4">
          {error}
        </div>
      )}

      {vista === 'lista' ? (
        <AdminReservationsTable
          reservas={reservasOrdenadas}
          loading={loading}
          error={error ?? ''}
          ordenFecha={ordenFecha}
          onOrdenFecha={() => setOrdenFecha(v => v === 'desc' ? 'asc' : 'desc')}
          getAcciones={getAcciones}
        />
      ) : (
        <ReservasCalendario reservas={reservasOrdenadas} loading={loading} getAcciones={getAcciones} />
      )}

      {confirmModal && (
        <Modal
          titulo={confirmModal.titulo}
          onClose={() => setConfirmModal(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setConfirmModal(null)} disabled={ejecutando}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => accion(confirmModal.id, confirmModal.estado)}
                disabled={ejecutando}
              >
                {ejecutando ? 'Guardando' : 'Aceptar'}
              </button>
            </div>
          }
        >
          <p className="text-slate-600">{confirmModal.mensaje}</p>
        </Modal>
      )}

      {modalPago && (
        <Modal
          titulo="Confirmar Reserva"
          onClose={() => setModalPago(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setModalPago(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarPago} disabled={procesando}>
                {procesando ? 'Guardando' : 'Confirmar Pago'}
              </button>
            </div>
          }
        >
          <div className="mb-5">
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Monto recibido</label>
            <div className="flex gap-2 flex-wrap mb-2">
              <button
                type="button" className="btn btn-small btn-outline"
                onClick={() => setMontoPago(String(modalPago.senaRequerida ?? 0))}
              >
                Seña: {MoneyUtils.formatear(modalPago.senaRequerida ?? 0)}
              </button>
              <button
                type="button" className="btn btn-small btn-outline"
                onClick={() => setMontoPago(String(modalPago.precioTotal))}
              >
                Total: {MoneyUtils.formatear(modalPago.precioTotal)}
              </button>
            </div>
            <input
              type="number" className="form-input" min={0}
              value={montoPago} onChange={e => setMontoPago(e.target.value)}
            />
          </div>
          <div className="mb-5">
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">Método de pago</label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="tarjeta">Tarjeta</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
            </Select>
          </div>
        </Modal>
      )}
    </div>
  )
}
