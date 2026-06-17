// Download the diagram as a crisp PNG or SVG.
//
// We don't screenshot the live viewport (which is panned/zoomed and clipped).
// Instead we measure the bounding box of all nodes, inflate it so decorations
// that sit outside the node boxes (the reset bolt, self-loops, edge labels)
// aren't clipped, then render the `.react-flow__viewport` element fitted into a
// fixed frame via html-to-image. PNG is rendered at 2x for retina-sharp raster;
// SVG is naturally scalable.

import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

// Slack around the node bounds for the reset bolt (~44px), self-loops, and labels.
const MARGIN = 90;
const PADDING = 0.05;
const PNG_SCALE = 2;
const MAX_DIM = 4000;

export type ImageFormat = 'png' | 'svg';

export async function exportCanvasImage(format: ImageFormat, nodes: Node[]): Promise<void> {
  if (nodes.length === 0) return;
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) return;

  const raw = getNodesBounds(nodes);
  const bounds = {
    x: raw.x - MARGIN,
    y: raw.y - MARGIN,
    width: raw.width + MARGIN * 2,
    height: raw.height + MARGIN * 2,
  };
  const width = Math.min(Math.round(bounds.width), MAX_DIM);
  const height = Math.min(Math.round(bounds.height), MAX_DIM);
  const transform = getViewportForBounds(bounds, width, height, 0.2, 4, PADDING);

  const options = {
    backgroundColor: '#ffffff',
    width,
    height,
    cacheBust: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  };

  let dataUrl: string;
  if (format === 'png') {
    // html-to-image's first rasterization can come back blank before fonts and
    // layout are warm; a throwaway pass primes it so the second is complete.
    await toPng(viewport, { ...options, pixelRatio: PNG_SCALE });
    dataUrl = await toPng(viewport, { ...options, pixelRatio: PNG_SCALE });
  } else {
    dataUrl = await toSvg(viewport, options);
  }

  download(dataUrl, `fsm.${format}`);
}

function download(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
