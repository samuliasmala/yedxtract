// Register TypeScript Source Maps to show correct file name and line number
// in stack traces
import 'source-map-support/register';

import { promises as fs } from 'fs';
import Debug from 'debug';
const debug = Debug('yedxtract');

import { parseGraphmlFile, getLabels, getFields } from './graphml';
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

    const labels2 = getFields(graph, fieldsToExport);
    debug(labels);
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

test();
