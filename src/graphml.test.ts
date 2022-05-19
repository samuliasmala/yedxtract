import { promises as fs } from 'fs';

import { parseGraphmlFile } from './graphml';

describe('graphml.ts', () => {
  let graphFile: string;

  beforeAll(async () => {
    graphFile = await fs.readFile('./data/simple.graphml', 'utf-8');
  });

  describe('parseGraphmlFile()', () => {
    test('input string is not a valid graphml file', async () => {
      await expect(parseGraphmlFile('abc')).rejects.toThrow();
    });

    test('simple.graphml', async () => {
      const graph = await parseGraphmlFile(graphFile);

      expect('graphml' in graph).toBe(true);
      expect('graph' in graph.graphml).toBe(true);
      expect('node' in graph.graphml.graph[0]).toBe(true);
    });
  });
});
