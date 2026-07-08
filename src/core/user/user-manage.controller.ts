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
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Controller } from '@nestjs/common';
import { UserUpdateDto } from './dto/user-update-dto';
import { UserGetDto } from './dto/user-get.dto';
import { UUID } from 'crypto';
import { UserService } from './service/user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageFileValidatorPipeline } from '../../common';
import { UserMainDto } from './dto/user-main.dto';
import { RoleType } from '../role/enum/role.type';
import { JwtGuardStrict } from '../auth';
import { RoleGuard } from '../guards/role.guard';

@Controller('user')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.admin]))
export class UserManageController {
  constructor(@Inject() private readonly userService: UserService) {}

  @Get('metaData')
  async getMetaData() {
    return {
      roles: Object.values(RoleType),
    };
  }
  @Get('/')
  async get(@Query() query: UserGetDto) {
    return await this.userService.getByCriteria(query);
  }

  // @Post('/')
  // async create(@Body() query: UserMainDto) {
  //   return await this.userService.createUser({
  //     email: query.email,
  //     name: query.name,
  //     password: query.password,
  //     phoneNumber: query.phoneNumber
  //   });
  // }

  @Get('/:id')
  async getById(@Param('id', new ParseUUIDPipe()) params: UUID) {
    return await this.userService.findOneAndFail({ id: params });
  }

  @UseInterceptors(FileInterceptor('image'))
  @Patch('/:id')
  async updateUserById(
    @Param('id', new ParseUUIDPipe()) params: UUID,
    @Body() data: UserUpdateDto,
    @UploadedFile(new ImageFileValidatorPipeline(false))
    image?: Express.Multer.File,
  ) {
    return await this.userService.update(params, data, image);
  }

  @Delete('/:id/image')
  async removeUserImage(@Param('id', new ParseUUIDPipe()) params: UUID) {
    return await this.userService.update(params, undefined, null);
  }
}
