import { useEffect, useReducer, useRef, useSyncExternalStore, type PointerEvent } from 'react';
import { clampCenter, handlePoints, hitHandle, hitTest,resizeFromCorner, rotationTo, type Corner } from '../core/transform';
import type { DocStore, LayerId } from '../core/types';

const HANDLE_RADIUS = 8;
type Handle = Corner | 'rotate';
type Drag = { id: LayerId; mode: Handle | 'move'; dx: number; dy: number };

type Props = { store: DocStore; selected: LayerId | null; onSelect: (id: LayerId | null) => void; onDelete: () => void };

export function CanvasEditor({ store, selected, onSelect, onDelete }: Props) {
  const doc = useSyncExternalStore(store.subscribe, store.getDoc);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const drag = useRef<Drag | null>(null);

  // 의존성 없음: 이미지 로드(redraw) 포함 매 렌더마다 다시 그린다
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, doc.width, doc.height);
    for (const l of doc.layers) {
      let img = images.current.get(l.src);
      if (!img) {
        img = new Image();
        img.onload = redraw;
        img.src = l.src;
        images.current.set(l.src, img);
      }
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rotation);
      if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, -l.width / 2, -l.height / 2, l.width, l.height);
      else ctx.strokeRect(-l.width / 2, -l.height / 2, l.width, l.height);
      ctx.restore();
    }
    const sel = doc.layers.find((l) => l.id === selected);
    if (!sel) return;
    const h = handlePoints(sel);
    ctx.strokeStyle = ctx.fillStyle = '#1e90ff';
    ctx.beginPath();
    for (const p of [h.nw, h.ne, h.se, h.sw]) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    for (const p of Object.values(h)) ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
  });

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const find = (id: LayerId | null) => store.getDoc().layers.find((l) => l.id === id);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const sel = find(selected);
    if (sel) {
      const mode = hitHandle(sel, x, y, HANDLE_RADIUS);
      if (mode) {
        const h = handlePoints(sel)[mode];
        drag.current = { id: sel.id, mode, dx: x - h.x, dy: y - h.y };
        return;
      }
    }
    const id = hitTest(store.getDoc(), x, y);
    const layer = find(id);
    onSelect(id);
    drag.current = layer ? { id: layer.id, mode: 'move', dx: x - layer.x, dy: y - layer.y } : null;
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    const layer = d && find(d.id);
    if (!d || !layer) return;
    const p = point(e);
    const x = p.x - d.dx, y = p.y - d.dy;
    if (d.mode === 'move') store.updateLayer(d.id, clampCenter(store.getDoc(), x, y));
    else if (d.mode === 'rotate') store.updateLayer(d.id, { rotation: rotationTo(layer, x, y) });
    else store.updateLayer(d.id, resizeFromCorner(layer, d.mode, x, y));
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="editor"
      width={doc.width}
      height={doc.height}
      style={{ display: 'block', width: doc.width, height: doc.height }}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected) onDelete();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
