export function parse(data?: string) {
  if (data === undefined) return null;
  if (data === '') throw new Error('Invalid input string');
  return data;
}
