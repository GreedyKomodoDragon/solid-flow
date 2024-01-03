import { Component, createEffect, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import dagre from "dagre";
import graphlib from "graphlib";
import EdgesBoard from "./EdgesBoard";
import NodesBoard from "./NodesBoard";
import styles from "./styles.module.css";

interface Position {
  x: number;
  y: number;
}

interface Vector {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface NodeData {
  id: string;
  data: { label?: string; content: any };
  inputs: number;
  outputs: number;
  edgesIn: string[];
  edgesOut: string[];
}

interface EdgesNodes {
  [id: string]: {
    outNodeId: string;
    outputIndex: number;
    inNodeId: string;
    inputIndex: number;
  };
}

interface EdgesPositions {
  [id: string]: Vector;
}

interface EdgesActive {
  [id: string]: boolean;
}

export interface NodeProps {
  id: string;
  position: { x: number; y: number };
  data: { label?: string; content: any };
  inputs: number;
  outputs: number;
  actions?: { delete: boolean };
}

export interface EdgeProps {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourceOutput: number;
  targetInput: number;
}

interface Props {
  nodes: NodeProps[];
  edges: EdgeProps[];
  onNodesChange: (newNodes: NodeProps[]) => void;
  onEdgesChange: (newEdges: EdgeProps[]) => void;
  height: string;
  width: string;
}

function getEdgeId(
  nodeOutId: string,
  outputIndex: number,
  nodeInId: string,
  inputIndex: number
) {
  return `edge_${nodeOutId}:${outputIndex}_${nodeInId}:${inputIndex}`;
}

function convertToLayeredGraph(
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
  graph.setGraph({ rankdir: 'LR' });
  graph.setDefaultEdgeLabel(() => ({}));

  initialNodes.forEach((node) => {
    graph.setNode(node.id, { width: 200, height: 100 }); // Adjust width and height as needed
  });

  initialEdges.forEach((edge) => {
    graph.setEdge(edge.sourceNode, edge.targetNode);
  });

  dagre.layout(graph);

  const initNodesPositions = initialNodes.map((node) => ({
    x: graph.node(node.id).x,
    y: graph.node(node.id).y,
  }));

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

  const initEdgesNodes: EdgesNodes = {};
  const initEdgesPositions: EdgesPositions = {};
  const initEdgesActives: EdgesActive = {};

  initialEdges.forEach((edge) => {
    initEdgesNodes[edge.id] = {
      outNodeId: edge.sourceNode,
      outputIndex: edge.sourceOutput,
      inNodeId: edge.targetNode,
      inputIndex: edge.targetInput,
    };
    initEdgesPositions[edge.id] = {
      x0:
        initialNodes.find((node) => node.id === edge.sourceNode)!.position.x +
        200,
      y0:
        initialNodes.find((node) => node.id === edge.sourceNode)!.position.y +
        (edge.sourceOutput + 1) * 20 -
        10,
      x1: initialNodes.find((node) => node.id === edge.targetNode)!.position.x,
      y1:
        initialNodes.find((node) => node.id === edge.targetNode)!.position.y +
        (edge.targetInput + 1) * 20 -
        10,
    };
    initEdgesActives[edge.id] = false;
  });

  return {
    initNodesPositions,
    initNodesData,
    initNodesOffsets,
    initEdgesNodes,
    initEdgesPositions,
    initEdgesActives,
  };
}

const FlowChart: Component<Props> = (props: Props) => {
  const {
    initNodesPositions,
    initNodesData,
    initNodesOffsets,
    initEdgesNodes,
    initEdgesPositions,
    initEdgesActives,
  } = convertToLayeredGraph(props.nodes, props.edges);

  const [edgesNodes, setEdgesNodes] = createSignal<EdgesNodes>(initEdgesNodes);
  const [edgesPositions, setEdgesPositions] =
    createSignal<EdgesPositions>(initEdgesPositions);
  const [edgesActives, setEdgesActives] =
    createSignal<EdgesActive>(initEdgesActives);

  const [nodesPositions, setNodesPositions] =
    createSignal<Position[]>(initNodesPositions);
  const [nodesData, setNodesData] = createStore<NodeData[]>(initNodesData);
  const [nodesOffsets, setNodesOffsets] =
    createStore<
      { inputs: { offset: Position }[]; outputs: { offset: Position }[] }[]
    >(initNodesOffsets);

  const [clickedDelta, setClickedDelta] = createSignal<Position>({
    x: 0,
    y: 0,
  });
  const [newEdge, setNewEdge] = createSignal<{
    position: Vector;
    sourceNode: number;
    sourceOutput: number;
  } | null>(null);

  createEffect(() => {
    const nextNodesLength = props.nodes.length;
    const prevNodesLength = nodesData.length;

    if (nextNodesLength !== prevNodesLength) {
      const {
        initNodesPositions,
        initNodesData,
        initNodesOffsets,
        initEdgesNodes,
        initEdgesPositions,
        initEdgesActives,
      } = convertToLayeredGraph(props.nodes, props.edges);

      setEdgesNodes(initEdgesNodes);
      setEdgesPositions(initEdgesPositions);
      setEdgesActives(initEdgesActives);

      setNodesPositions(initNodesPositions);
      setNodesData(initNodesData);
      setNodesOffsets(initNodesOffsets);
    }
  });

  // NODE HANDLERS
  function handleOnNodeMount(values: {
    nodeIndex: number;
    inputs: { offset: { x: number; y: number } }[];
    outputs: { offset: { x: number; y: number } }[];
  }) {
    setNodesOffsets(
      produce(
        (
          nodesOffsets: {
            inputs: { offset: { x: number; y: number } }[];
            outputs: { offset: { x: number; y: number } }[];
          }[]
        ) => {
          nodesOffsets[values.nodeIndex].inputs = values.inputs;
          nodesOffsets[values.nodeIndex].outputs = values.outputs;
        }
      )
    );

    setEdgesActives((prev: EdgesActive) => {
      const next = { ...prev };
      nodesData[values.nodeIndex].edgesIn.map((edgeId: string) => {
        next[edgeId] = true;
      });
      nodesData[values.nodeIndex].edgesOut.map((edgeId: string) => {
        next[edgeId] = true;
      });
      return next;
    });

    setEdgesPositions((prev: EdgesPositions) => {
      const next = { ...prev };
      nodesData[values.nodeIndex].edgesIn.map((edgeId: string) => {
        next[edgeId] = {
          x0: prev[edgeId]?.x0 || 0,
          y0: prev[edgeId]?.y0 || 0,
          x1:
            nodesPositions()[values.nodeIndex].x +
            values.inputs[edgesNodes()[edgeId].inputIndex].offset.x,
          y1:
            nodesPositions()[values.nodeIndex].y +
            values.inputs[edgesNodes()[edgeId].inputIndex].offset.y,
        };
      });
      nodesData[values.nodeIndex].edgesOut.map((edgeId: string) => {
        next[edgeId] = {
          x0:
            nodesPositions()[values.nodeIndex].x +
            values.outputs[edgesNodes()[edgeId].outputIndex].offset.x,
          y0:
            nodesPositions()[values.nodeIndex].y +
            values.outputs[edgesNodes()[edgeId].outputIndex].offset.y,
          x1: prev[edgeId]?.x1 || 0,
          y1: prev[edgeId]?.y1 || 0,
        };
      });
      return next;
    });
  }

  function handleOnNodePress(deltaX: number, deltaY: number) {
    setClickedDelta({ x: deltaX, y: deltaY });
  }

  function handleOnNodeMove(nodeIndex: number, x: number, y: number) {
    setNodesPositions((prev: Position[]) => {
      const next = [...prev];
      next[nodeIndex].x = x - clickedDelta().x;
      next[nodeIndex].y = y - clickedDelta().y;
      return next;
    });

    setEdgesPositions((prev: EdgesPositions) => {
      const next = { ...prev };
      nodesData[nodeIndex].edgesIn.map((edgeId: string) => {
        if (edgesActives()[edgeId])
          next[edgeId] = {
            x0: prev[edgeId]?.x0 || 0,
            y0: prev[edgeId]?.y0 || 0,
            x1:
              x +
              nodesOffsets[nodeIndex].inputs[edgesNodes()[edgeId].inputIndex]
                .offset.x -
              clickedDelta().x,
            y1:
              y +
              nodesOffsets[nodeIndex].inputs[edgesNodes()[edgeId].inputIndex]
                .offset.y -
              clickedDelta().y,
          };
      });
      nodesData[nodeIndex].edgesOut.map((edgeId: string) => {
        if (edgesActives()[edgeId])
          next[edgeId] = {
            x0:
              x +
              nodesOffsets[nodeIndex].outputs[edgesNodes()[edgeId].outputIndex]
                .offset.x -
              clickedDelta().x,
            y0:
              y +
              nodesOffsets[nodeIndex].outputs[edgesNodes()[edgeId].outputIndex]
                .offset.y -
              clickedDelta().y,
            x1: prev[edgeId]?.x1 || 0,
            y1: prev[edgeId]?.y1 || 0,
          };
      });
      return next;
    });
  }

  function handleOnNodeDelete(nodeId: string) {
    const newNodes = props.nodes.filter(
      (node: NodeProps) => node.id !== nodeId
    );
    const newEdges = props.edges.filter(
      (edge: EdgeProps) =>
        edge.sourceNode !== nodeId && edge.targetNode !== nodeId
    );
    props.onEdgesChange(newEdges);
    props.onNodesChange(newNodes);
  }

  function handleOnOutputMouseDown(nodeIndex: number, outputIndex: number) {
    const nodePosition = nodesPositions()[nodeIndex];
    const outputOffset = nodesOffsets[nodeIndex].outputs[outputIndex].offset;
    setNewEdge({
      position: {
        x0: nodePosition.x + outputOffset.x,
        y0: nodePosition.y + outputOffset.y,
        x1: nodePosition.x + outputOffset.x,
        y1: nodePosition.y + outputOffset.y,
      },
      sourceNode: nodeIndex,
      sourceOutput: outputIndex,
    });
  }

  function handleOnInputMouseUp(nodeIndex: number, inputIndex: number) {
    if (newEdge()?.sourceNode === nodeIndex) {
      setNewEdge(null);
      return;
    }

    const outputEdges: string[] = JSON.parse(
      JSON.stringify(nodesData[newEdge()?.sourceNode || 0].edgesOut)
    );
    const inputEdges: string[] = JSON.parse(
      JSON.stringify(nodesData[nodeIndex].edgesIn)
    );

    if (!newEdge()) return;
    const sourceNodeId = nodesData[newEdge()?.sourceNode || 0].id;
    const targetNodeId = nodesData[nodeIndex].id;

    const edgeId = getEdgeId(
      sourceNodeId,
      newEdge()?.sourceOutput || 0,
      targetNodeId,
      inputIndex
    );

    let haveEdge = false;
    if (outputEdges.includes(edgeId)) haveEdge = true;
    if (inputEdges.includes(edgeId)) haveEdge = true;

    if (!haveEdge) {
      setEdgesPositions((prev: EdgesPositions) => {
        const next = { ...prev };
        next[edgeId] = {
          x0:
            nodesPositions()[newEdge()?.sourceNode || 0].x +
            nodesOffsets[newEdge()?.sourceNode || 0].outputs[
              newEdge()?.sourceOutput || 0
            ].offset.x,
          y0:
            nodesPositions()[newEdge()?.sourceNode || 0].y +
            nodesOffsets[newEdge()?.sourceNode || 0].outputs[
              newEdge()?.sourceOutput || 0
            ].offset.y,
          x1:
            nodesPositions()[nodeIndex].x +
            nodesOffsets[nodeIndex].inputs[inputIndex].offset.x,
          y1:
            nodesPositions()[nodeIndex].y +
            nodesOffsets[nodeIndex].inputs[inputIndex].offset.y,
        };
        return next;
      });
      setEdgesActives((prev: EdgesActive) => {
        const next = { ...prev };
        next[edgeId] = true;
        return next;
      });
      setNodesData(
        produce((nodesData: NodeData[]) => {
          nodesData[newEdge()?.sourceNode || 0].edgesOut.push(edgeId);
          nodesData[nodeIndex].edgesIn.push(edgeId);
        })
      );
      const activeEdgesKeys = Object.keys(edgesActives());
      const activeEdges: EdgeProps[] = [];
      for (let i = 0; i < activeEdgesKeys.length; i++) {
        if (edgesActives()[activeEdgesKeys[i]]) {
          const edgeInfo = edgesNodes()[activeEdgesKeys[i]];
          activeEdges.push({
            id: activeEdgesKeys[i],
            sourceNode: edgeInfo.outNodeId,
            sourceOutput: edgeInfo.outputIndex,
            targetNode: edgeInfo.inNodeId,
            targetInput: edgeInfo.inputIndex,
          });
        }
      }
      props.onEdgesChange(activeEdges);
    }
    setNewEdge(null);
  }

  function handleOnMouseUp() {
    setNewEdge(null);
  }

  function handleOnMouseMove(x: number, y: number) {
    if (newEdge() !== null)
      setNewEdge({
        position: {
          x0: newEdge()?.position?.x0 || 0,
          y0: newEdge()?.position?.y0 || 0,
          x1: x,
          y1: y,
        },
        sourceNode: newEdge()?.sourceNode || 0,
        sourceOutput: newEdge()?.sourceOutput || 0,
      });
  }

  // EDGE HANDLERS
  function handleOnDeleteEdge(edgeId: string) {
    setNodesData(
      produce((nodesData: NodeData[]) => {
        const nodeSourceId = edgesNodes()[edgeId].outNodeId;
        const nodeTargetId = edgesNodes()[edgeId].inNodeId;

        const nodeSourceIndex = nodesData.findIndex(
          (node: NodeData) => node.id === nodeSourceId
        );
        const nodeTargetIndex = nodesData.findIndex(
          (node: NodeData) => node.id === nodeTargetId
        );

        nodesData[nodeTargetIndex].edgesIn = nodesData[
          nodeTargetIndex
        ].edgesIn.filter((elem: string) => elem !== edgeId);
        nodesData[nodeSourceIndex].edgesOut = nodesData[
          nodeSourceIndex
        ].edgesOut.filter((elem: string) => elem !== edgeId);
      })
    );
    setEdgesActives((prev: EdgesActive) => {
      const next = { ...prev };
      next[edgeId] = false;
      return next;
    });

    const activeEdgesKeys = Object.keys(edgesActives());
    const activeEdges: EdgeProps[] = [];
    for (let i = 0; i < activeEdgesKeys.length; i++) {
      if (edgesActives()[activeEdgesKeys[i]]) {
        const edgeInfo = edgesNodes()[activeEdgesKeys[i]];
        activeEdges.push({
          id: activeEdgesKeys[i],
          sourceNode: edgeInfo.outNodeId,
          sourceOutput: edgeInfo.outputIndex,
          targetNode: edgeInfo.inNodeId,
          targetInput: edgeInfo.inputIndex,
        });
      }
    }
    props.onEdgesChange(activeEdges);
  }

  return (
    <div class={styles.main}>
      <div class={styles.wrapper}>
        <div
          class={styles.content}
          style={{
            cursor: newEdge() !== null ? "crosshair" : "inherit",
            height: props.height,
            width: props.width,
          }}
        >
          <NodesBoard
            nodesPositions={nodesPositions()}
            nodes={nodesData}
            onNodeMount={handleOnNodeMount}
            onNodePress={handleOnNodePress}
            onNodeMove={handleOnNodeMove}
            onNodeDelete={handleOnNodeDelete}
            onOutputMouseDown={handleOnOutputMouseDown}
            onInputMouseUp={handleOnInputMouseUp}
            onMouseUp={handleOnMouseUp}
            onMouseMove={handleOnMouseMove}
          />
          <EdgesBoard
            newEdge={newEdge()}
            edgesActives={edgesActives()}
            edgesPositions={edgesPositions()}
            onDeleteEdge={handleOnDeleteEdge}
          />
        </div>
      </div>
    </div>
  );
};

export default FlowChart;
