// src/services/trainingItemService.js
// 教育訓練の項目マスタ（年間計画）。
//
// 「何を教えるか」を年度ごとに定義しておき、日々の実施記録はここから選ぶだけにする。
// 計画（マスタ）と実施記録（ログ）を分けることで、
// 「計画どおり実施できているか」を審査で示せるようにする。
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { moveToTrash } from './trashService';
import { firestoreLogger } from '../utils/logger';

// 実施頻度の目安
export const TRAINING_FREQUENCIES = ['実習の都度', '毎月', '学期ごと', '年度当初', '年1回', '随時'];

// 受講者の区分（学年単位で記録するのが実際の運用に合う）
export const DEFAULT_AUDIENCES = [
  '教職員',
  '1年生',
  '2年生',
  '3年生',
  '1・2・3年生',
  '1・2年生'
];

// 教育訓練計画の項目①〜⑩（指導内容のメモ付き）
export const DEFAULT_TRAINING_ITEMS = [
  {
    code: '①',
    title: '農場全体の衛生管理',
    frequency: '年度当初',
    description: '入場前の手洗い・手指消毒、作業着と靴の使い分け、温室内での飲食禁止、清掃当番と清掃チェック表の付け方'
  },
  {
    code: '②',
    title: '基本の身だしなみ・体調チェック',
    frequency: '実習の都度',
    description: '爪・髪・アクセサリー・絆創膏の確認、手指の傷の申告、発熱や下痢のときは収穫作業に入らないルール'
  },
  {
    code: '③',
    title: '機械操作時の身だしなみ・応急処置方法',
    frequency: '実習の都度',
    description: '巻き込まれ防止（袖・裾・手袋）、使用前点検と非常停止の位置、切り傷・打撲時の応急処置と報告手順'
  },
  {
    code: '④',
    title: '農薬散布時の服装・熱中症対策',
    frequency: '随時',
    description: '保護具（マスク・手袋・保護メガネ・長袖）の着用、散布中と散布後の立入禁止、水分補給と休憩の取り方'
  },
  {
    code: '⑤',
    title: '農薬事故への対応手順',
    frequency: '年1回',
    description: '皮膚付着・眼への飛入・誤飲時の洗浄手順、緊急連絡先と受診の流れ、ラベルの持参、事故記録の残し方'
  },
  {
    code: '⑥',
    title: '収穫・選果・保管の衛生・収穫容器の取扱',
    frequency: '学期ごと',
    description: '収穫前の手洗い、ハサミ・収穫トレイの洗浄と乾燥、容器の直置き禁止、異物混入の防止、先入れ先出し'
  },
  {
    code: '⑦',
    title: '苦情処理等の手順',
    frequency: '年1回',
    description: '苦情を受けたら記録して責任者へ報告、ロット番号から圃場と収穫日をさかのぼる方法、再発防止策の共有'
  },
  {
    code: '⑧',
    title: '生徒の健康管理及び衛生面について',
    frequency: '実習の都度',
    description: '実習前の体調確認、手指の傷や感染症時の作業制限、水分補給と休憩、実習記録簿を使った振り返りと相談'
  },
  {
    code: '⑨',
    title: '獣害モニタリング',
    frequency: '随時',
    description: 'ネズミ・鳥・昆虫の侵入経路と痕跡の見つけ方、粘着トラップ・防虫ネットの設置場所と確認記録、発見時の報告'
  },
  {
    code: '⑩',
    title: '1年間の反省と次年度の課題',
    frequency: '年1回',
    description: '年間の記録を振り返り、ヒヤリハット・苦情・自己点検の不適合を確認し、次年度の改善点を計画に反映する'
  }
];

/** 年度（4月始まり）を求める */
export const fiscalYearOf = (date) => {
  const d = new Date(date);
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
};

/** 訓練項目の一覧を取得（順番どおり） */
export const getTrainingItems = async (organizationId) => {
  const snapshot = await getDocs(query(
    collection(db, 'trainingItems'),
    where('organizationId', '==', organizationId)
  ));
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return items;
};

/** 標準の訓練項目をまとめて登録 */
export const seedDefaultTrainingItems = async (organizationId) => {
  const created = [];
  for (let i = 0; i < DEFAULT_TRAINING_ITEMS.length; i++) {
    const item = DEFAULT_TRAINING_ITEMS[i];
    const data = {
      organizationId,
      code: item.code || '',
      title: item.title,
      frequency: item.frequency,
      description: item.description || '',
      order: i,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'trainingItems'), data);
    created.push({ id: ref.id, ...data });
  }
  firestoreLogger.info('標準の教育訓練項目を登録しました', { organizationId, count: created.length });
  return created;
};

/** 訓練項目を保存（新規 or 更新） */
export const saveTrainingItem = async (organizationId, itemId, form) => {
  const data = {
    organizationId,
    code: form.code || '',
    title: form.title.trim(),
    frequency: form.frequency || '',
    description: form.description || '',
    order: form.order ?? 0,
    active: form.active !== false,
    updatedAt: serverTimestamp()
  };
  if (itemId) {
    await updateDoc(doc(db, 'trainingItems', itemId), data);
    return itemId;
  }
  const ref = await addDoc(collection(db, 'trainingItems'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
};

/** 訓練項目を削除 */
export const deleteTrainingItem = async (itemId, organizationId, deletedByName) => {
  // すぐには消さず、ゴミ箱へ移して一定期間戻せるようにする
  await moveToTrash('trainingItems', itemId, organizationId, deletedByName);
};

/**
 * 年度内の実施状況を項目ごとに集計する。
 * 「計画した項目を実施できているか」を確認するために使う。
 */
export const summarizeItemProgress = (items, trainings, fiscalYear) => {
  const inYear = trainings.filter((t) => {
    const d = t.trainingDate;
    return d && fiscalYearOf(d) === fiscalYear;
  });

  return items.map((item) => {
    const done = inYear.filter((t) => (t.itemIds || []).includes(item.id));
    const lastDate = done.reduce((latest, t) => {
      const d = t.trainingDate;
      return !latest || (d && d > latest) ? d : latest;
    }, null);
    // のべ受講者数（同じ人が複数回受けた場合も回数として数える）
    const attendeeTotal = done.reduce((sum, t) => sum + (t.attendeeNames?.length || 0), 0);
    return {
      item,
      count: done.length,
      lastDate,
      attendeeTotal
    };
  });
};
