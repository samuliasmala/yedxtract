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
  updateGraph,
} from './graphml';
import { createXlsx, importXlsx } from './excel';
import { readFile } from './file';
import type { IExtractFields, IMetadata } from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testExport() {
  try {
    const filename = 'simple.graphml';
    const { data, hash } = await readFile('./data/' + filename);
    const graph = await parseGraphmlFormat(data);

    const fieldsToExport: IExtractFields = {
      node: { configuration: ['$', 'configuration'] },
    };

    const units = getUnitsFromGraph(graph, fieldsToExport);

    const metadata: IMetadata = {
      yedFilename: filename,
      yedHash: hash,
      extractedFields: fieldsToExport,
    };

    //const xlsxFile = createXlsx(units, metadata, { include: ['id', 'type', 'label'] });
    const xlsxFile = createXlsx(units, metadata);
    console.log(Object.entries(metadata));

    await fs.writeFile('./data/output.xlsx', xlsxFile);

    //debug(units);
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

async function testImport() {
  try {
    // Read imported data
    const xlsxData = await fs.readFile('./data/output.xlsx');
    const { units, metadata } = importXlsx(
      xlsxData /*, { include: ['id', 'label'] }*/
    );
    //debug(units);

    // Read original graph
    const { data, hash } = await readFile('./data/simple.graphml');
    const graph = await parseGraphmlFormat(data);

    // Verify the original graph
    if (hash !== metadata.yedHash)
      debug(
        'Provided graphml file not matching the one used to generate Excel'
      );
    else debug('Provided graphml file is matching the original file');

    // Update and save graph
    const updatedGraph = updateGraph(graph, units, metadata.extractedFields);
    const xml = convertToGraphmlFormat(updatedGraph);
    await fs.writeFile('./data/output.graphml', xml, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error) {
      debug('Error: ' + err.message);
    }
  }
}

//testExport();
testImport();
