import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
  InternalServerErrorException, ServiceUnavailableException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Reserva } from './entities/reserva.entity';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateEstadoReservaDto } from './dto/update-reserva.dto';
import { GeminiService } from './gemini.service';
import { NotificacionesClient } from './notificaciones.client';

const HORA_APERTURA = '08:00';
const HORA_CIERRE = '23:00';

function toMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class ReservasService {
  private readonly usuariosUrl = process.env.USUARIOS_URL ?? 'http://localhost:3001';
  private readonly canchasUrl  = process.env.CANCHAS_URL  ?? 'http://localhost:3002';

  constructor(
    @InjectRepository(Reserva) private reservaRepo: Repository<Reserva>,
    private dataSource: DataSource,
    private httpService: HttpService,
    private geminiService: GeminiService,
    private notificaciones: NotificacionesClient,
  ) {}

  async findAll(filtros: {
    fecha?: string;
    desde?: string;
    canchaId?: number;
    clienteId?: number;
    estado?: string;
    limite?: number;
  }) {
    const q = this.reservaRepo.createQueryBuilder('r');

    if (filtros.fecha)     q.andWhere('r.fecha = :fecha',        { fecha: filtros.fecha });
    if (filtros.desde)     q.andWhere('r.fecha >= :desde',       { desde: filtros.desde });
    if (filtros.canchaId)  q.andWhere('r.canchaId = :canchaId',  { canchaId: filtros.canchaId });
    if (filtros.clienteId) q.andWhere('r.clienteId = :clienteId',{ clienteId: filtros.clienteId });
    if (filtros.estado)    q.andWhere('r.estado = :estado',      { estado: filtros.estado });

    q.orderBy('r.fecha', 'DESC').addOrderBy('r.horaInicio', 'ASC');
    if (filtros.limite) q.take(filtros.limite);

    return q.getMany();
  }

  async findOne(id: number, ownerClienteId?: number) {
    const reserva = await this.reservaRepo.findOne({ where: { id } });
    if (!reserva) throw new NotFoundException(`Reserva ${id} no encontrada`);
    // Si se pasa ownerClienteId (rol cliente), la reserva debe pertenecerle.
    if (ownerClienteId != null && reserva.clienteId !== ownerClienteId) {
      throw new ForbiddenException('No tenés acceso a esta reserva');
    }
    return reserva;
  }

  async getDisponibilidad(canchaId: number, fecha: string) {
    const reservasActivas = await this.reservaRepo.find({
      where: { canchaId, fecha, estado: 'pendiente' },
    });

    const reservasConfirmadas = await this.reservaRepo.find({
      where: { canchaId, fecha, estado: 'confirmada' },
    });

    const ocupados = [...reservasActivas, ...reservasConfirmadas].map((r) => ({
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      estado: r.estado,
    }));

    return { canchaId, fecha, ocupados };
  }

  async create(dto: CreateReservaDto) {
    this.validarHorario(dto.horaInicio, dto.horaFin);
    await this.validarCancha(dto.canchaId);
    // Chequeo temprano (barato) para fallar rápido; el definitivo corre dentro de la
    // transacción con lock, justo antes de guardar.
    await this.validarDisponibilidad(dto.canchaId, dto.fecha, dto.horaInicio, dto.horaFin);
    await this.validarCliente(dto.clienteId);

    const { precioTotal, descuento, senaRequerida } = await this.calcularPrecio(
      dto.canchaId,
      dto.clienteId,
      dto.horaInicio,
      dto.horaFin,
    );

    let guardada: Reserva;
    try {
      // Verificar disponibilidad + insertar deben ser atómicos: sin esto, dos solicitudes
      // simultáneas pasan ambas el chequeo y terminan superpuestas. El advisory lock
      // (por cancha y día) serializa las altas del mismo turno; la restricción EXCLUDE de
      // la BD (database/schema.sql) es la garantía final aunque el lock se saltee.
      guardada = await this.dataSource.transaction(async (manager) => {
        const dia = Math.floor(Date.parse(`${dto.fecha}T00:00:00Z`) / 86_400_000);
        await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [dto.canchaId, dia]);
        await this.validarDisponibilidad(dto.canchaId, dto.fecha, dto.horaInicio, dto.horaFin, manager);

        const repo = manager.getRepository(Reserva);
        return repo.save(
          repo.create({
            canchaId: dto.canchaId,
            clienteId: dto.clienteId,
            fecha: dto.fecha,
            horaInicio: dto.horaInicio,
            horaFin: dto.horaFin,
            precioTotal,
            descuentoAplicado: descuento,
            senaRequerida,
            observaciones: dto.observaciones,
          }),
        );
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // 23P01 = exclusion_violation (la restricción de la BD frenó un solapamiento).
      if ((error as { code?: string })?.code === '23P01') {
        throw new ConflictException('La cancha ya está reservada en ese horario');
      }
      throw new InternalServerErrorException('Error al crear la reserva');
    }
    // Fuera del try: un fallo al avisar no puede convertirse en "Error al crear la reserva".
    this.notificaciones.notificar('creada', guardada);
    return guardada;
  }

  async updateEstado(id: number, dto: UpdateEstadoReservaDto, ownerClienteId?: number) {
    const reserva = await this.findOne(id, ownerClienteId);

    if (dto.estado === 'cancelada') {
      reserva.fechaCancelacion = new Date();
      reserva.razonCancelacion = dto.razonCancelacion ?? null;
    }

    // Los efectos sobre el cliente (no_shows, total_reservas) NO se sincronizan: se derivan
    // de las reservas vía GET /clientes/:id/estadisticas (api-usuarios consulta api-turnos).
    const estadoAnterior = reserva.estado;
    reserva.estado = dto.estado;
    const guardada = await this.reservaRepo.save(reserva);

    // Solo se avisa si el estado cambió de verdad (un PATCH repetido no manda mails de nuevo).
    if (estadoAnterior !== dto.estado && (dto.estado === 'confirmada' || dto.estado === 'cancelada')) {
      this.notificaciones.notificar(dto.estado, guardada);
    }
    return guardada;
  }

  async remove(id: number, ownerClienteId?: number) {
    await this.findOne(id, ownerClienteId);
    await this.reservaRepo.delete(id);
  }

  // -----------------------------------------------
  // Validaciones (antes eran triggers en Supabase)
  // -----------------------------------------------

  private validarHorario(horaInicio: string, horaFin: string) {
    const inicio = toMinutos(horaInicio);
    const fin = toMinutos(horaFin);
    const apertura = toMinutos(HORA_APERTURA);
    const cierre = toMinutos(HORA_CIERRE);
    const duracionMaxima = +(process.env.DURACION_MAXIMA_HORAS ?? 3) * 60;

    if (fin <= inicio) throw new BadRequestException('horaFin debe ser posterior a horaInicio');
    if (fin - inicio < 60) throw new BadRequestException('Duración mínima: 1 hora');
    if (fin - inicio > duracionMaxima) throw new BadRequestException(`Duración máxima: ${duracionMaxima / 60} horas`);
    if (inicio < apertura) throw new BadRequestException(`Horario de apertura: ${HORA_APERTURA}`);
    if (fin > cierre) throw new BadRequestException(`Horario de cierre: ${HORA_CIERRE}`);
  }

  private async validarDisponibilidad(
    canchaId: number, fecha: string, horaInicio: string, horaFin: string, manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Reserva) : this.reservaRepo;
    const conflicto = await repo
      .createQueryBuilder('r')
      .where('r.canchaId = :canchaId', { canchaId })
      .andWhere('r.fecha = :fecha', { fecha })
      .andWhere('r.estado IN (:...estados)', { estados: ['pendiente', 'confirmada'] })
      .andWhere('r.horaInicio < :horaFin AND r.horaFin > :horaInicio', { horaInicio, horaFin })
      .getOne();

    if (conflicto) throw new ConflictException('La cancha ya está reservada en ese horario');
  }

  private async validarCliente(clienteId: number) {
    let cliente: any;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.usuariosUrl}/clientes/${clienteId}`),
      );
      cliente = data;
    } catch (error) {
      if (error.response?.status === 404) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
      throw new ServiceUnavailableException('No se pudo validar el cliente');
    }
    if (cliente.estado === 'bloqueado' || cliente.estado === 'suspendido') {
      throw new BadRequestException(`El cliente está ${cliente.estado} y no puede realizar reservas`);
    }

    // Auto-bloqueo por no-shows: la regla se evalúa aquí porque api-turnos es dueño de las
    // reservas (en vez de duplicar un contador no_shows en el cliente).
    const [configRows]: any[] = await this.dataSource.query(
      "SELECT valor FROM configuraciones WHERE clave = 'max_no_shows_bloqueo'",
    );
    const configData = configRows?.[0] ?? configRows;
    const maxNoShows = +(configData?.valor ?? 3);

    const { cantidad } = await this.reservaRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'cantidad')
      .where('r.clienteId = :clienteId', { clienteId })
      .andWhere("r.estado = 'no_show'")
      .getRawOne();

    if (+cantidad >= maxNoShows) {
      throw new BadRequestException(
        `El cliente alcanzó el máximo de ${maxNoShows} no-shows y no puede realizar reservas`,
      );
    }
  }

  private async validarCancha(canchaId: number) {
    let cancha: any;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.canchasUrl}/canchas/${canchaId}`),
      );
      cancha = data;
    } catch (error) {
      if (error.response?.status === 404) throw new NotFoundException(`Cancha ${canchaId} no encontrada`);
      throw new ServiceUnavailableException('No se pudo validar la cancha');
    }
    if (cancha.estado !== 'disponible') {
      throw new BadRequestException(`La cancha está ${cancha.estado} y no admite reservas`);
    }
  }

  private async calcularPrecio(canchaId: number, clienteId: number, horaInicio: string, horaFin: string) {
    let cancha: any;
    let descuento = 0;

    try {
      const [canchaRes, descuentoRes] = await Promise.all([
        firstValueFrom(this.httpService.get(`${this.canchasUrl}/canchas/${canchaId}`)),
        firstValueFrom(this.httpService.get(`${this.usuariosUrl}/clientes/${clienteId}/descuento`)),
      ]);
      cancha = canchaRes.data;
      descuento = +descuentoRes.data.descuentoPorcentaje;
    } catch (error) {
      if (error.response?.status === 404) throw new NotFoundException('Cancha o cliente no encontrado');
      throw new ServiceUnavailableException('No se pudo calcular el precio');
    }

    const duracionHoras = (toMinutos(horaFin) - toMinutos(horaInicio)) / 60;
    const precioBase = +cancha.precioPorHora * duracionHoras;
    const precioTotal = Math.round(precioBase * (1 - descuento / 100) * 100) / 100;

    const [configRows]: any[] = await this.dataSource.query(
      "SELECT valor FROM configuraciones WHERE clave = 'sena_porcentaje'",
    );
    const configData = configRows?.[0] ?? configRows;
    const senaPorcentaje = +(configData?.valor ?? process.env.SENA_PORCENTAJE_DEFAULT ?? 30);
    const senaRequerida = Math.round(precioTotal * senaPorcentaje / 100 * 100) / 100;

    return { precioTotal, descuento, senaRequerida };
  }

  /**
   * Tendencia de reservas por semana (lunes a domingo) para el dashboard de admin, con
   * comparación cancha por cancha de esta semana vs. la anterior. Si hay GEMINI_API_KEY
   * configurada, suma un resumen en texto generado a partir de esos mismos números; si
   * Gemini falla o no está configurado, devuelve igual los números (sin el resumen).
   */
  async getInsights(semanas: number) {
    const porSemana: { semana: string; cantidad: number }[] = await this.dataSource.query(
      `SELECT date_trunc('week', fecha)::date::text AS semana, COUNT(*)::int AS cantidad
       FROM reservas
       WHERE estado <> 'cancelada'
         AND fecha >= (date_trunc('week', CURRENT_DATE) - $1::int * interval '7 days')
       GROUP BY 1
       ORDER BY 1`,
      [semanas - 1],
    );

    const porCanchaRaw: { canchaId: number; actual: number; anterior: number }[] = await this.dataSource.query(
      `SELECT cancha_id AS "canchaId",
         COUNT(*) FILTER (WHERE date_trunc('week', fecha) = date_trunc('week', CURRENT_DATE))::int AS actual,
         COUNT(*) FILTER (WHERE date_trunc('week', fecha) = date_trunc('week', CURRENT_DATE) - interval '7 days')::int AS anterior
       FROM reservas
       WHERE estado <> 'cancelada'
         AND fecha >= (date_trunc('week', CURRENT_DATE) - interval '7 days')
       GROUP BY cancha_id`,
    );

    const nombresPorCancha = await this.mapaNombresCanchas();
    const porCancha = porCanchaRaw
      .map((c) => ({ ...c, nombre: nombresPorCancha.get(c.canchaId) ?? `Cancha ${c.canchaId}` }))
      .sort((a, b) => b.actual - a.actual);

    const totalActual = porCancha.reduce((s, c) => s + c.actual, 0);
    const totalAnterior = porCancha.reduce((s, c) => s + c.anterior, 0);
    const variacionPorcentual =
      totalAnterior > 0
        ? Math.round(((totalActual - totalAnterior) / totalAnterior) * 100)
        : totalActual > 0 ? 100 : 0;

    const resultado = { porSemana, porCancha, totalActual, totalAnterior, variacionPorcentual };

    const prompt = `Sos un asistente que ayuda a un administrador de un complejo de canchas de fútbol
a interpretar la evolución de sus reservas.

Reservas no canceladas por semana (lunes a domingo), de más vieja a más nueva:
${JSON.stringify(porSemana)}

Comparación por cancha, semana actual vs. semana anterior:
${JSON.stringify(porCancha)}

Total esta semana: ${totalActual}. Total semana anterior: ${totalAnterior}. Variación: ${variacionPorcentual}%.

Escribí un resumen de 2 a 3 oraciones en español (tono profesional y directo, para un dashboard de
administración) que diga si las reservas subieron o bajaron en general, y si hay alguna cancha con un
cambio notable la nombra. No inventes datos que no estén en los números de arriba. Devolvé solo el
texto del resumen, sin comillas ni formato adicional.`;

    const resumen = await this.geminiService.generarTexto(prompt);
    return { ...resultado, resumen, generadoConIa: !!resumen };
  }

  private async mapaNombresCanchas(): Promise<Map<number, string>> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ id: number; nombre: string }[]>(`${this.canchasUrl}/canchas`),
      );
      return new Map(data.map((c) => [c.id, c.nombre]));
    } catch {
      return new Map();
    }
  }
}
