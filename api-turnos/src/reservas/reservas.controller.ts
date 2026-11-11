import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Headers, ParseIntPipe, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateEstadoReservaDto } from './dto/update-reserva.dto';
import { QueryReservasDto } from './dto/query-reserva.dto';
import { QueryInsightsDto } from './dto/query-insights.dto';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  // Declarada antes de ":id" para que "insights" no se intente parsear como id numérico.
  @Get('insights')
  getInsights(@Query() query: QueryInsightsDto, @Headers('x-user-rol') rol?: string) {
    if (rol !== 'admin') throw new ForbiddenException('Solo el admin puede ver estas estadísticas');
    return this.reservasService.getInsights(query.semanas ?? 6);
  }

  @Get()
  findAll(
    @Query() query: QueryReservasDto,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    // Un cliente solo puede ver SUS reservas: forzamos el filtro con el cliente_id del
    // token (inyectado por el gateway), ignorando cualquier clienteId que venga en la query.
    if (rol === 'cliente') {
      if (!clienteId) throw new ForbiddenException('Tu sesión no tiene un cliente asociado');
      query.clienteId = +clienteId;
    }
    return this.reservasService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    return this.reservasService.findOne(id, this.ownerId(rol, clienteId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateReservaDto,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    // Un cliente solo reserva a su nombre: se ignora el clienteId del body.
    const owner = this.ownerId(rol, clienteId);
    if (owner != null) dto.clienteId = owner;
    return this.reservasService.create(dto);
  }

  // PATCH /reservas/:id — actualizar estado (confirmar, cancelar, completar, no-show)
  @Patch(':id')
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoReservaDto,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    // El cliente solo puede cancelar su reserva; confirmar/completar/no-show es del admin
    // (la confirmación por seña la hace api-pagos, llamada interna sin rol).
    if (rol === 'cliente' && dto.estado !== 'cancelada') {
      throw new ForbiddenException('Solo podés cancelar tus reservas');
    }
    return this.reservasService.updateEstado(id, dto, this.ownerId(rol, clienteId));
  }

  // DELETE /reservas?clienteId=N — borra TODAS las reservas de un cliente (las pendientes y
  // confirmadas se cancelan antes). Lo usa api-usuarios al eliminar un cliente (llamada interna,
  // sin rol) y el admin; un cliente no puede.
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  removePorCliente(
    @Query('clienteId', ParseIntPipe) clienteId: number,
    @Headers('x-user-rol') rol?: string,
  ) {
    if (rol !== undefined && rol !== 'admin') {
      throw new ForbiddenException('Solo un administrador puede eliminar reservas');
    }
    return this.reservasService.removePorCliente(clienteId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-rol') rol?: string,
    @Headers('x-cliente-id') clienteId?: string,
  ) {
    if (rol === 'cliente') throw new ForbiddenException('Solo un administrador puede eliminar reservas');
    return this.reservasService.remove(id, this.ownerId(rol, clienteId));
  }

  // Devuelve el cliente_id (del token) solo si el rol es cliente; para admin → undefined
  // (sin restricción de dueño). Centraliza la regla usada por los endpoints por-id.
  private ownerId(rol?: string, clienteId?: string): number | undefined {
    if (rol !== 'cliente') return undefined;
    // Un cliente sin cliente_id en el token nunca debe caer en el caso "sin restricción".
    if (!clienteId) throw new ForbiddenException('Tu sesión no tiene un cliente asociado');
    return +clienteId;
  }
}
