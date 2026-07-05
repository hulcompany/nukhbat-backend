import {
  Body,
  Controller,
  Inject,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthLoginDto, AuthRefreshTokenDto } from './dto/auth-login.dto';
import { AuthService } from './auth.service';
import { AuthSignUpDto } from './dto/auth-signup.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AuthController {
  constructor(@Inject() private readonly authService: AuthService) {}

  @Post('/login')
  async login(@Body() params: AuthLoginDto) {
    let res = await this.authService.login(params.email, params.password);
    return res;
  }

  @Post('/signUp')
  async signUp(@Body() params: AuthSignUpDto) {
    let res = await this.authService.signUp(params);
    return res;
  }

  @Post('/refreshToken')
  async refreshToken(@Body() params: AuthRefreshTokenDto) {
    let res = await this.authService.refreshToken(params.token);
    return res;
  }
}
