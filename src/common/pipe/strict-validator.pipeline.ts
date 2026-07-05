import { UsePipes, ValidationPipe } from '@nestjs/common';

export function StrictValidation() {
  return UsePipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      whitelist: true,
      transform: true,
    }),
  );
}
