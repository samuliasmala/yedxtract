import { parseStringPromise } from 'xml2js';
import Debug from 'debug';
const debug = Debug('yedxtract:graphml');

import type {
  IDataItem,
  IGraphml,
  ILabel,
  IXMLField,
  IXMLValue,
  TGraphmlKeys,
} from './types';

/** Parse yEd editor's graphml file (XML) to JS object
 *
 * @param graphmlFile - yEd editor's graphml file as a string
 * @returns Parsed graphml file as JS object
 */
export async function parseGraphmlFile(graphmlFile: string) {
  debug('Parsing graphml XML string to JS object');
  const graph: IGraphml = await parseStringPromise(graphmlFile);
  return graph;
}

/** Get all node and edge labels from the graph
 *
 * @param graph - graphml file as JS object
 * @returns All node and edge labels from the graph
 */
export function getLabels(graph: IGraphml): ILabel[] {
  debug('Getting node and edge labels');
  const { nodes, edges } = getNodesAndEdges(graph);
  const nodeLabelFields = extractFields(nodes, ['y:NodeLabel']);
  const edgeLabelFields = extractFields(edges, ['y:EdgeLabel']);

  const nodeLabels = nodeLabelFields.map(n => extractLabels(n, 'node'));
  const edgeLabels = edgeLabelFields.map(n => extractLabels(n, 'edge'));

  return [...nodeLabels, ...edgeLabels];
}

/** Get node and edge raw data, keep only data element corresponding to the
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

/** Get the all items of the type. Only include the data element defined in the
 * graph's Key attributes
 *
 * @param graph
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

function findKeyId(keys: TGraphmlKeys, keyName: string, keyValue: string) {
  const key = keys.find(key => key?.$?.[keyName] === keyValue);
  const id = key?.$?.id;

  if (id === undefined) throw new Error(keyValue + ' key missing');
  return id;
}

/** Extract specified fields from the data items
 *
 * @param data - Data where fields are exctracted (i.e. nodes or edges)
 * @param fields - Fields to extract from the data
 * @returns Array of objects with id and specified fields as keys
 */
export function extractFields(data: IDataItem[], fields: string[]) {
  debug(`Extracting fields (${fields.join(', ')})`);

  if (fields.includes('id'))
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

    // Object to store extracted fields
    const result: IXMLField = { id: item.id };
    for (const field of fields) {
      result[field] = childElement[field];
    }

    return result;
  });
}

function extractLabels(fields: IXMLField, type: 'node' | 'edge'): ILabel {
  const FIELD_LABELS = {
    node: 'y:NodeLabel',
    edge: 'y:EdgeLabel',
  };

  const id = getNestedString(fields, ['id']);

  try {
    const labelData = getXMLFieldFromSingletonArray(fields, FIELD_LABELS[type]);
    const label = getNestedString(labelData, ['_']);
    return { id, type, label };
  } catch (err) {
    return { id, type, label: null };
  }
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
