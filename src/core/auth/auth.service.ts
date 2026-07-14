import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { comparePassword, ErrorCommonCodes } from 'core';
import { AuthSignUpDto } from './dto/auth-signup.dto';
import { UserService } from '../user/service/user.service';
import { AppConfig } from '../../conf';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async login(email: string, password: string) {
    //mimi
    let user = await this.userService.findOne({ email: email });
    if (!user) {
      throw new BadRequestException({
        code: ErrorCommonCodes.invalidCredentials,
        message: 'Wrong Credentials',
      });
    }
    let res = await comparePassword(user.password || '', password);
    if (!res) {
      throw new BadRequestException({
        code: ErrorCommonCodes.invalidCredentials,
        message: 'Wrong Credentials',
      });
    }
    return this.buildUserResponse(user);
  }

  async signUp(data: AuthSignUpDto) {
    let user = await this.userService.signUp({
      email: data.email,
      name: data.name,
      password: data.password,
      phoneNumber: data.phoneNumber,
    });
    return this.buildUserResponse(user);
  }

  async validate(payload: any) {
    let user = await this.userService.findOne({ id: payload.id });
    if (!user) {
      throw new BadRequestException({
        code: ErrorCommonCodes.invalidJwtToken,
        message: 'Invalid Token',
      });
    }
    return user;
  }

  async refreshToken(token: string) {
    try {
      let payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.REFRESH_TOKEN_KEY,
      });
      let user = await this.userService.findOne({ id: payload.id });
      if (!user) {
        throw new BadRequestException({
          code: ErrorCommonCodes.invalidJwtToken,
          message: 'Invalid Refresh Token',
        });
      }
      return this.buildUserResponse(user);
    } catch (e) {
      throw new BadRequestException({
        code: ErrorCommonCodes.invalidJwtToken,
        message: 'Invalid Refresh Token',
      });
    }
  }

  private buildUserResponse(user: any) {
    return {
      accessToken: this.jwtService.sign(
        { id: user.id, name: user.name },
        {
          secret: process.env.JWT_TOKEN_KEY,
          expiresIn: AppConfig.JWT_TOKEN_AGE,
        },
      ),
      refreshToken: this.jwtService.sign(
        { id: user.id, name: user.name },
        {
          secret: process.env.REFRESH_TOKEN_KEY,
          expiresIn: AppConfig.REFRESH_TOKEN_AGE,
        },
      ),
      user: user,
    };
  }
}
