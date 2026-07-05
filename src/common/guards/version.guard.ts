// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   BadRequestException,
//   HttpVersionNotSupportedException,
//   HttpException,
// } from '@nestjs/common';
// import { SettingsService } from '../../settings/settings.service';
// import { ErrorCommonCodes } from 'core';

// import { SetMetadata } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';

// @Injectable()
// export class ClientVersionGuard implements CanActivate {
//   constructor(
//     private appSettingsService: SettingsService,
//     private reflector: Reflector,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const req = context.switchToHttp().getRequest();
//     const skip = this.reflector.getAllAndOverride<boolean>('skipVersionCheck', [
//       context.getHandler(),
//       context.getClass(),
//     ]);

//     if (skip) return true;
//     const mobile = req.headers['x-mobile-version'];
//     const web = req.headers['x-web-version'];

//     if (!mobile && !web) {
//       throw new BadRequestException(
//         'Client version header missing x-mobile-version | x-web-version',
//       );
//     }

//     if (mobile && web) {
//       throw new BadRequestException('Only one client header allowed');
//     }

//     let settings = await this.appSettingsService.getSettings();

//     if (mobile && !isVersionGte(mobile, settings!.mobileMinVersion)) {
//       throw new HttpException(
//         {
//           message:
//             'Mobile app version too old minimim = ' + settings.mobileMinVersion,
//           code: ErrorCommonCodes.versionNotSupported,
//         },
//         426,
//       );
//     }

//     if (web && !isVersionGte(web, settings.webMinVersion!)) {
//       throw new HttpException(
//         {
//           message: 'web version too old minimum = ' + settings.webMinVersion,
//           code: ErrorCommonCodes.versionNotSupported,
//         },
//         426,
//       );
//     }

//     return true;
//   }
// }

// function isVersionGte(client: string, min: string): boolean {
//   const c = client.split('.').map(Number);
//   const m = min.split('.').map(Number);

//   const length = Math.max(c.length, m.length);

//   for (let i = 0; i < length; i++) {
//     const cv = c[i] || 0;
//     const mv = m[i] || 0;

//     if (cv > mv) return true;
//     if (cv < mv) return false;
//   }

//   return true;
// }

// export const SKIP_VERSION_CHECK = 'skipVersionCheck';
// export const SkipVersionCheck = () => SetMetadata(SKIP_VERSION_CHECK, true);
