import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DocStore } from '../core/types';

const SIZE = 512;

export function Preview({ store }: { store: DocStore }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const doc = store.getDoc();
    let disposed = false;

    // 문서를 오프스크린 2D 캔버스에 그려 텍스처로 쓴다
    const surface = document.createElement('canvas');
    surface.width = doc.width;
    surface.height = doc.height;
    const ctx = surface.getContext('2d')!;

    const renderer = new THREE.WebGLRenderer({ canvas: ref.current!, antialias: true });
    renderer.setSize(SIZE, SIZE, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2430);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(2.5, 2, 3);
    camera.lookAt(0, 0, 0);

    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(geometry, material));

    const images = new Map<string, HTMLImageElement>();

    function draw() {
      if (disposed) return;
      const doc = store.getDoc();
      ctx.fillStyle = '#dddddd';
      ctx.fillRect(0, 0, doc.width, doc.height);
      doc.layers.forEach((layer) => {
        let img = images.get(layer.src);
        if (!img) {
          img = new Image();
          images.set(layer.src, img);
          img.onload = draw;
          img.src = layer.src;
        }
        if (!img.complete || !img.naturalWidth) return;
        ctx.save();
        ctx.translate(layer.x, layer.y);
        ctx.rotate(layer.rotation);
        ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
        ctx.restore();
      });
      texture.needsUpdate = true;
      renderer.render(scene, camera);
    }
    draw();
    const unsubscribe = store.subscribe(draw);

    return () => {
      disposed = true;
      unsubscribe();
      texture.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    };
  }, [store]);

  return <canvas ref={ref} data-testid="preview" width={SIZE} height={SIZE} />;
}
