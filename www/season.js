// 시즌패스 페이지(/m/page/mypage/history/snowpark)의 Vue data에 박힌 seasonInfo 객체를 읽는다.
// 따옴표 없는 키, 문자열/숫자 값, 주석이 섞인 JS 리터럴이라 JSON.parse를 쓸 수 없다.
function parseSeasonInfo(html) {
  const block = html.match(/seasonInfo\s*:\s*\{([^}]*)\}/);
  if (!block) throw new Error('페이지에서 시즌패스 정보를 찾지 못함');
  const info = {};
  for (const [, key, str, num] of block[1].matchAll(/(\w+)\s*:\s*(?:"([^"]*)"|(-?[\d.]+))/g)) {
    info[key] = str !== undefined ? str : Number(num);
  }
  return info;
}

if (typeof module !== 'undefined') module.exports = { parseSeasonInfo };
