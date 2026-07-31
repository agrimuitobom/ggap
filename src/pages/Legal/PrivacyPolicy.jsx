// src/pages/Legal/PrivacyPolicy.jsx
// プライバシーポリシー。
//
// ★公開前に、下の CONTACT（問い合わせ先メールアドレス）を記入してください。
//   空のままでも表示は崩れませんが、方針としては連絡先の明示が必要です。
import React from 'react';
import { Link } from 'react-router-dom';

const SERVICE_NAME = 'GAP Tracker';
const OPERATOR_NAME = '野田千尋';
// 連絡先メールアドレス。空にしておくと、代わりに「準備中」の案内が表示されます。
const CONTACT = '';
const EFFECTIVE_DATE = '2026年7月31日';

const Section = ({ title, children }) => (
  <section className="mb-6">
    <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
    <div className="text-sm text-gray-700 space-y-2 leading-relaxed">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ol className="list-decimal list-outside ml-5 space-y-1">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ol>
);

const PrivacyPolicy = () => (
  <div className="container mx-auto p-4 max-w-3xl pb-24">
    <h1 className="text-2xl font-bold mb-1">プライバシーポリシー</h1>
    <p className="text-sm text-gray-500 mb-6">
      制定日：{EFFECTIVE_DATE}　／　{SERVICE_NAME}
    </p>

    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-8">
      <h2 className="font-bold text-blue-900 mb-2">はじめに（要点）</h2>
      <ul className="list-disc list-outside ml-5 text-sm text-blue-900 space-y-1">
        <li>本サービスは、農場の記録に必要な情報のみを取得します。</li>
        <li>取得した情報を、<strong>広告に利用したり第三者へ販売したりすることはありません</strong>。</li>
        <li>データは Google の Firebase に保存され、<strong>組織ごとに分離</strong>されています。他の組織のデータは閲覧できません。</li>
        <li>従業員・生徒の氏名を登録する場合は、<strong>登録する側（利用者）が本人への説明と同意</strong>を行ってください。</li>
        <li>ご自身のデータは、いつでも書き出し・削除できます。</li>
      </ul>
    </div>

    <Section title="1. 事業者情報">
      <p>
        本サービス「{SERVICE_NAME}」は、{OPERATOR_NAME}（以下「運営者」といいます）が提供します。
        運営者は、本サービスの利用にともなって取得する個人情報を、個人情報の保護に関する法律
        その他の関係法令およびガイドラインを遵守し、適切に取り扱います。
      </p>
    </Section>

    <Section title="2. 取得する情報">
      <p>本サービスでは、次の情報を取得します。</p>

      <p className="font-semibold mt-3">(1) アカウントに関する情報</p>
      <List items={[
        '氏名（表示名）',
        'メールアドレス',
        '所属する組織および権限（管理者・メンバー・閲覧者）',
        'Googleアカウントでログインする場合は、Googleから提供される氏名・メールアドレス・アカウント識別子'
      ]} />

      <p className="font-semibold mt-3">(2) 利用者が入力する記録の情報</p>
      <List items={[
        '栽培・作業・収穫・出荷・資材（農薬・肥料・種子）の使用に関する記録',
        '圃場・作付・養液管理・水質検査などの管理記録',
        '清掃、教育訓練、訪問者、事故・ヒヤリハット、苦情、自己点検などの記録',
        '記録に添付された写真',
        '上記の記録に含まれる、従業員・生徒・訪問者等の氏名（利用者が入力した場合）',
        '記録の作成者・更新者・確認者の氏名および日時'
      ]} />

      <p className="font-semibold mt-3">(3) 自動的に取得する情報</p>
      <List items={[
        '不具合の原因を調べるためのエラー情報（発生日時、画面、エラー内容）',
        '天気の自動入力機能を利用する場合の位置情報（緯度・経度）※後述'
      ]} />
    </Section>

    <Section title="3. 利用目的">
      <p>取得した情報は、次の目的で利用します。</p>
      <List items={[
        '本サービスの提供、本人確認、および利用者の認証',
        '記録の保存、表示、集計、書き出し等の機能を提供するため',
        '組織内でのデータ共有および権限管理のため',
        '不具合の調査、障害対応、および本サービスの改善のため',
        '利用者からの問い合わせに対応するため',
        '本サービスに関する重要なお知らせを行うため'
      ]} />
      <p>
        運営者は、上記の目的の範囲を超えて個人情報を利用しません。
        広告目的での利用、および個人情報の販売は行いません。
      </p>
    </Section>

    <Section title="4. 位置情報の取り扱い">
      <p>
        本サービスには、防除記録の天候・気温・風速を自動入力する機能があります。
        この機能を利用する場合に限り、端末の位置情報を取得します。
      </p>
      <List items={[
        '位置情報は、天気情報を取得するためだけに使用し、本サービスには保存しません。',
        '取得した緯度・経度は、天気情報の提供元（Open-Meteo）へ送信されます。',
        '位置情報の利用には、ブラウザ上での許可が必要です。許可しない場合でも、天候等を手入力して本サービスを利用できます。'
      ]} />
    </Section>

    <Section title="5. データの保存場所と管理">
      <List items={[
        '本サービスのデータは、Google LLC が提供するクラウドサービス「Firebase」（Cloud Firestore および Cloud Storage）に保存されます。',
        'データは組織ごとに分離して保存され、所属していない組織のデータを閲覧・編集することはできません。',
        '通信は暗号化（HTTPS）されます。',
        '運営者は、障害対応および利用者からの依頼に対応するために必要な範囲で、データを確認することがあります。',
        'Firebase のデータ保存先の地域については、Google の定めるところによります。国外のサーバーに保存される場合があります。'
      ]} />
      <p className="text-xs text-gray-500">
        参考：Firebase のプライバシーとセキュリティに関する情報は、Google の公表する資料をご確認ください。
      </p>
    </Section>

    <Section title="6. 第三者提供">
      <p>
        運営者は、次の場合を除き、個人情報を第三者に提供しません。
      </p>
      <List items={[
        '本人の同意がある場合',
        '法令にもとづく場合',
        '人の生命、身体または財産の保護のために必要があり、本人の同意を得ることが困難な場合',
        '本サービスの提供に必要な範囲で、前条の外部サービス（Firebase 等）に取り扱いを委託する場合'
      ]} />
    </Section>

    <Section title="7. 利用者が入力する第三者の個人情報について">
      <p className="bg-amber-50 border border-amber-300 rounded p-3">
        本サービスでは、利用者が従業員・生徒・訪問者等の氏名を入力することがあります。
        この場合、その情報を取り扱う責任は、入力を行った利用者（およびその所属団体）にあります。
      </p>
      <List items={[
        '利用者は、第三者の個人情報を入力するにあたり、あらかじめ本人（未成年者の場合は保護者を含みます）に対して利用目的を説明し、必要な同意を得るものとします。',
        '運営者は、これらの情報を本サービスの提供に必要な範囲でのみ取り扱います。',
        '入力された第三者の個人情報について、本人から開示・訂正・削除等の求めがあった場合は、原則として入力を行った利用者が対応するものとします。'
      ]} />
    </Section>

    <Section title="8. 保存期間">
      <List items={[
        '記録は、利用者が削除するまで保存されます。',
        '削除された記録は「ゴミ箱」に一定期間（30日間）保管され、その後は削除されます。',
        '利用の終了後、運営者は登録データを一定期間経過後に削除することがあります。',
        '法令上保存が必要な記録については、利用者ご自身で書き出して保管してください。'
      ]} />
    </Section>

    <Section title="9. 安全管理のための措置">
      <List items={[
        '通信の暗号化（HTTPS）を行っています。',
        'アクセス権限を組織および役割（管理者・メンバー・閲覧者）にもとづいて制限しています。',
        '記録の削除は「ゴミ箱」を経由し、完全な削除は管理者のみが行えるようにしています。',
        '不具合の調査に用いる記録では、パスワード、メールアドレス等を伏せる処理を行っています。'
      ]} />
      <p>
        ただし、インターネットを通じたサービスの性質上、完全な安全性を保証するものではありません。
      </p>
    </Section>

    <Section title="10. 開示・訂正・削除等の求め">
      <List items={[
        '利用者は、本サービス上でご自身のデータを閲覧・修正・削除できます。また、書き出し（バックアップ）機能により、データを取得できます。',
        '上記の方法によることが難しい場合や、アカウントの削除をご希望の場合は、末尾の連絡先までご連絡ください。運営者は、本人であることを確認したうえで、法令に従い対応します。'
      ]} />
    </Section>

    <Section title="11. Cookie 等の利用">
      <p>
        本サービスは、ログイン状態の保持およびオフラインでの利用のため、
        ブラウザの保存領域（Cookie、ローカルストレージ等）を使用します。
        広告目的の追跡や、第三者による行動履歴の収集は行っていません。
      </p>
    </Section>

    <Section title="12. 未成年者の利用について">
      <p>
        本サービスを未成年者が利用する場合は、保護者または学校等の管理者の指導のもとで利用してください。
        学校等が生徒に利用させる場合は、当該学校等が本人および保護者への説明と同意の取得を行うものとします。
      </p>
    </Section>

    <Section title="13. 本ポリシーの変更">
      <List items={[
        '運営者は、必要に応じて本ポリシーを変更することがあります。',
        '変更後の内容は、本サービス上に掲示した時点から適用されます。',
        '重要な変更を行う場合は、本サービス上で通知するよう努めます。'
      ]} />
    </Section>

    <Section title="14. お問い合わせ窓口">
      <p>個人情報の取り扱いに関するお問い合わせは、次の連絡先までお願いします。</p>
      <p className="font-medium">{OPERATOR_NAME}{CONTACT ? `　${CONTACT}` : ''}</p>
      {!CONTACT && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded p-2">
          ※ 問い合わせ用のメールアドレスは現在準備中です。当面は、所属組織の管理者を通じてご連絡ください。
        </p>
      )}
    </Section>

    <p className="text-sm text-gray-500 mt-8">以上</p>

    <div className="mt-6 flex flex-wrap gap-3">
      <Link to="/" className="text-blue-600 hover:text-blue-800 underline text-sm">ホームへ戻る</Link>
      <Link to="/terms" className="text-blue-600 hover:text-blue-800 underline text-sm">利用規約</Link>
    </div>
  </div>
);

export default PrivacyPolicy;
