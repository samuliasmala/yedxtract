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

/**
 *
 * @param inputGraphmlFile - Path to the input graphml file
 * @param outputXlsxFile - Path to the output xlsx file
 * @param [options] - Options object for the export
 * @param [options.fieldsToExport.{node|edge|common}] - The fields which are extracted from the graph for
 * nodes/edges/both (node/edge field is prioritized over common field)
 * @param {string[]} [options.fieldsToExport.{node|edge|common}.<output>] - Path to the property in the graphml file
 * which is used to create the output field. E.g., `color: ['y:Fill', '[0]', '$', 'color']` will extract the node color to
 * the output field `color`.
 * @param [options.columnsToExcel] - The columns which are exported to the xlsx file.
 * @param {string[]} [options.columnsToExcel.{include|exclude}] - The columns which are exported to the xlsx file. If
 * `include` property is set, only those columns are exported. If `include` is `undefined`, then all columns except
 * those in `exclude` are exported.
 * @param [options.postProcess] - Function to post-process selected columns: Post(row: OutputUnit) => OutputUnit | null;
 */
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

/**
 *
 * @param inputGraphmlFile - Path to the input graphml file
 * @param inputXlsxFile - Path to the input xlsx file
 * @param outputGraphmlFile - Path to the output graphml file
 * @param {string[]} [options.fieldsToImport.{include|exclude}] - The excel columns which are imported to the graphql
 * file. If `include` property is set, only those columns are imported. If `include` is `undefined`, then all columns
 * except those in `exclude` are imported. Note: Only fixed fields (source, target, label) and fields present in
 * `extractedFields` row in xlsx Metadata sheet are imported. `id` is used for matching.
 * @param [options.postProcess] - Function to post-process selected columns: Post(row: OutputUnit) => OutputUnit | null;
 */
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
