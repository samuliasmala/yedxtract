export interface XMLField {
  [key: string]: IXMLValue;
}

export type IXMLValue = string | XMLField | Array<string | XMLField>;

export type GraphmlKeys = Array<{ $: Record<string, string> }>;

export interface Graphml {
  graphml: {
    $: Record<string, string>;
    data: Array<XMLField>;
    graph: Array<{
      $: Record<string, string>;
      data: Array<XMLField>;
      edge: Array<XMLField>;
      node: Array<XMLField>;
    }>;
    key: GraphmlKeys;
  };
}

export interface GraphUnit {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
  data: XMLField;
  // Reference to object attributes which contain source and target values, used
  // to update the graph
  attributes: XMLField;
}

export interface ExtractedGraphUnit extends GraphUnit {
  unitType: string;
  elements: XMLField;
}

export interface OutputUnit {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
  unitType?: string | null;
  label?: string | null;
  fields: Record<string, string | null>;
  data?: XMLField;
}

export interface ExtractFieldsUnit {
  [outputField: string]: string[];
}

export interface ExtractFields {
  node?: ExtractFieldsUnit;
  edge?: ExtractFieldsUnit;
  common?: ExtractFieldsUnit;
}

export interface ExtractElements {
  node: string[];
  edge: string[];
  common: string[];
}

export interface XlsxOptions {
  include?: string[];
  exclude?: string[];
}

export interface Metadata {
  yedxtractVersion?: string;
  yedFilename: string;
  yedHash: string;
  extractedFields: ExtractFields;
}

export type PostProcess = (row: OutputUnit) => OutputUnit | null;

export interface ExportOptions {
  fieldsToExport?: ExtractFields;
  postProcess?: PostProcess;
}

export interface ImportOptions {
  postProcess?: PostProcess;
  fieldsToImport?: XlsxOptions;
}
