import Swal from 'sweetalert2'

type Tipo = 'success' | 'error' | 'warning' | 'info'

const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
  customClass: { container: '!z-[9999]' },
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer)
    el.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

export function notificar(mensaje: string, tipo: Tipo = 'info') {
  Toast.fire({ icon: tipo, title: mensaje })
}

/**
 * Hook de notificaciones. Mantiene la API previa (`mostrar` + `AlertComponent`) para no tocar las
 * pantallas que lo consumen, pero ahora delega en un toast de SweetAlert2. `AlertComponent` ya no
 * renderiza nada (SweetAlert se monta solo).
 */
export function useAlert() {
  return { mostrar: notificar, AlertComponent: null }
}

/** Diálogo de confirmación (sí/no) con SweetAlert2. Devuelve true si el usuario confirma. */
export async function confirmar(opts: {
  titulo: string
  texto?: string
  confirmText?: string
  cancelText?: string
  icon?: 'warning' | 'question' | 'error' | 'info'
  danger?: boolean
}): Promise<boolean> {
  const res = await Swal.fire({
    title: opts.titulo,
    text: opts.texto,
    icon: opts.icon ?? 'warning',
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Confirmar',
    cancelButtonText: opts.cancelText ?? 'Cancelar',
    confirmButtonColor: opts.danger ? '#dc2626' : '#059669',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  })
  return res.isConfirmed
}
