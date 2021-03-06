import { read, write, utils } from 'xlsx';
import Debug from 'debug';
const debug = Debug('yedxtract:excel');

import { ImportOptions, Metadata, OutputUnit, XlsxOptions } from './types';
import { LIB_VERSION } from './version';

type ExcelCellValue = string | number | boolean | Date | null | undefined;
type ExcelRow = Record<string, ExcelCellValue>;
type ExcelColumn = [string, number];

export function createXlsx(
  units: OutputUnit[],
  metadata: Metadata,
  options: XlsxOptions = {}
) {
  debug(`Creating Excel file (${units.length} rows)`);

  const rows: ExcelRow[] = units.map(unit => {
    const { fields, data, ...rest } = unit;
    const allFields: Record<string, string | null> = {
      ...fields,
      ...rest,
    };

    const allProperties = Object.keys(allFields);
    const includedProperties = filterProperties(allProperties, options);

    return Object.fromEntries(
      includedProperties.map(prop => [prop, allFields[prop]])
    );
  });

  // Default columns and their sizes in order
  const DEFAULT_COLUMN_WIDTH = 10;
  const DEFAULT_COLUMNS: ExcelColumn[] = [
    ['type', 6],
    ['id', 6],
    ['source', 6],
    ['target', 6],
    ['unitType', 15],
    ['label', 30],
  ];

  // Get all columns present in data
  const columnsPresent = getAllColumnNames(rows);

  const defaultColumnsPresent = DEFAULT_COLUMNS.filter(c =>
    columnsPresent.includes(c[0])
  );

  const otherColumnsPresent = columnsPresent
    .filter(c => DEFAULT_COLUMNS.every(dc => dc[0] !== c))
    .map(c => [c, DEFAULT_COLUMN_WIDTH] as ExcelColumn);

  const columnsWithWidths = [...defaultColumnsPresent, ...otherColumnsPresent];
  const header = columnsWithWidths.map(c => c[0]);

  const ws = utils.json_to_sheet(rows, { header });

  ws['!cols'] = columnsWithWidths.map(col => ({
    // For some reason column width is 0.7 less when viewed from Excel
    width: col[1] + 0.7,
  }));

  const wsMetadata = utils.aoa_to_sheet(
    Object.entries({
      // Use fixed version number for tests, otherwise would need to generate
      // a new Excel file for every release to pass the test
      yedxtractVersion: process.env.NODE_ENV !== 'test' ? LIB_VERSION : 'test',
      yedFilename: metadata.yedFilename,
      yedHash: metadata.yedHash,
      extractedFields: JSON.stringify(metadata.extractedFields),
    })
  );

  wsMetadata['!cols'] = [15, 45].map(col => ({ width: col + 0.7 }));

  const wb = {
    SheetNames: ['Content', 'Metadata'],
    Sheets: { Content: ws, Metadata: wsMetadata },
  };

  const xlsxBuffer = write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  }) as Buffer;

  return xlsxBuffer;
}
/**
 * Import file Excel to update yEd values. Note that empty cells are skipped. If
 * you want to set empty string to a node or edge, set corresponding Excel cell
 * to #NULL!
 * @param xlsx - Excel file contents
 * @param options - Options object to define imported fields
 * @returns List of values for nodes and edges
 */
export function importXlsx(xlsx: Buffer, options?: ImportOptions) {
  if (options === undefined) options = {};

  debug('Importing Excel file');
  const workbook = read(xlsx);

  const wsMetadata = workbook.Sheets['Metadata'];
  if (wsMetadata === undefined) {
    debug('"Metadata"-sheet not present');
    throw new Error('"Metadata"-sheet not present');
  }
  const metadata = Object.fromEntries(
    utils.sheet_to_json(wsMetadata, { header: 1 })
  );

  metadata.extractedFields = JSON.parse(metadata.extractedFields);

  if (!instanceOfMetadata(metadata)) throw new Error('Invalid metadata sheet');

  const worksheet = workbook.Sheets['Content'];
  if (worksheet === undefined) {
    debug('"Graphml"-sheet not present');
    throw new Error('"Graphml"-sheet not present');
  }

  const rows: ExcelRow[] = utils.sheet_to_json(worksheet);

  // Get all columns present in data
  const columnsPresent = getAllColumnNames(rows);
  const includedColumns = filterProperties(
    columnsPresent,
    options?.fieldsToImport ?? {}
  );

  // Convert to IOutputUnit
  let units = rows.map(row => {
    // Filter out columns not in `includedColumns`
    const filteredCols = Object.fromEntries(
      Object.entries(row).filter(([key]) => includedColumns.includes(key))
    );

    const { id, type, source, target, validated } = validateRow(filteredCols);
    const { unitType, label, ...fields } = validated;

    const unit: OutputUnit = {
      id,
      type,
      source,
      target,
      unitType,
      label,
      fields,
    };

    removeUndefined(unit);

    return unit;
  });

  const { postProcess } = options;
  if (typeof postProcess === 'function') {
    debug('Postprocessing excel units');
    units = units.reduce<OutputUnit[]>((acc, unit) => {
      const postProcessedUnit = postProcess(unit);
      if (postProcessedUnit != null) acc.push(postProcessedUnit);
      return acc;
    }, []);
  }

  return { units, metadata };
}

function filterProperties(properties: string[], options: XlsxOptions = {}) {
  return options.include
    ? properties.filter(f => options.include?.includes(f))
    : options.exclude
    ? properties.filter(f => !options.exclude?.includes(f))
    : properties;
}

function getAllColumnNames(rows: ExcelRow[]) {
  return [...new Set(rows.map(row => Object.keys(row)).flat())];
}

function validateRow(row: ExcelRow) {
  const { id, type, source, target, ...rest } = row;

  if (typeof id !== 'string') throw new Error('Mandatory id column is missing');

  if (type !== 'node' && type !== 'edge' && id[0] !== 'n' && id[0] !== 'e')
    throw new Error(
      'Type column is missing and not possible to deduce type from id'
    );
  const deducedType: 'node' | 'edge' =
    type === 'node' || id[0] === 'n' ? 'node' : 'edge';

  if (typeof source !== 'string' && source !== undefined)
    throw new Error('Invalid source column type, must be string or undefined');

  if (typeof target !== 'string' && target !== undefined)
    throw new Error('Invalid target column type, must be string or undefined');

  const validated: Record<string, string | null> = {};

  for (const field in rest) {
    const val = rest[field];
    if (typeof val !== 'string' && val !== null)
      throw new Error(`Invalid type in ${field} column`);
    validated[field] = val;
  }

  return {
    id,
    type: deducedType,
    source,
    target,
    validated,
  };
}

function removeUndefined(obj: OutputUnit) {
  const keys = Object.keys(obj) as Array<keyof typeof obj>;
  keys.forEach(key => obj[key] === undefined && delete obj[key]);
}

function instanceOfMetadata(obj: unknown): obj is Metadata {
  if (typeof obj !== 'object' || obj === null) return false;
  // obj is now type object
  return (
    'yedxtractVersion' in obj &&
    'yedFilename' in obj &&
    'yedHash' in obj &&
    'extractedFields' in obj
  );
}
