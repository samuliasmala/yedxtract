import { promises as fs } from 'fs';
import { createHash } from 'crypto';

export async function readFile(filename: string) {
  const data = await fs.readFile(filename, 'utf-8');
  const hash = createHash('md5').update(data, 'utf8').digest('hex');

  return { data, hash };
}
