import {
  Body,
  Controller,
  Inject,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { LoginDto, RefreshTokenDto } from '../dto/login.dto';
import { AuthService } from './auth.service';
import { SignUpDto } from '../dto/signup.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AuthController {
  constructor(@Inject() private readonly authService: AuthService) {}

  @Post('/login')
  async login(@Body() params: LoginDto) {
    let res = await this.authService.login(params.email, params.password);
    return res;
  }

  @Post('/signUp')
  async signUp(@Body() params: SignUpDto) {
    let res = await this.authService.signUp(params);
    return res;
  }

  @Post('/refreshToken')
  async refreshToken(@Body() params: RefreshTokenDto) {
    let res = await this.authService.refreshToken(params.token);
    return res;
  }
}
