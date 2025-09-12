interface ExportedAttribute {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'unspecified';
}

interface ExportedMethod {
  name: string;
  parameters: string;
  returnType: string;
  visibility: 'public' | 'private' | 'unspecified';
}

interface ExportedClass {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  attributes: ExportedAttribute[];
  methods: ExportedMethod[];
}

interface ExportedRelationship {
  id: string;
  source: any;
  target: any;
  labels: { position: any; text: string }[];
}
