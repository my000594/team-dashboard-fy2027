/* =============================================
   you-widget.js — 「あなたの状況」ウィジェット共通スクリプト
   ページ見出し行の右側（.you-mini）に表示する自分専用ミニダッシュボード
   （3SEレポート提出件数／得意なスキル分野／保有資格）。nav.js・data.js同様、
   ウィジェット用マークアップ（id="youMini"以下）を置いた全ページから共通で読み込む。
   member_master.csv・3se_report.csv・skill.csv・certifications.csvを自前でfetchするため、
   各ページ本体の他データ取得とは独立して動く（data.jsの5分キャッシュにより実質の
   重複fetchは発生しない）。取得・集計に失敗してもページ本体の表示には影響させない。
   ============================================= */
(function () {

  // md.js未読み込みのページでも動くよう、escapeHTML相当の簡易エスケープをここに持つ
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const MONTH_KEYS = ['8月','9月','10月','11月','12月','1月','2月','3月','4月','5月','6月','7月'];
  const calcTotal = r => MONTH_KEYS.reduce((s,m)=>s+(+r[m]||0), 0);

  // スキルマップの評価時期。新しい時期が追加されたらskill.html内のPERIODS・
  // scripts/sync-notion.mjsのSKILL_PERIODSと合わせて追記すること
  const YOU_SKILL_PERIODS = ['2026年8月','2026年11月','2027年2月','2027年5月'];

  function setupYouWidget({ memberRows, seRows, skillText, certText }) {
    const youMembers = memberRows
      .filter(r => (r['ステータス']||'').trim() === '在籍')
      .map(r => (r['氏名']||'').trim())
      .filter(Boolean);
    if (!youMembers.length) return;

    // 得意なスキル分野＝評価データが1件以上入っている時期のうち最新のもの（skill.htmlと同じ既定時期ロジック）における、
    // 分野（サブカテゴリ。無ければカテゴリ）ごとの平均レベルが最も高い分野。skill.htmlのレーダーチャート「総合」タブと
    // 同じ計算方法（未評価スキル＝レベル0も含めて平均するため、その分野の網羅度も反映される）
    const skillRows = skillText ? Papa.parse(skillText, { header: true, skipEmptyLines: true }).data : [];
    const periodsWithData = YOU_SKILL_PERIODS.filter(p => skillRows.some(r => (+r[p]||0) > 0));
    const skillPeriod = periodsWithData.length ? periodsWithData[periodsWithData.length - 1] : YOU_SKILL_PERIODS[0];

    // スキル定義（氏名を無視して重複排除）を分野ごとにグルーピング
    const skillDefMap = new Map();
    skillRows.forEach(r => {
      const skillName = (r['スキル名']||'').trim();
      if (!skillName) return;
      const sub = (r['サブカテゴリ']||'').trim();
      const cat = (r['カテゴリ']||'').trim();
      const key = skillName + '||' + sub;
      if (!skillDefMap.has(key)) skillDefMap.set(key, { key, field: sub || cat || '未分類' });
    });
    const fieldGroups = new Map(); // 分野名 -> スキル定義の配列
    skillDefMap.forEach(def => {
      if (!fieldGroups.has(def.field)) fieldGroups.set(def.field, []);
      fieldGroups.get(def.field).push(def);
    });

    // 氏名×スキルkey -> 対象時期のレベル
    const levelByMemberSkill = {};
    skillRows.forEach(r => {
      const name = (r['氏名']||'').trim();
      const skillName = (r['スキル名']||'').trim();
      if (!name || !skillName) return;
      const sub = (r['サブカテゴリ']||'').trim();
      const key = skillName + '||' + sub;
      (levelByMemberSkill[name] ??= {})[key] = +r[skillPeriod] || 0;
    });

    const bestFieldByMember = {};
    youMembers.forEach(name => {
      const levels = levelByMemberSkill[name] || {};
      let best = null;
      fieldGroups.forEach((items, field) => {
        const sum = items.reduce((s, it) => s + (levels[it.key] || 0), 0);
        const avg = items.length ? Math.round((sum / items.length) * 10) / 10 : 0;
        if (avg > 0 && (!best || avg > best.avg)) best = { field, avg };
      });
      if (best) bestFieldByMember[name] = best;
    });

    // 保有資格件数。資格分野に「研修」を含む行は資格そのものではなく研修受講の記録のため、
    // 一覧（skill.htmlの💯保有資格カード）には残すがこの件数にはカウントしない
    const certRows = certText ? Papa.parse(certText, { header: true, skipEmptyLines: true }).data : [];
    const certCountByMember = {};
    certRows.forEach(r => {
      const name = (r['氏名']||'').trim();
      if (!name || (r['資格分野']||'').trim().includes('研修')) return;
      certCountByMember[name] = (certCountByMember[name] || 0) + 1;
    });

    const seByMember = {};
    seRows.forEach(r => {
      const name = (r['社員番号']||'').trim(); // 3se_report.csvのタイトル列。実体は氏名
      if (!name) return;
      seByMember[name] = { count: calcTotal(r), ok: r['達成状況'] === '達成' };
    });

    const STORE_KEY = 'you_widget_member';
    const head = document.getElementById('youMiniHead');
    const card = document.getElementById('youCard');
    const dropdown = document.getElementById('youDropdown');

    function renderYou(name) {
      document.getElementById('youAvatar').textContent = name.charAt(0);
      document.getElementById('youName').textContent = name;

      const se = seByMember[name];
      const field = bestFieldByMember[name];
      const certs = certCountByMember[name] || 0;
      const q = encodeURIComponent(name);

      const seHTML = se
        ? `<span class="you-mini-stat-value ${se.ok ? '' : 'warn'}">${se.count}件</span><span class="you-mini-stat-sub ${se.ok ? 'green' : 'red'}">（${se.ok ? '達成' : '未達成'}）</span>`
        : `<span class="you-mini-stat-value">ー</span>`;
      const fieldHTML = field
        ? `<span class="you-mini-stat-value">${esc(field.field)}</span><span class="you-mini-stat-sub">平均Lv.${field.avg}</span>`
        : `<span class="you-mini-stat-value">評価データなし</span>`;
      // レーダーチャートの分野タブへ直接飛べるよう&groupも付ける（skill.html側が分野名と一致すればそのタブを自動選択）
      const skillHref = `skill.html?member=${q}&tab=radar` + (field ? `&group=${encodeURIComponent(field.field)}` : '');

      const seDot = se ? `<span class="dot ${se.ok ? 'green' : 'red'}"></span>` : '';
      document.getElementById('youStats').innerHTML = `
        <a class="you-mini-stat stat-se" href="reports.html" title="3SEレポートページへ">
          <span class="you-mini-stat-label">${seDot}3SEレポート提出件数</span>
          <span class="you-mini-stat-value-row">${seHTML}</span>
        </a>
        <a class="you-mini-stat stat-skill" href="${skillHref}" title="スキルマップ（本人の得意分野レーダー表示）へ">
          <span class="you-mini-stat-label">⭐ 得意なスキル分野</span>
          <span class="you-mini-stat-value-row">${fieldHTML}</span>
        </a>
        <a class="you-mini-stat stat-cert" href="skill.html?member=${q}#certifications" title="スキルマップ（保有資格一覧）へ">
          <span class="you-mini-stat-label">📜 保有資格</span>
          <span class="you-mini-stat-value-row"><span class="you-mini-stat-value">${certs}件</span></span>
        </a>
      `;
    }

    function selectMember(name, { persist } = { persist: true }) {
      if (!youMembers.includes(name)) return;
      document.querySelectorAll('.you-mini-chip').forEach(c => c.classList.toggle('sel', c.textContent === name));
      renderYou(name);
      if (persist) {
        localStorage.setItem(STORE_KEY, name);
        document.getElementById('youFootNote').textContent = `「${name}」として記憶しています。次回からこのブラウザで自動的に表示されます`;
        document.getElementById('youReset').style.display = 'inline-block';
      }
    }

    function buildChips() {
      const wrap = document.getElementById('youChips');
      wrap.innerHTML = '';
      youMembers.forEach(name => {
        const b = document.createElement('button');
        b.className = 'you-mini-chip';
        b.textContent = name;
        b.onclick = (e) => { e.stopPropagation(); selectMember(name); closeDropdownOnly(); };
        wrap.appendChild(b);
      });
    }

    // 「名前選択パネル（ドロップダウン）」の開閉と「指標の表示（モバイルのみ）」の開閉は別々の状態として持つ。
    // ヘッダーをタップした時は両方を一緒に開閉するが、名前を選んだ時はドロップダウンだけを閉じ、
    // モバイルで開いている指標はそのまま表示し続ける（見たいのは切替後の中身のため）
    function setDropdownOpen(open) {
      head.classList.toggle('open', open);
      dropdown.classList.toggle('open', open);
      head.setAttribute('aria-expanded', String(open));
    }
    function setStatsExpanded(open) { card.classList.toggle('expanded', open); }
    function closeDropdownOnly() { setDropdownOpen(false); }

    head.onclick = (e) => {
      e.stopPropagation();
      const opening = !dropdown.classList.contains('open');
      setDropdownOpen(opening);
      setStatsExpanded(opening);
    };
    document.addEventListener('click', (e) => {
      if (!document.getElementById('youMini').contains(e.target)) {
        setDropdownOpen(false);
        setStatsExpanded(false);
      }
    });
    document.getElementById('youReset').onclick = (e) => {
      e.stopPropagation();
      localStorage.removeItem(STORE_KEY);
      document.getElementById('youFootNote').textContent = '初回だけ選ぶと、次回から自動でこの人の状況が表示されます（このブラウザに記憶）';
      document.getElementById('youReset').style.display = 'none';
    };

    buildChips();
    const saved = localStorage.getItem(STORE_KEY);
    const initial = saved && youMembers.includes(saved) ? saved : youMembers[0];
    selectMember(initial, { persist: !!saved });
    document.getElementById('youMini').style.display = '';
  }

  async function initYouWidget() {
    const mini = document.getElementById('youMini');
    if (!mini) return; // このページにウィジェット用マークアップが無ければ何もしない

    try {
      const [memberR, seR, skillR, certR] = await Promise.all([
        fetchCSVText('data/members/member_master.csv'),
        fetchCSVText('data/3se_report.csv'),
        fetchCSVText('data/skill.csv'),
        fetchCSVText('data/certifications.csv'),
      ]);
      if (!memberR.ok || !seR.ok) return; // 必須データが取得できない場合はウィジェットを出さない

      const memberRows = Papa.parse(memberR.text, { header: true, skipEmptyLines: true }).data;
      const seRows = Papa.parse(seR.text, { header: true, skipEmptyLines: true }).data;

      setupYouWidget({
        memberRows, seRows,
        skillText: skillR.ok ? skillR.text : '',
        certText: certR.ok ? certR.text : '',
      });
    } catch (e) {
      // ウィジェットの読み込み失敗はページ本体の表示に影響させない
    }
  }

  initYouWidget();

})();
