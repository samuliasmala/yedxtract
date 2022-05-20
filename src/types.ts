export interface IXMLField {
  [key: string]: IXMLValue;
}

export type IXMLValue = string | IXMLField | Array<string | IXMLField>;

export type TGraphmlKeys = Array<{ $: Record<string, string> }>;

export interface IGraphml {
  graphml: {
    $: Record<string, string>;
    data: Array<IXMLField>;
    graph: Array<{
      $: Record<string, string>;
      data: Array<IXMLField>;
      edge: Array<IXMLField>;
      node: Array<IXMLField>;
    }>;
    key: TGraphmlKeys;
  };
}

export interface IGraphUnit {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
  data: IXMLField;
}

export interface IExtractedGraphUnit {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
  unitType: string;
  elements: IXMLField;
}

export interface IOutputUnit {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
  unitType: string;
  label: string | null;
  fields: Record<string, string | null>;
}

export interface IExtractFieldsUnit {
  [outputField: string]: string[];
}

export interface IExtractFields {
  node?: IExtractFieldsUnit;
  edge?: IExtractFieldsUnit;
  common?: IExtractFieldsUnit;
}

export interface IExtractElements {
  node: string[];
  edge: string[];
  common: string[];
}

export interface IXlsxOptions {
  include?: string[];
  exclude?: string[];
}
