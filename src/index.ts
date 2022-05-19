// Register TypeScript Source Maps to show correct file name and line number
// in stack traces
import 'source-map-support/register';

import { promises as fs } from 'fs';
import Debug from 'debug';
const debug = Debug('yedxtract');

import {
  parseGraphmlFile,
  getLabels,
  getFields,
  convertToGraphmlFile,
} from './graphml';
import { IExportedFields } from './types';

async function test() {
  try {
    const data = await fs.readFile('./data/simple.graphml', 'utf-8');
    const graph = await parseGraphmlFile(data);
    const labels = getLabels(graph);

    const fieldsToExport: IExportedFields = {
      common: { configuration: ['$', 'configuration'] },
      node: { label: ['y:NodeLabel', '[0]', '_'] },
      edge: { label: ['y:EdgeLabel', '[0]', '_'] },
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fields = getFields(graph, fieldsToExport);

    debug(labels);
    const xml = convertToGraphmlFile(graph);
    await fs.writeFile('./data/output.graphml', xml, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

test();
