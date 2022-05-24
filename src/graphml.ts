import { parseStringPromise, Builder } from 'xml2js';
import Debug from 'debug';
const debug = Debug('yedxtract:graphml');

import type {
  IGraphUnit,
  IExtractFields,
  IOutputUnit,
  IGraphml,
  IXMLField,
  IXMLValue,
  TGraphmlKeys,
  IExtractElements,
  IExtractedGraphUnit,
  IExportOptions,
} from './types';

/**
 * Parse yEd editor's graphml (XML) to JS object
 *
 * @param graphmlFile - yEd editor's graphml file as a string
 * @returns Parsed graphml file as JS object
 */
export async function parseGraphmlFormat(graphmlFile: string) {
  debug('Parsing graphml XML string to JS object');
  const graph: IGraphml = await parseStringPromise(graphmlFile);
  return graph;
}

/**
 * Convert JS object to yEd editor's graphml (XML)
 *
 * @param graph - yEd editor's graphml file as JS object
 * @returns JS object converted to graphml XML string
 */
export function convertToGraphmlFormat(graph: IGraphml) {
  debug('Converting JS object to graphml XML string');
  const builder = new Builder({
    renderOpts: { pretty: false },
    xmldec: { version: '1.0', encoding: 'UTF-8', standalone: false },
  });
  return builder.buildObject(graph);
}

/**
 * Get specified node and edge fields from the graph
 *
 * @param graph - graphml file as JS object
 * @param fields - Fields to export
 * @returns All node and edge fields from the graph
 */
export function getUnitsFromGraph(graph: IGraphml, options?: IExportOptions) {
  debug('Getting node and edge fields');

  const graphUnits = getAllGraphUnits(graph);

  if (options === undefined) options = {};
  let units = extractFields(graphUnits, options.fieldsToExport ?? {});

  const { postProcess } = options;
  if (typeof postProcess === 'function') {
    debug('Postprocessing graph units');
    units = units.reduce<IOutputUnit[]>((acc, unit) => {
      const postProcessedUnit = postProcess(unit);
      if (postProcessedUnit != null) acc.push(postProcessedUnit);
      return acc;
    }, []);
  }

  return units;
}

/**
 * Update graph by merging `newUnits` to the existing graph
 *
 * @param graph - Graphml file as JS object
 * @param newUnits - Updated values for nodes and edges
 * @returns Updated graph
 */
export function updateGraph(
  graph: IGraphml,
  newUnits: IOutputUnit[],
  extractedFields: IExtractFields
) {
  const oldUnits = getAllGraphUnits(graph);
  const elements = extractElements(oldUnits);

  for (const unit of newUnits) {
    // Find corresponding element
    const element = elements.find(e => e.id === unit.id);
    if (!element) {
      console.warn(`Unknown input row (id=${unit.id})`);
      continue;
    }

    // Update fixed fields (source, target, label)
    const { source, target, label } = unit;
    if (source !== undefined) element.attributes.source = source;
    if (target !== undefined) element.attributes.target = target;
    if (label !== undefined) {
      if (element.type === 'node')
        setNestedProperty(
          element.elements,
          ['y:NodeLabel', '[0]', '_'],
          label ?? ''
        );
      else
        setNestedProperty(
          element.elements,
          ['y:EdgeLabel', '[0]', '_'],
          label ?? ''
        );
    }

    // Update user-defined fields
    const fields = {
      ...(extractedFields[element.type] ?? {}),
      ...(extractedFields.common ?? {}),
    };

    for (const [field, val] of Object.entries(unit.fields)) {
      if (val === undefined) continue;
      const propPath = fields[field];
      if (propPath == null) {
        console.warn(
          `Field without entry in extractedFields metadata, skipping (${field})`
        );
        continue;
      }
      setNestedProperty(element.elements, propPath, val ?? '');
    }
  }

  return graph;
}

/**
 * Get node and edge raw data, keep only data element corresponding to the
 * nodegraphics/edgegraphics keys
 *
 * @param graph - graphml file as JS object
 * @returns Node and edge raw data
 */
function getAllGraphUnits(graph: IGraphml) {
  const nodes = getGraphUnit(graph, 'node');
  const edges = getGraphUnit(graph, 'edge');

  return [...nodes, ...edges];
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
function getGraphUnit(graph: IGraphml, type: 'node' | 'edge'): IGraphUnit[] {
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

    const result: IGraphUnit = {
      id,
      type,
      data: itemData,
      attributes: getNestedXMLField(item, ['$']),
    };

    // Add source and target elements for edges
    if (type === 'edge') {
      result.source = getNestedString(item, ['$', 'source']);
      result.target = getNestedString(item, ['$', 'target']);
    }
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
 * Extract specified elements (e.g., y:NodeLabel) from the IGraphUnit's
 * children. Assume and verify that only one children (e.g. y:GenericNode) is
 * present.
 *
 * @param data - Node or edge data extracted from the graph using
 *               `getGraphUnit` function
 * @param [elements] - Element(s) to extract from the data (e.g., y:NodeLabel)
 * @returns Array of objects with id and specified elements as keys
 */
export function extractElements(
  data: IGraphUnit[],
  elements?: IExtractElements
): IExtractedGraphUnit[] {
  if (elements) {
    const allElements = [
      ...elements.node,
      ...elements.edge,
      ...elements.common,
    ];
    debug(`Extracting elements (${allElements.join(', ')})`);
  } else {
    debug('Extracting all elements');
  }

  return data.map(item => {
    // Get item.data's different child element types, exclude $ which contais
    // item.data's own properties
    const childElementTypes = Object.keys(item.data).filter(k => k !== '$');

    // Assume and verify item.data has exactly one child element type
    // (e.g. one of y:GenericNode, y:ShapeNode, y:PolyLineEdge etc.)
    if (childElementTypes.length !== 1)
      throw new Error('Multiple child element types found from the data field');

    const childType = childElementTypes[0];

    // Assume and verify that only one instance of the childType is present
    const childElement = getXMLFieldFromSingletonArray(item.data, childType);

    // Object to store extracted elements
    const result: IExtractedGraphUnit = {
      id: item.id,
      type: item.type,
      data: item.data,
      attributes: item.attributes,
      unitType: childType,
      elements: {},
    };

    if (item.source !== undefined) result.source = item.source;
    if (item.target !== undefined) result.target = item.target;

    if (elements) {
      for (const element of [...elements[item.type], ...elements.common]) {
        result.elements[element] = childElement[element];
      }
    } else {
      result.elements = childElement;
    }

    return result;
  });
}

/**
 * Extract certain fields from data items.
 *
 * @param data - Node or edge data extracted from the graph using
 *               `getGraphUnit` function
 * @param type - node or edge
 * @param fieldsToExtract - specify the fields which are extracted
 * @returns Array of objects containing the extracted fields
 */
function extractFields(
  data: IGraphUnit[],
  fieldsToExtract: IExtractFields
): IOutputUnit[] {
  const elements = extractElements(data);

  return elements.map(element => {
    const result: Record<string, string | null> = {};

    const fields = {
      ...(fieldsToExtract[element.type] ?? {}),
      ...(fieldsToExtract.common ?? {}),
    };

    // Get all user defined fields
    for (const output in fields) {
      let data;
      try {
        data = getNestedString(element.elements, fields[output]);
      } catch (err) {
        data = null;
      }
      result[output] = data;
    }

    // Get unit's label
    let label;
    try {
      label =
        element.type === 'node'
          ? getNestedString(element.elements, ['y:NodeLabel', '[0]', '_'])
          : getNestedString(element.elements, ['y:EdgeLabel', '[0]', '_']);
    } catch (err) {
      label = null;
    }

    const output: IOutputUnit = {
      id: element.id,
      type: element.type,
      unitType: element.unitType,
      label,
      fields: result,
      data: element.data,
    };

    // Add source and target if they exist
    if (element.type === 'edge') {
      output.source = element.source;
      output.target = element.target;
    }
    return output;
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

function setNestedProperty(
  data: IXMLValue,
  keys: Array<string | number>,
  value: IXMLValue
) {
  if (keys.length < 1) throw new Error('Keys cannot be empty');
  const lastKey = keys.slice(-1)[0];
  const obj = getNestedXMLField(data, keys.slice(0, -1));
  obj[lastKey] = value;
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
