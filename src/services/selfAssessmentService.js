// src/services/selfAssessmentService.js
// 自己点検（内部監査）記録。
// GAP認証では年1回以上の自己点検と、その記録・是正処置の保存が求められる。
// ここでは一般的な管理点を分野別にまとめた簡易チェックリストを提供する。
//
// 注意: 本チェックリストは日常運用の自己点検を支援するための簡易版です。
// 実際の審査では認証機関が配布する最新の管理点・適合基準（チェックリスト）が
// 正式な基準となるため、そちらと併用してください。
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';

export const ASSESSMENT_STATUS = ['適合', '不適合', '該当なし'];

// 主要な管理領域ごとの点検項目（簡易版）
export const CHECKLIST_TEMPLATE = [
  {
    category: '記録・トレーサビリティ',
    items: [
      '圃場（ベッド）ごとに識別できる名称・番号が付けられている',
      '収穫物にロット番号を付け、圃場までさかのぼれる',
      '出荷先と出荷ロットの記録が残っている',
      '記録は少なくとも2年以上保管されている',
      '模擬回収（トレーサビリティテスト）を実施し記録している'
    ]
  },
  {
    category: '食品安全・衛生管理',
    items: [
      '収穫・調製に使う器具（ハサミ・トレイ等）の洗浄手順が定められ、記録している',
      '作業場・トイレ・手洗い設備の清掃を実施し記録している',
      '作業者の健康状態を確認する仕組みがある（体調不良時の作業制限）',
      '手洗い・手指消毒の設備があり使用方法を周知している',
      'ねずみ・害虫・鳥獣の侵入対策を実施し確認記録がある',
      '収穫物にガラス・金属等の異物が混入しない対策をとっている'
    ]
  },
  {
    category: '水・養液の管理',
    items: [
      '灌水・養液に使用する水の水源が特定されている',
      '水質検査を実施し、結果を保管している',
      '収穫後の洗浄に使う水の安全性を確認している',
      '養液のEC・pH等を定期的に測定し記録している'
    ]
  },
  {
    category: '農薬の管理',
    items: [
      '使用する農薬は対象作物に登録があるものだけを使用している',
      '農薬使用記録（日付・薬剤・対象・希釈・使用量・処理面積・実施者）を残している',
      '収穫前日数（PHI）と使用回数を守っている',
      '農薬は施錠できる専用の場所に保管している',
      '有効期限切れ・失効した農薬を区分し適切に処分している',
      '散布器具の点検・洗浄を実施している',
      '空容器・残液を適切に処理している'
    ]
  },
  {
    category: '肥料・培地の管理',
    items: [
      '肥料の使用記録（日付・種類・量・圃場）を残している',
      '肥料は農薬と区分して保管している',
      '培地・資材の仕入先と受入記録がある'
    ]
  },
  {
    category: '労働安全・衛生',
    items: [
      '作業者に必要な保護具（PPE）を用意し、使用を指導している',
      '農薬を扱う作業者に必要な教育・訓練を実施し記録している',
      '救急箱・緊急連絡先を整備し、周知している',
      '事故・ヒヤリハットが発生した場合の記録と対応の仕組みがある',
      '機械・設備の安全点検を実施している'
    ]
  },
  {
    category: '教育・訓練',
    items: [
      '作業者に対して衛生管理・安全に関する教育を実施し記録している',
      '新しく作業に加わる人への説明を実施している',
      '外部からの訪問者の記録と衛生ルールの説明を行っている'
    ]
  },
  {
    category: '環境・廃棄物',
    items: [
      '廃棄物の種類ごとに分別・保管・処理をしている',
      '使用済み培地・資材の処理方法が定められている',
      'エネルギー・水の使用量を把握する取り組みがある'
    ]
  },
  {
    category: '苦情・改善',
    items: [
      '苦情を受け付けた場合の記録と対応の仕組みがある',
      '前回の自己点検で見つかった不適合に是正処置を行い記録している'
    ]
  }
];

/** テンプレートからチェック項目の初期配列を作る */
export const buildInitialItems = () => {
  const items = [];
  CHECKLIST_TEMPLATE.forEach((group) => {
    group.items.forEach((text, i) => {
      items.push({
        key: `${group.category}-${i}`,
        category: group.category,
        text,
        status: '',
        correctiveAction: '',
        dueDate: ''
      });
    });
  });
  return items;
};

/** 自己点検の一覧を取得（新しい順） */
export const getSelfAssessments = async (organizationId) => {
  const snapshot = await getDocs(query(
    collection(db, 'selfAssessments'),
    where('organizationId', '==', organizationId)
  ));
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const at = a.startedAt?.toDate ? a.startedAt.toDate().getTime() : 0;
    const bt = b.startedAt?.toDate ? b.startedAt.toDate().getTime() : 0;
    return bt - at;
  });
  return list;
};

/** 自己点検を1件取得 */
export const getSelfAssessment = async (id) => {
  const snap = await getDoc(doc(db, 'selfAssessments', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/** 新しい自己点検を作成 */
export const createSelfAssessment = async (organizationId, title, createdByName) => {
  const ref = await addDoc(collection(db, 'selfAssessments'), {
    organizationId,
    title,
    items: buildInitialItems(),
    createdByName: createdByName || '',
    startedAt: serverTimestamp(),
    completedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
};

/** 自己点検を更新 */
export const updateSelfAssessment = async (id, updates) => {
  await updateDoc(doc(db, 'selfAssessments', id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

/** 自己点検を削除 */
export const deleteSelfAssessment = async (id, organizationId, deletedByName) => {
  // すぐには消さず、ゴミ箱へ移して一定期間戻せるようにする
  await moveToTrash('selfAssessments', id, organizationId, deletedByName);
};

/** 進捗の集計 */
export const summarize = (items = []) => {
  const total = items.length;
  const answered = items.filter((i) => i.status).length;
  const nonConform = items.filter((i) => i.status === '不適合').length;
  const conform = items.filter((i) => i.status === '適合').length;
  return { total, answered, nonConform, conform };
};
