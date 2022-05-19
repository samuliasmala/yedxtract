import { parseStringPromise } from 'xml2js';
import Debug from 'debug';
const debug = Debug('yedxtract:graphml');

import type {
  IDataItem,
  IExportedFields,
  IFields,
  IGraphml,
  ILabel,
  IXMLField,
  IXMLValue,
  TGraphmlKeys,
} from './types';

/**
 * Parse yEd editor's graphml file (XML) to JS object
 *
 * @param graphmlFile - yEd editor's graphml file as a string
 * @returns Parsed graphml file as JS object
 */
export async function parseGraphmlFile(graphmlFile: string) {
  debug('Parsing graphml XML string to JS object');
  const graph: IGraphml = await parseStringPromise(graphmlFile);
  return graph;
}

/**
 * Get specified node and edge fields from the graph
 *
 * @param graph - graphml file as JS object
 * @param fields - Fields to export
 * @returns All node and edge fields from the graph
 */
export function getFields(graph: IGraphml, fields: IExportedFields): IFields[] {
  debug('Getting node and edge labels');
  const { nodes, edges } = getNodesAndEdges(graph);

  const nodeFields = extractFields(nodes, 'node', fields);
  const edgeFields = extractFields(edges, 'edge', fields);

  return [...nodeFields, ...edgeFields];
}

/**
 * Get all node and edge labels from the graph
 *
 * @param graph - graphml file as JS object
 * @returns All node and edge labels from the graph
 */
export function getLabels(graph: IGraphml): ILabel[] {
  debug('Getting node and edge labels');

  const fieldsToExport: IExportedFields = {
    node: { label: ['y:NodeLabel', '[0]', '_'] },
    edge: { label: ['y:EdgeLabel', '[0]', '_'] },
  };
  const labels = getFields(graph, fieldsToExport);

  return labels.map(label => ({
    id: label.id,
    type: label.type,
    label: label.fields.label,
  }));
}

/**
 * Get node and edge raw data, keep only data element corresponding to the
 * nodegraphics/edgegraphics keys
 *
 * @param graph - graphml file as JS object
 * @returns Node and edge raw data
 */
function getNodesAndEdges(graph: IGraphml) {
  const nodes = getGraphDataItem(graph, 'node');
  const edges = getGraphDataItem(graph, 'edge');

  return { nodes, edges };
}

/**
 * Get the all items of the type. Only include the data element defined in the
 * graph's Key attributes
 *
 * @param graph - graphml file as JS object
 * @param type - Type of the data to get (node or edge)
 * @returns All items with the specified type. Only the data element
 *          corresponding to the specified key is included
 */
function getGraphDataItem(graph: IGraphml, type: 'node' | 'edge') {
  const data = graph.graphml.graph[0]?.[type];

  if (!data) throw new Error(`Data missing for ${type}s`);

  // Extract from the graph keys the key value used to identify node and edge
  // data; used in <data key="">
  const graphKeys = graph?.graphml?.key;
  if (!Array.isArray(graphKeys)) throw new Error('Key attributes are missing');

  const dataKey = findKeyId(graphKeys, 'yfiles.type', type + 'graphics');

  return data.map(item => {
    // Get item id (e.g., n10 or e10)
    const id = getNestedString(item, ['$', 'id']);

    // Get all item's data fields
    const itemDataFields = getNestedArray(item, ['data']);

    // Get the data fields specified by the `key=dataKey` parameter
    const itemDataFieldsWithKey = itemDataFields.filter(
      key =>
        typeof key !== 'string' &&
        getNestedString(key, ['$', 'key']) === dataKey
    );

    // Verify only one element with the key is present
    if (itemDataFieldsWithKey.length !== 1)
      throw new Error(`Single item data field with ${dataKey} key not found`);

    const itemData = itemDataFieldsWithKey[0];
    if (itemData === undefined || typeof itemData === 'string')
      throw new Error('Proper item data not found');

    const result: IDataItem = { id, data: itemData };
    return result;
  });
}

/**
 * Get the id value of a certain `key` element.
 *
 * @param keys - Key elements from the graph
 * @param keyAttribute - Key attribute to check to find the correct key
 * @param keyValue - Value of the `keyAttribute` for correct key
 * @returns The value of the `id` field of the defined key
 */
function findKeyId(keys: TGraphmlKeys, keyAttribute: string, keyValue: string) {
  const key = keys.find(key => key?.$?.[keyAttribute] === keyValue);
  const id = key?.$?.id;

  if (id === undefined) throw new Error(keyValue + ' key missing');
  return id;
}

/**
 * Extract specified elements from the data items.
 *
 * @param data - Node or edge data extracted from the graph using
 *               `getGraphDataItem` function
 * @param elements - Elements to extract from the data
 * @returns Array of objects with id and specified elements as keys
 */
export function extractElements(data: IDataItem[], elements: string[]) {
  debug(`Extracting elements (${elements.join(', ')})`);

  if (elements.includes('id'))
    throw new Error('id cannot be specified as a field');

  return data.map(item => {
    // Get item.data's different child element types, exclude $ which contais
    // item.data's own properties
    const childElementTypes = Object.keys(item.data).filter(k => k !== '$');

    // Assume and verify item.data has exactly one child element type
    // (e.g. one of y:GenericNode, y:ShapeNode, y:PolyLineEdge etc.)
    if (childElementTypes.length !== 1)
      throw new Error('Multiple child element types found from the data field');

    const childType = childElementTypes[0];
    const childElement = getXMLFieldFromSingletonArray(item.data, childType);

    // Object to store extracted elements
    const result: IXMLField = { id: item.id };
    for (const element of elements) {
      result[element] = childElement[element];
    }

    return result;
  });
}

/**
 * Extract certain fields from data items.
 *
 * @param data - Node or edge data extracted from the graph using
 *               `getGraphDataItem` function
 * @param type - node or edge
 * @param fieldsToExtract - specify the fields which are extracted
 * @returns Array of objects containing the extracted fields
 */
function extractFields(
  data: IDataItem[],
  type: 'node' | 'edge',
  fieldsToExtract: IExportedFields
): IFields[] {
  const fields = {
    ...(fieldsToExtract[type] ?? {}),
    ...(fieldsToExtract.common ?? {}),
  };

  // Get the first element from the `fieldsToExtract` object arrays in order to
  // extract the final field
  const elementsToExtract = Object.values(fields).map(f => f[0]);
  const elements = extractElements(data, elementsToExtract);

  return elements.map(element => {
    const id = getNestedString(element, ['id']);
    const result: Record<string, string | null> = {};

    for (const output in fields) {
      let data;
      try {
        data = getNestedString(element, fields[output]);
      } catch (err) {
        data = null;
      }
      result[output] = data;
    }
    return { id, type, fields: result };
  });
}

function getNestedString(data: IXMLValue, keys: Array<string | number>) {
  const value = getNestedProperty(data, keys);
  if (typeof value !== 'string') throw new Error('Property not string');
  return value;
}

function getNestedArray(data: IXMLValue, keys: Array<string | number>) {
  const value = getNestedProperty(data, keys);
  if (!Array.isArray(value)) throw new Error('Property not an array');
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getNestedXMLField(data: IXMLValue, keys: Array<string | number>) {
  const value = getNestedProperty(data, keys);
  if (typeof value === 'string' || Array.isArray(value))
    throw new Error('Property not IXMLField');
  return value;
}

function getNestedProperty(data: IXMLValue, keys: Array<string | number>) {
  let value: IXMLValue = data;

  for (const key of keys) {
    if (typeof value === 'string')
      throw new Error('String encountered when getting nested property');

    if (Array.isArray(value) && typeof key === 'number') {
      value = value[key];
    } else if (Array.isArray(value) && key === '[0]') {
      if (value.length !== 1)
        throw new Error('Accessing singleton array which is not singleton');
      value = value[0];
    } else if (!Array.isArray(value) && typeof key === 'string') {
      value = value[key];
    } else {
      throw new Error('Invalid value when getting nested property');
    }
  }

  return value;
}

function getXMLFieldFromSingletonArray(data: IXMLField, field: string) {
  const elements = data[field];

  // Verify that the field contains an array
  if (!Array.isArray(elements))
    throw new Error('Provided data field is not an array');

  // Verify there is only one element in it, i.e. it's singleton
  if (elements.length !== 1)
    throw new Error('Multiple instances found from the data field');

  // Verify the element has a correct type
  const element = elements[0];

  if (typeof element === 'string')
    throw new Error('Invalid element instance found from the data field');

  return element;
}
