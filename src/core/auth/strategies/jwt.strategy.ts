import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { User } from '../../user/entity/user.entity';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_TOKEN_KEY!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any): Promise<User> {
    let user = await this.authService.validate(payload);
    if (user) {
      if (!req.context) {
        req.context = {};
      }
      req.context.user = user;
    }
    return user;
  }
}
