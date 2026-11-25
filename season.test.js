// 실행: node season.test.js
const assert = require('node:assert');
const { parseSeasonInfo, maskName } = require('./www/season.js');

const html = `
  data: function () {
    return {
      seasonInfo  : {
        custNo            : 10000000001,
        mpNo              : "01000000000",
        height            : 170,
        mpSstkIssueNo     : "3000000000000001",
        ordrBarCd         : "",


        // 모바일 QR 코드 및 인증 관련 정보
        hpBsuCd           : "1",
        tcktNo            : "100001",
        pkgUseDateYn      : "Y"
      },
      imgSrc : "/api/x/" + 10000000001,
    };`;

assert.deepStrictEqual(parseSeasonInfo(html), {
  custNo: 10000000001,
  mpNo: '01000000000',
  height: 170,
  mpSstkIssueNo: '3000000000000001',
  ordrBarCd: '',
  hpBsuCd: '1',
  tcktNo: '100001',
  pkgUseDateYn: 'Y',
});
assert.throws(() => parseSeasonInfo('<html></html>'), /시즌패스 정보/);

assert.strictEqual(maskName('홍길동'), '홍*동');
assert.strictEqual(maskName('남궁민수'), '남**수');
assert.strictEqual(maskName('이산'), '이*');
assert.strictEqual(maskName('홍*동'), '홍*동');
assert.strictEqual(maskName(''), '');
assert.strictEqual(maskName(undefined), '');
console.log('ok');
