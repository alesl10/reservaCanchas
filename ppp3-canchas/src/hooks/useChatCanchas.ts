import { useRef, useState } from 'react'
import { AuthService, CanchasService, PagosService, ReservasService } from '@/services'
import { useAuth } from '@/context'
import { markdownATextoPlano } from '@/utils'
import type { ChatMensaje, ChatReservaCreada, EstadoAccionChat, MetodoPago } from '@/types'

const SALUDO_INICIAL: ChatMensaje =
{
  rol: 'bot',
  texto:
    '¡Hola! Contame qué cancha buscás (tipo, zona, techada) y qué día y horario: te muestro las más cercanas que estén libres y te ayudo a reservar y pagar la seña desde acá.',
}

interface Coords {
  lat: number
  lng: number
}

export function useChatCanchas() {
  const { sesion, login } = useAuth()
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([SALUDO_INICIAL])
  const [enviando, setEnviando] = useState(false)
  const coordsRef = useRef<Coords | null>(null)
  // Si el usuario rechazó el permiso (o no hay HTTPS) no se vuelve a pedir en cada mensaje.
  const ubicacionDenegadaRef = useRef(false)

  // La ubicación solo mejora el orden por cercanía: si no se puede obtener, el chat sigue sin ella.
  function obtenerUbicacion(): Promise<Coords | null> {
    if (coordsRef.current) return Promise.resolve(coordsRef.current)
    if (ubicacionDenegadaRef.current || !navigator.geolocation) return Promise.resolve(null)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          coordsRef.current = { lat: coords.latitude, lng: coords.longitude }
          resolve(coordsRef.current)
        },
        () => {
          ubicacionDenegadaRef.current = true
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 10000 },
      )
    })
  }

  async function enviar(texto: string) {
    const limpio = texto.trim()
    if (!limpio || enviando) return

    const historial = mensajes.slice(-6).map(({ rol, texto, canchas }) => ({
      rol,
      texto,
      ...(canchas?.length ? { canchas: canchas.map(({ id, nombre }) => ({ id, nombre })) } : {}),
    }))
    setMensajes((m) => [...m, { rol: 'usuario', texto: limpio }])
    setEnviando(true)
    try {
      const coords = await obtenerUbicacion()
      const data = await CanchasService.chat(coords, limpio, historial)
      setMensajes((m) => [
        ...m,
        {
          rol: 'bot',
          texto: markdownATextoPlano(data.respuesta),
          canchas: data.canchas,
          accion: data.accionPendiente ? { ...data.accionPendiente, estado: 'pendiente' } : undefined,
        },
      ])
    } catch (err) {
      setMensajes((m) => [...m, { rol: 'bot', texto: (err as Error).message || 'Uy, algo salió mal. Probá de nuevo.' }])
    } finally {
      setEnviando(false)
    }
  }

  function actualizarAccion(indice: number, estado: EstadoAccionChat, reserva?: ChatReservaCreada) {
    setMensajes((m) =>
      m.map((msg, i) =>
        i === indice && msg.accion
          ? { ...msg, accion: { ...msg.accion, estado, reserva: reserva ?? msg.accion.reserva } }
          : msg,
      ),
    )
  }

  function agregarBot(texto: string) {
    setMensajes((m) => [...m, { rol: 'bot', texto }])
  }

  // El login se resuelve acá, directo contra /auth/login: la contraseña nunca viaja por el
  // endpoint del chat ni llega al modelo. Lanza el error para que el formulario lo muestre.
  async function iniciarSesion(email: string, password: string) {
    const nueva = await AuthService.login(email, password)
    if (nueva.rol !== 'cliente' || !nueva.clienteId) {
      throw new Error('Esa cuenta no es de cliente: para reservar entrá con una cuenta de cliente.')
    }
    login(nueva)
    agregarBot(`¡Hola ${nueva.nombre}! Ya iniciaste sesión: confirmá la reserva con el botón.`)
  }

  // La reserva la crea el usuario con este botón (no el modelo), por el mismo endpoint que el
  // formulario: el backend vuelve a validar horario, disponibilidad y estado del cliente.
  async function confirmarReserva(indice: number) {
    const accion = mensajes[indice]?.accion
    if (!accion || accion.estado !== 'pendiente') return
    if (!sesion?.clienteId) {
      agregarBot('Primero iniciá sesión para confirmar la reserva.')
      return
    }

    actualizarAccion(indice, 'confirmando')
    try {
      const creada = await ReservasService.crear({
        canchaId: accion.canchaId,
        clienteId: sesion.clienteId,
        fecha: accion.fecha,
        horaInicio: accion.horaInicio,
        horaFin: accion.horaFin,
      })
      actualizarAccion(indice, 'reservada', {
        id: creada.id,
        precioTotal: creada.precioTotal,
        senaRequerida: creada.senaRequerida,
      })
      agregarBot('¡Reserva creada! Para confirmarla falta pagar la seña: elegí el método abajo.')
    } catch (err) {
      actualizarAccion(indice, 'pendiente')
      agregarBot(`No pude crear la reserva: ${(err as Error).message || 'probá de nuevo.'}`)
    }
  }

  function descartarReserva(indice: number) {
    actualizarAccion(indice, 'descartada')
    agregarBot('Listo, no reservé nada. ¿Querés probar con otro horario o cancha?')
  }

  // Pago simulado de la seña (mismo endpoint que PagoForm). Al cubrirse la seña, api-pagos
  // confirma la reserva solo.
  async function pagarSena(indice: number, metodo: MetodoPago) {
    const accion = mensajes[indice]?.accion
    const reserva = accion?.reserva
    if (!accion || !reserva || accion.estado !== 'reservada') return

    actualizarAccion(indice, 'pagando')
    try {
      const tipo = reserva.senaRequerida >= reserva.precioTotal ? 'completo' : 'seña'
      await PagosService.registrar(reserva.id, reserva.senaRequerida, metodo, tipo)
      actualizarAccion(indice, 'pagada')
      agregarBot('¡Seña pagada! Tu reserva quedó confirmada. Te espero en la cancha ⚽')
    } catch (err) {
      actualizarAccion(indice, 'reservada')
      agregarBot(`No pude registrar el pago: ${(err as Error).message || 'probá de nuevo.'}`)
    }
  }

  return { mensajes, enviando, enviar, iniciarSesion, confirmarReserva, descartarReserva, pagarSena }
}
