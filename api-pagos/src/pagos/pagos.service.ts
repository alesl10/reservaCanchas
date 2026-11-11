import {
  Injectable, NotFoundException, BadRequestException,
  InternalServerErrorException, ServiceUnavailableException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Pago } from './entities/pago.entity';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreatePreferenciaDto } from './dto/create-preferencia.dto';
import { MercadoPagoConfig, Preference } from 'mercadopago';

@Injectable()
export class PagosService {
  private readonly turnosUrl = process.env.TURNOS_URL ?? 'http://localhost:3003';
  private readonly frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  constructor(
    @InjectRepository(Pago) private pagoRepo: Repository<Pago>,
    private dataSource: DataSource,
    private httpService: HttpService,
  ) {}

  /** Rol "sin restricción": admin o llamada interna entre servicios (sin x-user-rol). */
  async exigirAdmin(rol?: string) {
    if (rol !== undefined && rol !== 'admin') {
      throw new ForbiddenException('Esta acción es solo para administradores');
    }
  }

  /**
   * Un cliente solo puede operar sobre pagos de sus propias reservas. Se le pregunta a
   * api-turnos (dueño de la reserva) reenviando rol y cliente_id: su GET /reservas/:id
   * responde 403 si la reserva no es del cliente y 404 si no existe.
   */
  async verificarDuenioReserva(reservaId: number, rol?: string, clienteId?: string) {
    if (rol === undefined || rol === 'admin') return;
    if (rol !== 'cliente' || !clienteId) {
      throw new ForbiddenException('No tenés acceso a esta reserva');
    }
    try {
      await firstValueFrom(
        this.httpService.get(`${this.turnosUrl}/reservas/${reservaId}`, {
          headers: { 'x-user-rol': rol, 'x-cliente-id': clienteId },
        }),
      );
    } catch (error) {
      const status = error.response?.status;
      if (status === 403) throw new ForbiddenException('No tenés acceso a esta reserva');
      if (status === 404) throw new NotFoundException(`Reserva ${reservaId} no encontrada`);
      throw new ServiceUnavailableException('No se pudo verificar la reserva');
    }
  }

  async findAll(filtros: { reservaId?: number; tipoPago?: string; metodoPago?: string; limite?: number }) {
    const q = this.pagoRepo.createQueryBuilder('p');

    if (filtros.reservaId)  q.andWhere('p.reservaId = :reservaId',   { reservaId: filtros.reservaId });
    if (filtros.tipoPago)   q.andWhere('p.tipoPago = :tipoPago',     { tipoPago: filtros.tipoPago });
    if (filtros.metodoPago) q.andWhere('p.metodoPago = :metodoPago', { metodoPago: filtros.metodoPago });

    q.orderBy('p.fechaPago', 'DESC');
    if (filtros.limite) q.take(filtros.limite);

    return q.getMany();
  }

  async findOne(id: number) {
    const pago = await this.pagoRepo.findOne({ where: { id } });
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
    return pago;
  }

  async findByReserva(reservaId: number) {
    const pagos = await this.pagoRepo.find({ where: { reservaId }, order: { fechaPago: 'ASC' } });
    const totalPagado = pagos.reduce((sum, p) => sum + +p.monto, 0);

    let saldoPendiente: number | null = null;
    try {
      const { data: reserva } = await firstValueFrom(
        this.httpService.get(`${this.turnosUrl}/reservas/${reservaId}`),
      );
      saldoPendiente = +reserva.precioTotal - totalPagado;
    } catch {
      // Si api-turnos no responde, devolvemos null sin interrumpir
    }

    return { pagos, totalPagado, saldoPendiente };
  }

  async getEstadisticas() {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const porMetodo: any[] = await this.dataSource.query(
      `SELECT
         COUNT(*) AS cantidad,
         SUM(monto) AS total,
         metodo_pago AS "metodoPago"
       FROM pagos
       WHERE fecha_pago >= $1
       GROUP BY metodo_pago`,
      [inicioMes],
    );

    const totalMes = porMetodo.reduce((s, r) => s + +(r?.total ?? 0), 0);

    return { mes: inicioMes.toISOString().slice(0, 7), totalMes, porMetodo };
  }

  async create(dto: CreatePagoDto) {
    // Verificar que la reserva existe y no está cancelada
    let reserva: any;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.turnosUrl}/reservas/${dto.reservaId}`),
      );
      reserva = data;
    } catch (error) {
      if (error.response?.status === 404)
        throw new NotFoundException(`Reserva ${dto.reservaId} no encontrada`);
      throw new ServiceUnavailableException('No se pudo verificar la reserva');
    }

    if (reserva.estado === 'cancelada')
      throw new BadRequestException('No se puede pagar una reserva cancelada');

    let pagoGuardado: Pago;
    try {
      const pago = this.pagoRepo.create(dto);
      pagoGuardado = await this.pagoRepo.save(pago);
    } catch {
      throw new InternalServerErrorException('Error al registrar el pago');
    }

    // Si el total pagado cubre la seña requerida, confirmar la reserva usando su recurso
    // estándar (api-pagos es dueño de los pagos; api-turnos lo es de la reserva).
    const pagosReserva = await this.pagoRepo.find({ where: { reservaId: dto.reservaId } });
    const totalPagado = pagosReserva.reduce((sum, p) => sum + +p.monto, 0);

    if (reserva.estado === 'pendiente' && totalPagado >= +reserva.senaRequerida) {
      await firstValueFrom(
        this.httpService.patch(`${this.turnosUrl}/reservas/${dto.reservaId}`, {
          estado: 'confirmada',
        }),
      ).catch((err) => console.error('Error al confirmar la reserva tras el pago:', err.message));
    }

    return pagoGuardado;
  }

  async crearPreferencia(dto: CreatePreferenciaDto) {
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' });
    const preference = new Preference(client);

    try {
      const response = await preference.create({
        body: {
          items: [
            {
              id: dto.reservaId.toString(),
              title: dto.title,
              quantity: dto.quantity,
              unit_price: dto.unit_price,
            },
          ],
          back_urls: {
            success: `${this.frontendUrl}/pago/exito`,
            failure: `${this.frontendUrl}/pago/fallo`,
            pending: `${this.frontendUrl}/pago/pendiente`,
          },
          auto_return: 'approved',
          external_reference: dto.reservaId.toString(),
        }
      });

      return { preferenceId: response.id };
    } catch (error) {
      console.error('Error creando preferencia en MercadoPago', error);
      throw new InternalServerErrorException('Error creando preferencia de pago');
    }
  }
}
