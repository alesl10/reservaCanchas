// Política de autorización por rol, aplicada en el gateway (único punto de entrada).
// Reglas de "dueño" que requieren datos de otro servicio (p. ej. que una reserva pertenezca
// al cliente) las resuelve el microservicio dueño del dato; acá solo se corta lo que se
// puede decidir con rol + id de cliente del token.

export interface PeticionAuthz {
  method: string;
  path: string;
  query: Record<string, unknown>;
  rol?: string;
  clienteId?: string;
}

/** Devuelve un mensaje de error si la petición no está permitida, o null si pasa. */
export function motivoDenegado(p: PeticionAuthz): string | null {
  if (p.rol === 'admin') return null;

  const seg = p.path.split('/').filter(Boolean);
  const recurso = seg[0];
  const metodo = p.method.toUpperCase();
  const soloAdmin = 'Esta acción es solo para administradores';

  switch (recurso) {
    case 'canchas':
      // Lectura pública; el chat es público; el resto (alta/edición/baja) es de admin.
      if (metodo === 'GET') return null;
      if (metodo === 'POST' && seg[1] === 'chat') return null;
      return soloAdmin;

    case 'clientes': {
      // Un cliente solo puede ver/editar SU propio perfil (GET/PUT /clientes/:id[/...]).
      const id = seg[1];
      const esPropio = !!id && !!p.clienteId && id === p.clienteId;
      if (esPropio && (metodo === 'GET' || (metodo === 'PUT' && seg.length === 2))) return null;
      return esPropio ? soloAdmin : 'No tenés acceso a este cliente';
    }

    case 'pagos': {
      // Listados globales, estadísticas y pago por id: solo admin.
      // El cliente solo consulta los pagos de una reserva (el dueño se verifica en api-pagos)
      // y registra pagos sobre sus reservas.
      if (metodo === 'GET' && seg.length === 1 && p.query['reservaId']) return null;
      if (metodo === 'POST') return null;
      return soloAdmin;
    }

    case 'reservas':
      // Dueño y transiciones de estado permitidas se validan en api-turnos.
      return null;

    default:
      return null;
  }
}
