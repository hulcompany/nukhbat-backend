// import { diskStorage } from 'multer';
// import { Request } from 'express';
// import * as fs from 'fs';
// import * as path from 'path';
//
// export const multerOptions = (folder?: string) => {
//   return {
//     storage: diskStorage({
//       destination: (req: Request, file, cb) => {
//         const uploadPath = folder
//           ? path.join(process.cwd(), 'uploads', folder)
//           : path.join(process.cwd(), 'uploads');
//         fs.mkdirSync(uploadPath, { recursive: true });
//         cb(null, uploadPath);
//       },
//
//       filename: (req, file, cb) => {
//         const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
//         const ext = path.extname(file.originalname);
//         cb(null, `${unique}${ext}`);
//       },
//     }),
//   };
// };
