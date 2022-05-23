import { promises as fs } from 'fs';

import { exportExcel } from '.';
import type { IExtractFields } from './types';

const SAMPLE_GRAPH = __dirname + '/../data/simple.graphml';
const SAMPLE_EXPORT = __dirname + '/../data/simple.xlsx';

describe('E2E tests', () => {
  test('export from graphml to xlsx', async () => {
    const fieldsToExport: IExtractFields = {
      node: {
        configuration: ['$', 'configuration'],
        color: ['y:Fill', '[0]', '$', 'color'],
        color2: ['y:Fill', '[0]', '$', 'color2'],
      },
    };

    const xlsxFile = await exportExcel(SAMPLE_GRAPH, fieldsToExport);

    // Compare to existing binary file
    const expectedXlsxFile = await fs.readFile(SAMPLE_EXPORT);

    expect(expectedXlsxFile).toEqual(xlsxFile);
  });
});
