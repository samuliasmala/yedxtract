import { promises as fs } from 'fs';

import { exportExcel, importExcel } from '.';
import { readFile } from './file';
import type { IExtractFields } from './types';

const ORIGINAL_GRAPH = __dirname + '/../data/simple.graphml';
const OUTPUT_EXCEL = __dirname + '/../data/simple.xlsx';
const TRANSLATED_EXCEL = __dirname + '/../data/simple-translated.xlsx';
const TRANSLATED_GRAPH = __dirname + '/../data/simple-translated.graphml';

describe('E2E tests', () => {
  test('export from graphml to xlsx', async () => {
    const fieldsToExport: IExtractFields = {
      node: {
        configuration: ['$', 'configuration'],
        color: ['y:Fill', '[0]', '$', 'color'],
        color2: ['y:Fill', '[0]', '$', 'color2'],
      },
    };

    const xlsxFile = await exportExcel(ORIGINAL_GRAPH, fieldsToExport);

    // Compare to existing binary file
    const expectedXlsxFile = await fs.readFile(OUTPUT_EXCEL);
    expect(xlsxFile).toEqual(expectedXlsxFile);
  });

  test('import from xlsx to graphml', async () => {
    // Read imported data
    const graphmlFile = await importExcel(ORIGINAL_GRAPH, TRANSLATED_EXCEL, {
      include: ['id', 'label'],
    });

    // Compare to existing binary file
    const { data: expectedGraph } = await readFile(TRANSLATED_GRAPH);
    expect(graphmlFile).toEqual(expectedGraph);
  });
});
