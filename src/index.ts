// Register TypeScript Source Maps to show correct file name and line number
// in stack traces
import 'source-map-support/register';

import { promises as fs } from 'fs';
import Debug from 'debug';
const debug = Debug('yedxtract');

import { parseGraphmlFile, getUnits, convertToGraphmlFile } from './graphml';
import { IExtractFields } from './types';

async function test() {
  try {
    const data = await fs.readFile('./data/simple.graphml', 'utf-8');
    const graph = await parseGraphmlFile(data);

    const fieldsToExport: IExtractFields = {
      node: { configuration: ['$', 'configuration'] },
    };
    const fields = getUnits(graph, fieldsToExport);

    debug(fields);

    const xml = convertToGraphmlFile(graph);
    await fs.writeFile('./data/output.graphml', xml, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

test();
