// import {
//   Controller,
//   Query,
//   UseGuards,
//   UsePipes,
//   ValidationPipe,
// } from '@nestjs/common';
// // import { JwtGuard } from '../../auth';
// import { CourseService } from './course.service';
// import { CourseGetDto } from './dto/course.dto';
// import { JwtGuard } from '../../core/auth';

// @Controller('learning/course')
// @UsePipes(
//   new ValidationPipe({
//     transform: true,
//     forbidNonWhitelisted: true,
//     whitelist: true,
//   }),
// )
// @UseGuards(JwtGuard)
// export class CourseController {
//   constructor(private courseService: CourseService) {}

//   async getAll(@Query() params: CourseGetDto) {
//     return this.courseService.find(params);
//   }
// }
