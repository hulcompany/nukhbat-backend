import { Readable } from 'node:stream';

export abstract class FileProvider {
  abstract store(params: {
    data: Buffer | Readable;
    key: string;
  }): Promise<string>;

  abstract generateKey(folder: string, name: string): string;

  abstract exists(path: string): Promise<boolean>;

  abstract delete(key: string): Promise<boolean>;

  abstract buildLink(key: string): Promise<string>;
}
