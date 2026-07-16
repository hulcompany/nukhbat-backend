import {
  Body,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Controller } from '@nestjs/common';
import { UserVerifyDto } from '../dto/user-verify.dto';
import { ForgetPasswordDto } from '../dto/forget-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UserUpdateDto } from '../dto/user-update-dto';
import { JwtGuard, JwtGuardStrict } from '../auth';
import { UserService } from './service/user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageFileValidatorPipeline } from '../../common';
import { Context } from '../../context';
import { RoleType } from '../role/enum/role.type';

@Controller('user')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
export class UserController {
  constructor(
    @Inject() private readonly userService: UserService,
    @Inject() private readonly context: Context,
  ) {}

  @Get('metaData')
  async getMetaData() {
    return {
      roles: Object.values(RoleType),
    };
  }

  @Get('/mine')
  @UseGuards(JwtGuard)
  async getMine() {
    return this.context.user;
  }

  @Post('/mine/request-verify')
  @UseGuards(JwtGuard)
  async requestVerify() {
    return await this.userService.requestVerify(this.context.user.id);
  }

  @Post('/mine/verify')
  @UseGuards(JwtGuard)
  async verify(@Body() body: UserVerifyDto) {
    return await this.userService.verify({
      id: this.context.user.id,
      code: body.code,
    });
  }

  @Post('/mine/forget-password')
  async forgetPassword(@Body() body: ForgetPasswordDto) {
    return await this.userService.requestChangePassword(body);
  }

  @Post('/mine/reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.userService.resetPassword(body);
  }

  @UseGuards(JwtGuardStrict)
  @UseInterceptors(FileInterceptor('image'))
  @Patch('/mine')
  async updateMine(
    @Body() body: UserUpdateDto,
    @UploadedFile(new ImageFileValidatorPipeline(false))
    image?: Express.Multer.File,
  ) {
    return await this.userService.update(this.context.user.id, body, image);
  }

  @UseGuards(JwtGuardStrict)
  @UseInterceptors(FileInterceptor('image'))
  @Delete('/mine/image')
  async deleteMineImage() {
    return await this.userService.update(this.context.user.id, undefined, null);
  }
}
