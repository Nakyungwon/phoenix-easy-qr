// 잠금화면 배경용 이미지를 캔버스로 만든다.
// 위쪽 약 35%는 잠금화면 시계, 아래쪽 약 15%는 바로가기/알림 자리라서 QR 카드를 그 사이에 둔다.
function composeLockWallpaper({ qrImg, issueNo, date, ticket }) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(screen.width * dpr);
  const h = Math.round(screen.height * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0F2A5F');
  bg.addColorStop(0.6, '#1E3A8A');
  bg.addColorStop(1, '#3B82F6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const unit = Math.min(w, h);
  const qrSize = Math.round(unit * 0.62);
  const pad = Math.round(unit * 0.04);
  const cardW = qrSize + pad * 2;
  const x = Math.round((w - cardW) / 2);
  const top = Math.round(h * 0.4);
  const font = (weight, size) => `${weight} ${Math.round(size)}px -apple-system, system-ui, 'Noto Sans KR', sans-serif`;

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = font(600, unit * 0.035);
  const title = [ticket && ticket.sesnDivNm, ticket && maskName(ticket.showKorCustNm), ticket && ticket.viewTcktNo].filter(Boolean).join(' · ');
  ctx.fillText(title || '휘팍 이지 QR', w / 2, top - unit * 0.035);

  // QR은 스캐너가 읽도록 흰 바탕 위에, 픽셀을 뭉개지 않고 그린다.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x, top, cardW, cardW, Math.round(unit * 0.035));
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImg, x + pad, top + pad, qrSize, qrSize);

  ctx.fillStyle = '#fff';
  ctx.font = font(700, unit * 0.04);
  ctx.fillText(issueNo, w / 2, top + cardW + unit * 0.07);
  ctx.fillStyle = '#86EFAC';
  ctx.font = font(600, unit * 0.034);
  ctx.fillText(`${date} 23:59까지 유효`, w / 2, top + cardW + unit * 0.125);

  return canvas.toDataURL('image/png');
}

// 서비스 QR 이미지(api.qrserver.com, 여백 1칸)를 모듈 격자로 읽는다. iOS 라이브 액티비티는 이미지를 못 넘겨서 이걸 넘긴다.
// 왼쪽 위 파인더 패턴이 7칸 너비라는 점으로 한 칸 크기를 구한다.
function readQrModules(img) {
  const w = img.naturalWidth;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = w;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, w).data;
  const dark = (x, y) => px[(Math.floor(y) * w + Math.floor(x)) * 4] < 128;

  let start = 0;
  while (start < w && !dark(start, start)) start++;
  let end = start;
  while (end < w && dark(end, start)) end++;
  const cell = (end - start) / 7;
  const size = Math.round(w / cell) - 2;

  let modules = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) modules += dark(start + (c + 0.5) * cell, start + (r + 0.5) * cell) ? '1' : '0';
  }
  return { size, modules };
}
