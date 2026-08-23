/* =============================================
   md.js — 本文（Markdown／Notion貼り付けテキスト）共通レンダラ
   index.html / info.html / knowledge.html から共通で読み込む。
   出力は style.css の .md-body 配下のスタイル前提。
   ============================================= */
(function (global) {

  const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  const RE_STEP = new RegExp('^([' + CIRCLED + '])\\s*(.*)$');

  // Notion/CSV由来の本文をそのままinnerHTMLに流すため、まずHTMLとして無害化する
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function link(url, label) {
    return '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>';
  }

  // OneDrive/SharePointの「リンクをコピー」で取れる共有リンクはビューアページを指しており、
  // <img>にそのまま使うとログイン画面にリダイレクトされ表示できない。download=1を付けると
  // 生ファイルを返す挙動になるため、画像記法で使われた場合は自動で付与する
  // （呼び出し時点でescHTML済みのためURL中の&は&amp;になっている）。
  function normalizeImgUrl(url) {
    if (/\.sharepoint\.com\//i.test(url) && !/download=/i.test(url)) {
      return url + (url.indexOf('?') === -1 ? '?' : '&amp;') + 'download=1';
    }
    return url;
  }

  // 行内装飾。リンク・コードは先に退避してから強調を処理する
  // （URL内の記号が強調記法として誤爆するのを防ぐため）
  function inline(text) {
    const keep = [];
    const stash = html => '\u0000' + (keep.push(html) - 1) + '\u0000';

    let t = String(text)
      .replace(/`([^`]+)`/g, (m, c) => stash('<code>' + c + '</code>'))
      // ![alt](URL) は通常のリンク記法より先に処理する（後段の[label](url)にマッチさせないため）
      .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, (m, alt, url) =>
        stash('<img src="' + normalizeImgUrl(url) + '" alt="' + alt + '" loading="lazy">'))
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, label, url) => stash(link(url, label)))
      .replace(/https?:\/\/[^\s<>"'）】」、。]+/g, url => stash(link(url, url)));

    t = t
      .replace(/\*\*\s*([^*]+?)\s*\*\*/g, '<strong>$1</strong>')
      .replace(/~~\s*([^~]+?)\s*~~/g, '<del>$1</del>');

    return t.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
  }

  // 連続するリスト行をインデント深さに応じて入れ子で組み立てる
  function renderList(items, pos, indent) {
    const first = items[pos];
    const tag = first.ordered ? 'ol' : 'ul';
    const attr = first.ordered && first.num !== 1 ? ' start="' + first.num + '"' : '';
    let html = '<' + tag + attr + '>';
    let i = pos;

    while (i < items.length && items[i].indent >= indent) {
      if (items[i].indent > indent) {
        const sub = renderList(items, i, items[i].indent);
        html = html.replace(/<\/li>$/, sub.html + '</li>');
        i = sub.next;
        continue;
      }
      if (items[i].ordered !== first.ordered) break;
      html += '<li>' + inline(items[i].text) + '</li>';
      i++;
    }
    return { html: html + '</' + tag + '>', next: i };
  }

  function md2html(src) {
    if (src === null || src === undefined || src === '') return '';

    const lines = esc(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];      // 連続する通常行（<br>で連結して1段落にする）
    let items = [];     // 連続するリスト行
    let quote = [];     // 連続する引用行

    const flushPara = () => {
      if (!para.length) return;
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
      para = [];
    };
    const flushList = () => {
      // renderListは種類（順序あり／なし）が変わる位置で止まるため、
      // 残りが無くなるまで繰り返して1件も取りこぼさないようにする
      while (items.length) {
        const run = renderList(items, 0, items[0].indent);
        const consumed = items.slice(0, run.next);
        // 「1. 手順の概要」のように番号行が単独で立っている場合は、リストではなく
        // 章見出しとして扱う（番号は残す）。Notionの本文では番号ブロックが
        // 章立てに使われることが多く、<ol>にすると階層が潰れて読みにくくなるため。
        if (consumed.length === 1 && consumed[0].ordered && consumed[0].indent === 0) {
          out.push('<p class="md-numhead"><span class="md-num">' + consumed[0].num + '.</span>' +
                   inline(consumed[0].text) + '</p>');
        } else {
          out.push(run.html);
        }
        items = items.slice(Math.max(run.next, 1));
      }
    };
    const flushQuote = () => {
      if (!quote.length) return;
      out.push('<blockquote>' + quote.map(l => '<p>' + inline(l) + '</p>').join('') + '</blockquote>');
      quote = [];
    };
    const flush = () => { flushPara(); flushList(); flushQuote(); };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      if (!line) { flush(); continue; }

      // ```コードブロック```
      if (/^```/.test(line)) {
        flush();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        out.push('<pre><code>' + buf.join('\n') + '</code></pre>');
        continue;
      }

      // # 見出し（旧レンダラと同じく ## → h2 / ### → h3）
      let m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m) {
        flush();
        const lv = m[1].length <= 2 ? 2 : Math.min(m[1].length, 4);
        out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>');
        continue;
      }

      // --- 区切り線
      if (/^([-*_]\s*){3,}$/.test(line)) { flush(); out.push('<hr>'); continue; }

      // | 表 |
      if (/^\|.*\|$/.test(line)) {
        flush();
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
          i++;
        }
        i--;
        const hasHead = rows.length > 1 && rows[1].every(c => /^:?-{2,}:?$/.test(c));
        const body = hasHead ? rows.slice(2) : rows;
        let html = '<div class="md-tbl-wrap"><table>';
        if (hasHead) html += '<thead><tr>' + rows[0].map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead>';
        html += '<tbody>' + body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody>';
        out.push(html + '</table></div>');
        continue;
      }

      // > 引用（escを通しているので &gt; で判定する）
      m = line.match(/^&gt;\s?(.*)$/);
      if (m) { flushPara(); flushList(); quote.push(m[1]); continue; }
      flushQuote();

      // リスト（- * + / ・ • / 1. 1) ）。インデント2文字ごとに1階層とみなす
      let li = null;
      if ((m = raw.match(/^(\s*)[-*+]\s+(.+)$/)))            li = { indent: m[1], ordered: false, text: m[2] };
      else if ((m = raw.match(/^(\s*)[•・]\s*(.+)$/)))        li = { indent: m[1], ordered: false, text: m[2] };
      else if ((m = raw.match(/^(\s*)(\d{1,3})[.)]\s+(.+)$/))) li = { indent: m[1], ordered: true, num: +m[2], text: m[3] };
      if (li) {
        flushPara();
        const indent = Math.floor(li.indent.replace(/\t/g, '  ').length / 2);
        // 最上位で「・箇条書き → 1. 番号」のように種類が切り替わったら、
        // 前のリストをここで確定させる（1つのバッファに混ぜると章見出し判定が効かない）
        if (items.length && indent === 0 && items[0].indent === 0 && items[0].ordered !== li.ordered) {
          flushList();
        }
        items.push({ indent, ordered: li.ordered, num: li.num || 1, text: li.text });
        continue;
      }
      flushList();

      // ①②③… 手順ステップ
      if ((m = line.match(RE_STEP))) {
        flushPara();
        out.push('<p class="md-step"><span class="md-step-num">' + m[1] + '</span>' + inline(m[2]) + '</p>');
        continue;
      }

      // ※ 注記
      if (/^(※|注[）:：])/.test(line) || /^[(（]※/.test(line)) {
        flushPara();
        out.push('<p class="md-note">' + inline(line) + '</p>');
        continue;
      }

      para.push(line);
    }

    flush();
    return out.join('');
  }

  global.md2html = md2html;
  global.escapeHTML = esc;

})(window);
