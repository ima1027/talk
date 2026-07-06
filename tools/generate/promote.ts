// 監修済みドラフトを src/content/scenarios/ へ昇格させる(docs/requirements.md §8.3)。
// 使い方: npm run promote -- content/drafts/<id>.json

import { existsSync, readFileSync, renameSync } from 'node:fs';
import { basename, join } from 'node:path';
import { assertValidScenario } from '../../src/engine/validate';

const SCENARIOS_DIR = join(import.meta.dirname, '../../src/content/scenarios');

const draftPath = process.argv[2];
if (!draftPath || !existsSync(draftPath)) {
  console.error('使い方: npm run promote -- content/drafts/<id>.json');
  process.exit(1);
}

const scenario = assertValidScenario(JSON.parse(readFileSync(draftPath, 'utf8')));
const destPath = join(SCENARIOS_DIR, `${scenario.id}.json`);
if (existsSync(destPath)) {
  console.error(`エラー: ${destPath} は既に存在します(idを変えるか既存を削除してください)`);
  process.exit(1);
}
if (basename(draftPath) !== `${scenario.id}.json`) {
  console.warn(`注意: ファイル名(${basename(draftPath)})と id(${scenario.id})が一致していません。id を採用します。`);
}

renameSync(draftPath, destPath);
console.log(`✔ 昇格: ${destPath}`);
console.log('npm test でコンテンツ整合性チェックを実行し、アプリで一度プレイして確認してください。');
