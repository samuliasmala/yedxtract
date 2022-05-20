// Register TypeScript Source Maps to show correct file name and line number
// in stack traces
import 'source-map-support/register';

import { promises as fs } from 'fs';
import Debug from 'debug';
const debug = Debug('yedxtract');

import {
  parseGraphmlFormat,
  getUnitsFromGraph,
  convertToGraphmlFormat,
} from './graphml';
import { createXlsx, importXlsx } from './excel';
import type { IExtractFields } from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testExport() {
  try {
    const data = await fs.readFile('./data/simple.graphml', 'utf-8');
    const graph = await parseGraphmlFormat(data);

    const fieldsToExport: IExtractFields = {
      node: { configuration: ['$', 'configuration'] },
    };
    const units = getUnitsFromGraph(graph, fieldsToExport);

    //const xlsxFile = createXlsx(units, { include: ['id', 'type', 'label'] });
    const xlsxFile = createXlsx(units);

    await fs.writeFile('./data/output.xlsx', xlsxFile);

    //debug(units);

    const xml = convertToGraphmlFormat(graph);
    await fs.writeFile('./data/output.graphml', xml, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

async function testImport() {
  try {
    const data = await fs.readFile('./data/output.xlsx');
    const units = importXlsx(data, { include: ['id', 'label'] });
    debug(units);
    //const xml = convertToGraphmlFormat(graph);
    //await fs.writeFile('./data/output.graphml', xml, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

testImport();
