import type { Page } from '@playwright/test';

// 스크린샷 PNG를 페이지 안 2D 캔버스로 디코드해 해당 색 픽셀의 비율과 무게중심을 센다.
// (WebGL 캔버스를 직접 읽으면 preserveDrawingBuffer 때문에 빈 화면일 수 있어 스크린샷을 경유한다)
export async function colorStats(page: Page, png: Buffer, color: 'magenta' | 'orange') {
  return page.evaluate(
    async ([b64, color]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const hit =
          color === 'magenta'
            ? r > 80 && b > 80 && g < Math.min(r, b) / 2 // 어두워져도 통과: R·B가 높고 G가 그 절반 미만
            : r > 150 && g > r * 0.45 && g < r * 0.85 && b < r * 0.4; // #f5a623 계열
        if (!hit) continue;
        n++;
        sx += (i / 4) % c.width;
        sy += Math.floor(i / 4 / c.width);
      }
      return { ratio: n / (data.length / 4), cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
    },
    [png.toString('base64'), color] as const,
  );
}
