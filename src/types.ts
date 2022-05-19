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

export interface IDataItem {
  id: string;
  data: IXMLField;
}

export interface ILabel {
  id: string;
  type: 'node' | 'edge';
  label: string | null;
}

export interface IFields {
  id: string;
  type: 'node' | 'edge';
  fields: Record<string, string | null>;
}

export interface IFieldsToExtract {
  [outputField: string]: string[];
}

export interface IExportedFields {
  node?: IFieldsToExtract;
  edge?: IFieldsToExtract;
  common?: IFieldsToExtract;
}
