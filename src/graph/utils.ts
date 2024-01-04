import {
  Position,
  NodeData,
  EdgesNodes,
  EdgesPositions,
  EdgesActive,
} from "./types";
import dagre from "dagre";

export function getEdgeId(
  nodeOutId: string,
  outputIndex: number,
  nodeInId: string,
  inputIndex: number
) {
  return `edge_${nodeOutId}:${outputIndex}_${nodeInId}:${inputIndex}`;
}

// Function to convert an initial graph structure into a layered graph representation
export function convertToLayeredGraph(
  initialNodes: {
    id: string;
    position: Position;
    data: { label?: string; content: any };
    inputs: number;
    outputs: number;
  }[],
  initialEdges: {
    id: string;
    sourceNode: string;
    sourceOutput: number;
    targetNode: string;
    targetInput: number;
  }[]
): {
  initNodesPositions: Position[];
  initNodesData: NodeData[];
  initNodesOffsets: {
    inputs: { offset: Position }[];
    outputs: { offset: Position }[];
  }[];
  initEdgesNodes: EdgesNodes;
  initEdgesPositions: EdgesPositions;
  initEdgesActives: EdgesActive;
} {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR" });
  graph.setDefaultEdgeLabel(() => ({}));

  initialNodes.forEach((node) => {
    graph.setNode(node.id, { width: 200, height: 100 });
  });

  initialEdges.forEach((edge) => {
    graph.setEdge(edge.sourceNode, edge.targetNode);
  });

  dagre.layout(graph);

  const initNodesPositions = initialNodes.map((node) => graph.node(node.id));

  const initNodesData: NodeData[] = initialNodes.map((node) => ({
    id: node.id,
    data: node.data,
    inputs: node.inputs,
    outputs: node.outputs,
    edgesIn: initialEdges
      .filter((edge) => edge.targetNode === node.id)
      .map((edge) => edge.id),
    edgesOut: initialEdges
      .filter((edge) => edge.sourceNode === node.id)
      .map((edge) => edge.id),
  }));

  const initNodesOffsets = initialNodes.map((node) => ({
    inputs: Array.from({ length: node.inputs }, (_, index) => ({
      offset: {
        x: node.position.x,
        y: node.position.y + (index + 1) * 20 - (node.inputs + 1) * 10,
      },
    })),
    outputs: Array.from({ length: node.outputs }, (_, index) => ({
      offset: {
        x: node.position.x + 200,
        y: node.position.y + (index + 1) * 20 - (node.outputs + 1) * 10,
      },
    })),
  }));

  const initEdgesNodes = initialEdges.reduce((acc: EdgesNodes, edge) => {
    acc[edge.id] = {
      outNodeId: edge.sourceNode,
      outputIndex: edge.sourceOutput,
      inNodeId: edge.targetNode,
      inputIndex: edge.targetInput,
    };
    return acc;
  }, {});

  const initEdgesPositions = initialEdges.reduce(
    (acc: EdgesPositions, edge) => {
      acc[edge.id] = {
        x0:
          initialNodes.find((node) => node.id === edge.sourceNode)!.position.x +
          200,
        y0:
          initialNodes.find((node) => node.id === edge.sourceNode)!.position.y -
          10,
        x1: initialNodes.find((node) => node.id === edge.targetNode)!.position
          .x,
        y1:
          initialNodes.find((node) => node.id === edge.targetNode)!.position.y -
          10,
      };
      return acc;
    },
    {}
  );

  const initEdgesActives = initialEdges.reduce((acc: EdgesActive, edge) => {
    acc[edge.id] = false;
    return acc;
  }, {});

  return {
    initNodesPositions,
    initNodesData,
    initNodesOffsets,
    initEdgesNodes,
    initEdgesPositions,
    initEdgesActives,
  };
}
