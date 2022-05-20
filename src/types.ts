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
  source?: string;
  target?: string;
  data: IXMLField;
}

export interface ILabel {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
  label: string | null;
}

export interface IOutputUnit {
  id: string;
  type: 'node' | 'edge';
  source?: string;
  target?: string;
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
