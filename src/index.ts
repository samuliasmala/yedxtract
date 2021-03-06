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

import type { ExportOptions, ImportOptions, Metadata } from './types';

export async function exportExcel(
  inputGraphmlFile: string,
  options?: ExportOptions
) {
  debug(`Exporting ${inputGraphmlFile}`);
  const filename = inputGraphmlFile.split('/').pop();
  if (filename === undefined) throw new Error('Invalid filename');

  const { data, hash } = await readFile(inputGraphmlFile);
  const graph = await parseGraphmlFormat(data);

  const units = getUnitsFromGraph(graph, options);

  const metadata: Metadata = {
    yedFilename: filename,
    yedHash: hash,
    extractedFields: options?.fieldsToExport ?? {},
  };

  const xlsxFile = createXlsx(units, metadata, options?.columnsToExcel);
  return xlsxFile;
}

export async function exportExcelFile(
  inputGraphmlFile: string,
  outputXlsxFile: string,
  options?: ExportOptions
) {
  const xlsxFile = await exportExcel(inputGraphmlFile, options);
  debug(`Saving export to ${outputXlsxFile}`);
  await fs.writeFile(outputXlsxFile, xlsxFile);
}

export async function importExcel(
  inputGraphmlFile: string,
  inputXlsxFile: string,
  options?: ImportOptions
) {
  debug(`Importing ${inputXlsxFile}`);
  // Read imported data
  const xlsxData = await fs.readFile(inputXlsxFile);
  const { units, metadata } = importXlsx(xlsxData, options);

  // Read original graph
  const { data, hash } = await readFile(inputGraphmlFile);

  // Verify the original graph
  if (hash !== metadata.yedHash)
    console.warn(
      'Provided graphml file not matching the one used to generate xlsx file'
    );

  const graph = await parseGraphmlFormat(data);

  // Update and save graph
  const updatedGraph = updateGraph(graph, units, metadata.extractedFields);
  const xml = convertToGraphmlFormat(updatedGraph);
  return xml;
}

export async function importExcelFile(
  inputGraphmlFile: string,
  inputXlsxFile: string,
  outputGraphmlFile: string,
  options?: ImportOptions
) {
  const xml = await importExcel(inputGraphmlFile, inputXlsxFile, options);
  debug(`Saving import to ${outputGraphmlFile}`);
  await fs.writeFile(outputGraphmlFile, xml, 'utf-8');
}
