import {
  Controller, Get, Post, Body, Param, Query, Headers, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreatePreferenciaDto } from './dto/create-preferencia.dto';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  // El gateway ya filtra por rol (los listados globales son de admin); acá se valida que un
  // cliente solo toque pagos de SUS reservas (el dueño de la reserva es api-turnos).
  @Get()
  async findAll(
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
    @Query('reservaId') reservaId?: string,
    @Query('tipoPago') tipoPago?: string,
    @Query('metodoPago') metodoPago?: string,
    @Query('limite') limite?: string,
  ) {
    // Filtrar por reserva incluye el saldo pendiente de esa reserva.
    if (reservaId) {
      await this.pagosService.verificarDuenioReserva(+reservaId, rol, clienteId);
      return this.pagosService.findByReserva(+reservaId);
    }
    await this.pagosService.exigirAdmin(rol);
    return this.pagosService.findAll({
      tipoPago,
      metodoPago,
      limite: limite ? +limite : undefined,
    });
  }

  @Get('estadisticas')
  async getEstadisticas(@Headers('x-user-rol') rol?: string) {
    await this.pagosService.exigirAdmin(rol);
    return this.pagosService.getEstadisticas();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Headers('x-user-rol') rol?: string) {
    await this.pagosService.exigirAdmin(rol);
    return this.pagosService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePagoDto,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    await this.pagosService.verificarDuenioReserva(dto.reservaId, rol, clienteId);
    return this.pagosService.create(dto);
  }

  @Post('preferencias')
  @HttpCode(HttpStatus.CREATED)
  async crearPreferencia(
    @Body() dto: CreatePreferenciaDto,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    await this.pagosService.verificarDuenioReserva(dto.reservaId, rol, clienteId);
    return this.pagosService.crearPreferencia(dto);
  }
}
