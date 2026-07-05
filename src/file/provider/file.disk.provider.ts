import { Readable } from 'stream';
import { FileProvider } from './file.provider';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import { dirname } from 'node:path';

export class FileDiskProvider extends FileProvider {
  ROOT = process.env.FILE_STORE!;

  generateKey(folder: string, name: string) {
    const ext = extname(name);
    const filename = `${uuidv4()}${ext}`;
    return join(folder, filename);
  }

  async exists(path: string) {
    try {
      await fs.access(await this.buildLink(path));
      return true;
    } catch {
      return false;
    }
  }

  async store(params: {
    data: Buffer | Readable;
    key: string;
  }): Promise<string> {
    let path = await this.buildLink(params.key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, params.data);
    return path;
  }

  async delete(key: string): Promise<boolean> {
    try {
      let path = await this.buildLink(key);
      if (await this.exists(key)) {
        await fs.unlink(path);
      }
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
  async buildLink(key: string): Promise<string> {
    return join(this.ROOT, key);
  }
}
