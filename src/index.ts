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

import type { IExportOptions, IMetadata, IXlsxOptions } from './types';

export async function exportExcel(
  inputGraphmlFile: string,
  options?: IExportOptions
) {
  debug(`Exporting ${inputGraphmlFile}`);
  const filename = inputGraphmlFile.split('/').pop();
  if (filename === undefined) throw new Error('Invalid filename');

  const { data, hash } = await readFile(inputGraphmlFile);
  const graph = await parseGraphmlFormat(data);

  const units = getUnitsFromGraph(graph, options);

  const metadata: IMetadata = {
    yedFilename: filename,
    yedHash: hash,
    extractedFields: options?.fieldsToExport ?? {},
  };

  const xlsxFile = createXlsx(units, metadata);
  return xlsxFile;
}

export async function exportExcelFile(
  inputGraphmlFile: string,
  outputXlsxFile: string,
  options?: IExportOptions
) {
  const xlsxFile = await exportExcel(inputGraphmlFile, options);
  debug(`Saving export to ${outputXlsxFile}`);
  await fs.writeFile(outputXlsxFile, xlsxFile);
}

export async function importExcel(
  inputGraphmlFile: string,
  inputXlsxFile: string,
  fieldsToImport?: IXlsxOptions
) {
  debug(`Importing ${inputXlsxFile}`);
  // Read imported data
  const xlsxData = await fs.readFile(inputXlsxFile);
  const { units, metadata } = importXlsx(xlsxData, fieldsToImport);

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
  fieldsToImport?: IXlsxOptions
) {
  const xml = await importExcel(
    inputGraphmlFile,
    inputXlsxFile,
    fieldsToImport
  );
  debug(`Saving import to ${outputGraphmlFile}`);
  await fs.writeFile(outputGraphmlFile, xml, 'utf-8');
}
