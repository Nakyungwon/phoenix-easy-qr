// 시즌패스 페이지(/m/page/mypage/history/snowpark)의 Vue data에 박힌 seasonInfo 객체를 읽는다.
// 따옴표 없는 키, 문자열/숫자 값, 주석이 섞인 JS 리터럴이라 JSON.parse를 쓸 수 없다.
function parseSeasonInfo(html) {
  const block = html.match(/seasonInfo\s*:\s*\{([^}]*)\}/);
  if (!block) throw Object.assign(new Error('페이지에서 시즌패스 정보를 찾지 못함'), { code: 'season-parse' });
  const info = {};
  for (const [, key, str, num] of block[1].matchAll(/(\w+)\s*:\s*(?:"([^"]*)"|(-?[\d.]+))/g)) {
    info[key] = str !== undefined ? str : Number(num);
  }
  return info;
}

// 화면에 이름을 보여줄 때 가운데 글자를 가린다. 홍길동 → 홍*동, 이산 → 이*. 이미 가려진 값이면 그대로 둔다.
function maskName(name) {
  if (!name || name.includes('*')) return name || '';
  const chars = [...name];
  if (chars.length < 3) return chars[0] + '*';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

if (typeof module !== 'undefined') module.exports = { parseSeasonInfo, maskName };
