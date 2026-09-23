// 画面の遷移先が、すべて App.js に定義されたページを指しているかのテスト。
// 以前、組織の切り替え後に存在しない /dashboard へ移動して真っ白になっていた。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');

const listFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : listFiles(full);
    return /\.(js|jsx)$/.test(e.name) ? [full] : [];
  });

const appSource = fs.readFileSync(path.join(SRC, 'App.js'), 'utf8');
const routePatterns = Array.from(appSource.matchAll(/path="([^"]+)"/g))
  .map((m) => m[1].replace(/^\//, ''))
  .filter((p) => p && p !== '*')
  .map((p) => new RegExp(`^${p.replace(/:[^/]+/g, '[^/]+')}/?$`));

// navigate('/...') と to="/..." の、変数を含まない部分
const targetsIn = (source) =>
  Array.from(source.matchAll(/(?:navigate\(|to=\{?)['"`](\/[^'"`$?#{}]*)/g)).map((m) => m[1]);

describe('画面の遷移先', () => {
  const targets = new Map();
  listFiles(SRC).forEach((file) => {
    targetsIn(fs.readFileSync(file, 'utf8')).forEach((t) => {
      // /work-logs/edit/${id} のように後ろに変数が続くものは、途中までしか取れないので除く
      if (t.endsWith('/') && t.length > 1) return;
      targets.set(t, path.relative(SRC, file));
    });
  });

  test('遷移先が1つ以上見つかる（テスト自体が空振りしていない）', () => {
    expect(targets.size).toBeGreaterThan(20);
  });

  test.each(Array.from(targets.entries()))('%s（%s）が定義されたページを指す', (target) => {
    const t = target.replace(/^\//, '').replace(/\/$/, '');
    const ok = t === '' || routePatterns.some((re) => re.test(t));
    expect(ok).toBe(true);
  });
});
