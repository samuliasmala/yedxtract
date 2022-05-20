import { write, utils } from 'xlsx';
import Debug from 'debug';
const debug = Debug('yedxtract:excel');

import { IOutputUnit, IXlsxOptions } from './types';

type ExcelCellValue = string | number | boolean | Date | null | undefined;
type ExcelRow = Record<string, ExcelCellValue>;
type ExcelColumn = [string, number];

export function createXlsx(units: IOutputUnit[], options: IXlsxOptions = {}) {
  debug(`Creating Excel file (${units.length} rows)`);

  const rows: ExcelRow[] = units.map(unit => {
    const { fields, ...rest } = unit;
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
  const columnsPresent = [...new Set(rows.map(row => Object.keys(row)).flat())];

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

  const wb = { SheetNames: ['Graphml'], Sheets: { ['Graphml']: ws } };
  const xlsxBuffer = write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  }) as Buffer;

  return xlsxBuffer;
}

function filterProperties(properties: string[], options: IXlsxOptions = {}) {
  return options.include
    ? properties.filter(f => options.include?.includes(f))
    : options.exclude
    ? properties.filter(f => !options.exclude?.includes(f))
    : properties;
}
