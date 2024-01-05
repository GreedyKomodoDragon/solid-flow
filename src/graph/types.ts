export interface Position {
  x: number;
  y: number;
}

export interface Vector {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface NodeData {
  id: string;
  data: { label?: string; content: any };
  inputs: number;
  outputs: number;
  edgesIn: string[];
  edgesOut: string[];
  color: string;
}

export interface EdgesNodes {
  [id: string]: {
    outNodeId: string;
    outputIndex: number;
    inNodeId: string;
    inputIndex: number;
  };
}

export interface EdgesPositions {
  [id: string]: Vector;
}

export interface EdgesActive {
  [id: string]: boolean;
}
