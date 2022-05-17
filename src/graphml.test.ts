import {parse} from './graphml';

describe('parse()', () => {
  test('no arguments', () => {
    expect(parse()).toBe(null);
  });

  test('input string is not a valid graphml file', () => {
    expect(() => parse('')).toThrow();
  });

  test('simple.graphml', () => {
    expect(parse('hello')).toBe('hello');
  });
});
