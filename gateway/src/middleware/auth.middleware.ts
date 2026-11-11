import { ForbiddenException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { motivoDenegado } from './authz.policy';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';

const RUTAS_PUBLICAS: { method: string; path: string }[] = [
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/registro' },
  { method: 'GET', path: '/canchas' },
  // Chatbot de búsqueda de canchas en el home, antes de loguearse.
  { method: 'POST', path: '/canchas/chat' },
];

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // El secreto interno lo agrega el proxy del gateway; borramos cualquiera que venga
    // del cliente para que no pueda falsificarlo (igual que con x-cliente-id más abajo).
    delete req.headers['x-internal-secret'];

    // Dejar pasar el preflight CORS (no lleva Authorization); si no, devolveríamos 401.
    if (req.method === 'OPTIONS') return next();

    const esPublica = RUTAS_PUBLICAS.some(
      (r) => r.method === req.method && req.path.startsWith(r.path),
    );

    // Nunca confiamos en la identidad que venga del cliente: se borra siempre y solo se
    // vuelve a inyectar si el token verifica (también en rutas públicas, donde el token
    // es opcional: el chatbot lo usa para saber si puede ofrecer reservar).
    delete req.headers['x-user-id'];
    delete req.headers['x-user-email'];
    delete req.headers['x-user-rol'];
    delete req.headers['x-cliente-id'];

    const authHeader = req.headers['authorization'];
    const tieneToken = !!authHeader?.startsWith('Bearer ');

    if (esPublica && !tieneToken) return next();
    if (!tieneToken) throw new UnauthorizedException('Token no proporcionado');

    const token = authHeader!.replace('Bearer ', '');
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      // En una ruta pública un token vencido no debe romper la búsqueda: sigue como anónimo.
      if (esPublica) return next();
      throw new UnauthorizedException('Token inválido o expirado');
    }

    {
      // Inyectar info del usuario para que los microservicios la reciban
      req.headers['x-user-id'] = String(payload.sub);
      req.headers['x-user-email'] = payload.email;
      req.headers['x-user-rol'] = payload.rol;
      // cliente_id viene del token verificado (los headers entrantes ya se borraron arriba,
      // así que un cliente no puede falsificarlo para ver reservas de otro).
      if (payload.cliente_id != null) {
        req.headers['x-cliente-id'] = String(payload.cliente_id);
      }
      const denegado = motivoDenegado({
        method: req.method,
        path: req.path,
        query: req.query as Record<string, unknown>,
        rol: payload.rol,
        clienteId: payload.cliente_id != null ? String(payload.cliente_id) : undefined,
      });
      if (denegado) throw new ForbiddenException(denegado);
      next();
    }
  }
}
