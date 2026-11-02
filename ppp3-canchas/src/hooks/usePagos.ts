import { useEffect, useState } from 'react'
import { PagosService } from '@/services'
import { useFetch } from './useFetch'
import type { SaldoReserva } from '@/types'

export function usePagosReserva(reservaId: number) {
  return useFetch<SaldoReserva>(
    () => PagosService.obtenerPorReserva(reservaId),
    String(reservaId),
  )
}

export function useSaldosReservas(reservaIds: number[]) {
  const [saldos, setSaldos] = useState<Record<number, SaldoReserva>>({})
  const [loading, setLoading] = useState(false)
  const [trigger, setTrigger] = useState(0)
  const key = reservaIds.join(',')

  useEffect(() => {
    if (reservaIds.length === 0) {
      return
    }
    let cancelled = false
    const cargarSaldos = async () => {
      setLoading(true)
      const entries = await Promise.all(
        reservaIds.map((id) =>
          PagosService.obtenerPorReserva(id)
            .then((s) => [id, s] as const)
            .catch(() => [id, null] as const),
        ),
      )
      if (!cancelled) {
        const map: Record<number, SaldoReserva> = {}
        for (const [id, s] of entries) if (s) map[id] = s
        setSaldos(map)
        setLoading(false)
      }
    }
    void cargarSaldos()
    return () => {
      cancelled = true
    }
  }, [key, trigger]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    saldos: reservaIds.length === 0 ? {} : saldos,
    loading: reservaIds.length > 0 && loading,
    refrescar: () => setTrigger((t) => t + 1),
  }
}
