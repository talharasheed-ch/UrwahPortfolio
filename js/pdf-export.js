/* Native browser PDF writer. No CDN, server, print dialog or third-party PDF library required.
   Text remains selectable; original clinical JPEG photographs are embedded as PDF images.
   Supports several visual templates and an optional student profile page. */
(function () {
  'use strict';
  const PAPER_W = 595.28, PAPER_H = 841.89;

  /* ---------- Templates ---------- */
  const THEMES = {
    classic: { label: 'Clinical Green', note: 'Calm green & gold, dark cover band', cover: 'band', header: 'bar',
      c: { ink:'#16383B', dark:'#102D33', accent:'#3C796D', soft:'#EDF4EF', muted:'#768B83', line:'#DCE6DE', gold:'#D1B382', white:'#FFFFFF', cream:'#F8FAF7', onDark:'#D3E9DC', onDarkMuted:'#B7D1C7' } },
    navy: { label: 'Royal Navy', note: 'Navy side panel with gold accents', cover: 'side', header: 'band',
      c: { ink:'#14213D', dark:'#14213D', accent:'#2B4C7E', soft:'#EEF2F8', muted:'#6B7A90', line:'#DDE3EC', gold:'#C9A227', white:'#FFFFFF', cream:'#F7F8FB', onDark:'#E9DDAE', onDarkMuted:'#AFC0D8' } },
    rose: { label: 'Elegant Rose', note: 'Framed classic cover in maroon & rose', cover: 'frame', header: 'side',
      c: { ink:'#3D1F2B', dark:'#5B1A2E', accent:'#9E3A55', soft:'#FBF0F2', muted:'#8E7680', line:'#EEDCE1', gold:'#C99A6B', white:'#FFFFFF', cream:'#FFF9F7', onDark:'#F6D9DF', onDarkMuted:'#E3B7C2' } },
    biotech: { label: 'Dental Bio-Tech', note: 'Cyan & deep blue, matches the website', cover: 'band', header: 'band',
      c: { ink:'#0B2239', dark:'#07192B', accent:'#0284C7', soft:'#E8F7FB', muted:'#64748B', line:'#E2E8F0', gold:'#00B4D8', white:'#FFFFFF', cream:'#F8FAFC', onDark:'#BDEFFF', onDarkMuted:'#8FB3CC' } },
    minimal: { label: 'Modern Minimal', note: 'Clean black & white with bold type', cover: 'minimal', header: 'line',
      c: { ink:'#111111', dark:'#111111', accent:'#E4572E', soft:'#F4F4F2', muted:'#6B6B6B', line:'#E3E3E0', gold:'#E4572E', white:'#FFFFFF', cream:'#FFFFFF', onDark:'#F2F2F2', onDarkMuted:'#BBBBBB' } }
  };
  let T = THEMES.classic, C = T.c;

  const encoder = new TextEncoder();
  const canvasCtx = document.createElement('canvas').getContext('2d');
  const photoDetails = new Map();
  const P = () => window.PORTFOLIO;
  const S = () => window.PORTFOLIO.student;
  const pad2 = n => String(n).padStart(2, '0');
  const semNo = () => { const m = String(S().semester || '').match(/\d+/); return m ? pad2(m[0]) : S().semester; };

  function ascii(value) {
    return String(value == null ? '' : value)
      .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-').replace(/[ ]/g, ' ')
      .replace(/…/g, '...').replace(/[•·]/g, '-')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
  }
  function hexColor(hex) { const v = hex.replace('#', ''); return [0, 2, 4].map(i => (parseInt(v.substring(i, i + 2), 16) / 255).toFixed(3)).join(' '); }
  function pdfText(s) { return '(' + ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')'; }
  function buf(str) { return encoder.encode(str); }
  function joinBytes(parts) { let length = 0; parts.forEach(p => length += p.length); const out = new Uint8Array(length); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; }
  function base64Bytes(src) { const raw = atob(src.split(',')[1]); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
  async function dimensions(key, src) {
    if (photoDetails.has(key)) return photoDetails.get(key);
    const i = new Image(); i.src = src; await i.decode();
    const value = { width: i.naturalWidth, height: i.naturalHeight };
    if (key !== 'profile') photoDetails.set(key, value);
    return value;
  }
  function measure(text, size, bold) { canvasCtx.font = (bold ? 'bold ' : '') + size + 'px Arial'; return canvasCtx.measureText(ascii(text)).width; }
  function wrap(text, width, size = 11, bold = false) {
    canvasCtx.font = (bold ? 'bold ' : '') + size + 'px Arial'; const lines = [];
    for (const paragraph of ascii(text).split('\n')) {
      const words = paragraph.split(/\s+/).filter(Boolean); let line = '';
      for (const word of words) { const next = line ? line + ' ' + word : word; if (line && canvasCtx.measureText(next).width > width) { lines.push(line); line = word; } else { line = next; } }
      if (line) lines.push(line); if (!words.length) lines.push('');
    }
    return lines;
  }
  function fit(text, width, size, bold) { let t = ascii(text); if (measure(t, size, bold) <= width) return t; while (t.length > 1 && measure(t + '...', size, bold) > width) t = t.slice(0, -1); return t + '...'; }

  class PDFDocument {
    constructor(title) { this.objects = [null, null, null, null]; this.pages = []; this.images = new Map(); this.title = title; this.set(3, buf('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')); this.set(4, buf('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')); }
    reserve() { this.objects.push(null); return this.objects.length; }
    set(i, bytes) { this.objects[i - 1] = bytes; }
    add(bytes) { const i = this.reserve(); this.set(i, bytes); return i; }
    stream(data, dict = '') { const bytes = typeof data === 'string' ? buf(data) : data; return this.add(joinBytes([buf('<< ' + dict + ' /Length ' + bytes.length + ' >>\nstream\n'), bytes, buf('\nendstream')])); }
    page() { const p = new PDFPage(this, this.pages.length + 1); this.pages.push(p); return p; }
    async image(key, src) {
      if (this.images.has(key)) return this.images.get(key);
      src = src || window.PHOTO_DATA[key];
      const d = await dimensions(key, src), bytes = base64Bytes(src);
      const ref = this.stream(bytes, '/Type /XObject /Subtype /Image /Width ' + d.width + ' /Height ' + d.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode');
      const r = { ref, ...d }; this.images.set(key, r); return r;
    }
    build() {
      const kids = [];
      for (const p of this.pages) {
        const contentRef = this.stream(p.commands.join('\n'));
        const xobjs = [...p.imageRefs.entries()].map(([n, ref]) => '/' + n + ' ' + ref + ' 0 R').join(' ');
        kids.push(this.add(buf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAPER_W + ' ' + PAPER_H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ' + xobjs + ' >> >> /Contents ' + contentRef + ' 0 R >>')));
      }
      this.set(2, buf('<< /Type /Pages /Kids [' + kids.map(i => i + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>'));
      this.set(1, buf('<< /Type /Catalog /Pages 2 0 R >>'));
      const info = this.add(buf('<< /Title ' + pdfText(this.title) + ' /Author ' + pdfText(S().name) + ' /Subject ' + pdfText('Clinical Management Portfolio - ' + S().program) + ' /Creator ' + pdfText('Clinical Journal website') + ' >>'));
      const chunks = [buf('%PDF-1.4\n%Clinical Journal\n')], offsets = [0]; let bytes = chunks[0].length;
      for (let i = 0; i < this.objects.length; i++) { const obj = this.objects[i]; if (!obj) throw Error('PDF object ' + (i + 1) + ' was not populated'); offsets.push(bytes); const part = joinBytes([buf((i + 1) + ' 0 obj\n'), obj, buf('\nendobj\n')]); chunks.push(part); bytes += part.length; }
      const xref = bytes;
      let table = 'xref\n0 ' + (this.objects.length + 1) + '\n0000000000 65535 f \n';
      for (let i = 1; i < offsets.length; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
      chunks.push(buf(table + 'trailer\n<< /Size ' + (this.objects.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF'));
      return new Blob(chunks, { type: 'application/pdf' });
    }
  }
  const K = 0.5523;
  function circlePath(cx, cy, r) {
    const y = PAPER_H - cy, k = r * K, f = n => n.toFixed(2);
    return f(cx + r) + ' ' + f(y) + ' m ' +
      f(cx + r) + ' ' + f(y + k) + ' ' + f(cx + k) + ' ' + f(y + r) + ' ' + f(cx) + ' ' + f(y + r) + ' c ' +
      f(cx - k) + ' ' + f(y + r) + ' ' + f(cx - r) + ' ' + f(y + k) + ' ' + f(cx - r) + ' ' + f(y) + ' c ' +
      f(cx - r) + ' ' + f(y - k) + ' ' + f(cx - k) + ' ' + f(y - r) + ' ' + f(cx) + ' ' + f(y - r) + ' c ' +
      f(cx + k) + ' ' + f(y - r) + ' ' + f(cx + r) + ' ' + f(y - k) + ' ' + f(cx + r) + ' ' + f(y) + ' c h';
  }
  class PDFPage {
    constructor(doc, number) { this.doc = doc; this.number = number; this.commands = []; this.imageRefs = new Map(); }
    rect(x, y, w, h, fill) { this.commands.push(hexColor(fill) + ' rg ' + x.toFixed(2) + ' ' + (PAPER_H - y - h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f'); }
    strokeRect(x, y, w, h, color, width = 1) { this.commands.push(hexColor(color) + ' RG ' + width.toFixed(2) + ' w ' + x.toFixed(2) + ' ' + (PAPER_H - y - h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re S'); }
    line(x1, y1, x2, y2, color = C.line, width = 1) { this.commands.push(hexColor(color) + ' RG ' + width.toFixed(2) + ' w ' + x1.toFixed(2) + ' ' + (PAPER_H - y1).toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + (PAPER_H - y2).toFixed(2) + ' l S'); }
    circle(cx, cy, r, fill) { this.commands.push(hexColor(fill) + ' rg ' + circlePath(cx, cy, r) + ' f'); }
    ring(cx, cy, r, color, width = 2) { this.commands.push(hexColor(color) + ' RG ' + width.toFixed(2) + ' w ' + circlePath(cx, cy, r) + ' S'); }
    text(content, x, y, size = 11, { bold = false, color = C.ink } = {}) { this.commands.push('BT ' + hexColor(color) + ' rg /F' + (bold ? '2' : '1') + ' ' + size + ' Tf 1 0 0 1 ' + x.toFixed(2) + ' ' + (PAPER_H - y).toFixed(2) + ' Tm ' + pdfText(content) + ' Tj ET'); }
    center(content, cx, y, size = 11, opts = {}) { this.text(content, cx - measure(content, size, opts.bold) * 0.985 / 2, y, size, opts); }
    right(content, rx, y, size = 11, opts = {}) { this.text(content, rx - measure(content, size, opts.bold) * 0.985, y, size, opts); }
    paragraph(content, x, y, width, { size = 11, lineHeight = 17, color = C.muted, bold = false } = {}) { for (const line of wrap(content, width, size, bold)) { this.text(line, x, y, size, { color, bold }); y += lineHeight; } return y; }
    async photo(id, x, y, w, h) { const im = await this.doc.image(id); const name = 'P' + id; this.imageRefs.set(name, im.ref); const ratio = Math.min(w / im.width, h / im.height); const rw = im.width * ratio, rh = im.height * ratio; const px = x + (w - rw) / 2, py = y + (h - rh) / 2; this.commands.push('q ' + rw.toFixed(3) + ' 0 0 ' + rh.toFixed(3) + ' ' + px.toFixed(3) + ' ' + (PAPER_H - py - rh).toFixed(3) + ' cm /' + name + ' Do Q'); }
    /* Square image (already cropped) drawn inside a circle, or a square frame when square=true. */
    async portrait(src, cx, cy, r, square = false) {
      const im = await this.doc.image('profile', src); this.imageRefs.set('Pprofile', im.ref);
      const clip = square ? (cx - r).toFixed(2) + ' ' + (PAPER_H - cy - r).toFixed(2) + ' ' + (2 * r).toFixed(2) + ' ' + (2 * r).toFixed(2) + ' re' : circlePath(cx, cy, r);
      this.commands.push('q ' + clip + ' W n ' + (2 * r).toFixed(3) + ' 0 0 ' + (2 * r).toFixed(3) + ' ' + (cx - r).toFixed(3) + ' ' + (PAPER_H - cy - r).toFixed(3) + ' cm /Pprofile Do Q');
    }
  }
  /* Draws the profile photo, or an initials badge when there is no photo. */
  async function avatar(p, photo, cx, cy, r, { ring = C.gold, square = false, bg = C.accent } = {}) {
    if (photo) await p.portrait(photo, cx, cy, r, square);
    else {
      if (square) p.rect(cx - r, cy - r, 2 * r, 2 * r, bg); else p.circle(cx, cy, r, bg);
      const ini = window.ProfileStore ? window.ProfileStore.initials(S().name) : 'ST';
      p.center(ini, cx, cy + r * 0.24, r * 0.68, { bold: true, color: C.white });
    }
    if (ring) { if (square) p.strokeRect(cx - r - 4, cy - r - 4, 2 * r + 8, 2 * r + 8, ring, 1.6); else p.ring(cx, cy, r + 4, ring, 1.8); }
  }

  /* ---------- Page chrome ---------- */
  function basePage(doc, section) {
    const p = doc.page(), uni = S().university.toUpperCase(), right = (S().program + '  /  Semester ' + semNo()).toUpperCase();
    if (T.header === 'band') {
      p.rect(0, 0, PAPER_W, 62, C.dark); p.rect(0, 62, PAPER_W, 2.5, C.gold);
      p.text(uni, 43, 37, 8.3, { bold: true, color: C.onDark }); p.right(right, PAPER_W - 43, 37, 7.5, { bold: true, color: C.onDarkMuted });
    } else if (T.header === 'line') {
      p.text(uni, 43, 39, 8.3, { bold: true, color: C.ink }); p.right(right, PAPER_W - 43, 39, 7.5, { bold: true, color: C.muted });
      p.line(43, 51, PAPER_W - 43, 51, C.ink, 1.4); p.rect(43, 49.5, 60, 3, C.accent);
    } else {
      if (T.header === 'side') { p.rect(0, 0, 9, PAPER_H, C.dark); p.rect(9, 0, 3, PAPER_H, C.gold); }
      else p.rect(0, 0, PAPER_W, 5, C.accent);
      p.text(uni, 43, 39, 8.3, { bold: true, color: C.accent }); p.right(right, PAPER_W - 43, 39, 7.5, { bold: true, color: C.muted });
      p.line(43, 51, PAPER_W - 43, 51, C.line, .8);
    }
    p.line(43, 793, PAPER_W - 43, 793, C.line, .8);
    p.text(S().name.toUpperCase() + '   /   CLINICAL MANAGEMENT', 43, 809, 7.7, { color: C.muted });
    p.right(section + '     ' + pad2(p.number), PAPER_W - 43, 809, 7.3, { bold: true, color: C.accent });
    return p;
  }
  function label(p, text, x, y) { p.text(text.toUpperCase(), x, y, 8.5, { bold: true, color: C.accent }); }
  function stats() { const w = P().weeks; return [pad2(w.length) + ' WEEKS', w.reduce((n, x) => n + x.photos.length, 0) + ' PHOTOGRAPHS', ascii(S().batch).replace(/\s*-\s*/, ' - ')]; }

  /* ---------- Covers ---------- */
  async function coverBand(doc, photo) {
    const s = S(), c = P().clinic, p = doc.page();
    p.rect(0, 0, PAPER_W, PAPER_H, C.cream); p.rect(0, 0, PAPER_W, 405, C.dark); p.rect(44, 41, 29, 3, C.gold);
    p.text(s.university.toUpperCase().replace(/ /g, '  '), 84, 46, 9.5, { bold: true, color: C.onDark });
    p.text('CLINICAL', 44, 138, 43, { bold: true, color: C.white }); p.text('MANAGEMENT', 44, 188, 43, { bold: true, color: C.white });
    p.text('P O R T F O L I O', 45, 237, 16, { color: C.onDark });
    if (photo !== undefined) await avatar(p, photo, 472, 170, 70, { ring: C.gold });
    p.line(44, 265, 551, 265, C.onDarkMuted, .6);
    p.text('Clinical placement and weekly learning record', 45, 294, 12, { color: C.onDark });
    p.text((c.joined + '   /   ' + c.name).toUpperCase(), 45, 329, 9, { bold: true, color: C.onDarkMuted });
    p.rect(43, 435, 509, 154, C.white); p.rect(43, 435, 4, 154, C.gold);
    p.text('DOCUMENTED BY', 61, 463, 8, { bold: true, color: C.accent });
    p.text(s.name, 60, 500, 29, { color: C.ink });
    p.text(s.program + '  |  ' + s.semester, 61, 525, 11, { color: C.muted });
    p.line(60, 544, 534, 544, C.line, .7);
    p.text('STUDENT ID', 61, 566, 8, { bold: true, color: C.muted }); p.text(s.id, 135, 566, 9.5, { bold: true, color: C.ink });
    p.text('BATCH', 345, 566, 8, { bold: true, color: C.muted }); p.text(s.batch, 385, 566, 9.5, { bold: true, color: C.ink });
    p.text('CLINIC & PLACEMENT', 43, 640, 9, { bold: true, color: C.accent });
    p.text(c.name + '  -  ' + c.address, 43, 662, 11, { color: C.ink });
    p.text('Clinic owner: ' + c.owner + '  |  Joined: ' + c.joined, 43, 681, 10, { color: C.muted });
    p.rect(43, 728, 509, 1, C.line); const st = stats();
    p.text(st[0], 43, 752, 10, { bold: true, color: C.accent }); p.center(st[1], PAPER_W / 2, 752, 10, { bold: true, color: C.accent }); p.right(st[2], 552, 752, 10, { bold: true, color: C.accent });
    p.text('A DOCUMENTED RECORD OF LEARNING AND PRACTICE', 43, 806, 8, { bold: true, color: C.muted });
  }
  async function coverSide(doc, photo) {
    const s = S(), c = P().clinic, p = doc.page();
    p.rect(0, 0, PAPER_W, PAPER_H, C.cream); p.rect(0, 0, 205, PAPER_H, C.dark); p.rect(205, 0, 4, PAPER_H, C.gold);
    p.text('PORTFOLIO', 36, 60, 9, { bold: true, color: C.gold });
    p.line(36, 72, 170, 72, C.onDarkMuted, .5);
    if (photo !== undefined) await avatar(p, photo, 102, 175, 64, { ring: C.gold });
    let y = photo !== undefined ? 300 : 130;
    const st = stats();
    for (const [k, v] of [['STUDENT ID', s.id], ['PROGRAM', s.program], ['SEMESTER', s.semester], ['BATCH', s.batch]]) {
      p.text(k, 36, y, 7.5, { bold: true, color: C.onDarkMuted }); p.text(fit(v, 150, 10.5, true), 36, y + 16, 10.5, { bold: true, color: C.white }); y += 44;
    }
    p.line(36, 690, 170, 690, C.onDarkMuted, .5);
    st.forEach((t, i) => p.text(t, 36, 715 + i * 20, 9, { bold: true, color: C.onDark }));
    const x = 245;
    p.text(s.university.toUpperCase(), x, 60, 9, { bold: true, color: C.accent });
    p.text('Clinical', x, 190, 44, { color: C.ink }); p.text('Management', x, 240, 44, { bold: true, color: C.ink });
    p.text('Portfolio', x, 290, 44, { color: C.accent });
    p.rect(x, 318, 60, 3, C.gold);
    p.paragraph('Clinical placement and weekly learning record of supervised dental technology training.', x, 352, 290, { size: 12, lineHeight: 19, color: C.muted });
    p.text('DOCUMENTED BY', x, 470, 8, { bold: true, color: C.accent });
    p.text(fit(s.name, 300, 28), x, 505, 28, { bold: true, color: C.ink });
    p.text(s.email, x, 527, 10, { color: C.muted });
    p.rect(x, 590, 307, 112, C.soft); p.rect(x, 590, 3, 112, C.accent);
    p.text('CLINIC & PLACEMENT', x + 18, 616, 8, { bold: true, color: C.accent });
    p.text(fit(c.name, 270, 14, true), x + 18, 640, 14, { bold: true, color: C.ink });
    p.text(fit(c.address, 270, 10), x + 18, 660, 10, { color: C.muted });
    p.text(fit('Owner: ' + c.owner + '  |  Joined: ' + c.joined, 270, 9.5), x + 18, 680, 9.5, { color: C.muted });
    p.text('A DOCUMENTED RECORD OF LEARNING AND PRACTICE', x, 806, 7.5, { bold: true, color: C.muted });
  }
  async function coverFrame(doc, photo) {
    const s = S(), c = P().clinic, p = doc.page(), cx = PAPER_W / 2;
    p.rect(0, 0, PAPER_W, PAPER_H, C.cream);
    p.strokeRect(24, 24, PAPER_W - 48, PAPER_H - 48, C.dark, 2.2); p.strokeRect(32, 32, PAPER_W - 64, PAPER_H - 64, C.gold, .8);
    p.center(s.university.toUpperCase().split('').join(' '), cx, 84, 9, { bold: true, color: C.accent });
    p.line(cx - 70, 100, cx + 70, 100, C.gold, .8); p.circle(cx, 100, 2.6, C.gold);
    let y = 150;
    if (photo !== undefined) { await avatar(p, photo, cx, 205, 68, { ring: C.gold }); y = 320; }
    p.center('Clinical Management', cx, y, 34, { color: C.dark });
    p.center('P O R T F O L I O', cx, y + 34, 14, { bold: true, color: C.accent });
    p.rect(cx - 30, y + 54, 60, 2, C.gold);
    p.center('Clinical placement and weekly learning record', cx, y + 84, 11.5, { color: C.muted });
    y += 150;
    p.center('PRESENTED BY', cx, y, 8, { bold: true, color: C.accent });
    p.center(s.name, cx, y + 34, 28, { bold: true, color: C.ink });
    p.center(s.program + '  |  ' + s.semester + '  |  ' + s.batch, cx, y + 58, 10.5, { color: C.muted });
    p.center('Student ID: ' + s.id, cx, y + 78, 10, { bold: true, color: C.dark });
    p.line(90, y + 106, PAPER_W - 90, y + 106, C.line, .8);
    p.center(c.name, cx, y + 134, 13, { bold: true, color: C.dark });
    p.center(c.address + '  -  Owner: ' + c.owner, cx, y + 153, 9.8, { color: C.muted });
    const st = stats(); p.center(st.join('     /     '), cx, 770, 9, { bold: true, color: C.accent });
  }
  async function coverMinimal(doc, photo) {
    const s = S(), c = P().clinic, p = doc.page();
    p.rect(43, 60, 8, 150, C.accent);
    p.text(s.university.toUpperCase(), 66, 72, 9, { bold: true, color: C.muted });
    p.text('CLINICAL', 64, 128, 50, { bold: true, color: C.ink });
    p.text('MANAGEMENT', 64, 178, 50, { bold: true, color: C.ink });
    p.text('PORTFOLIO.', 64, 228, 50, { bold: true, color: C.accent });
    if (photo !== undefined) await avatar(p, photo, 490, 312, 52, { ring: null, square: true, bg: C.ink });
    p.paragraph('A documented record of clinical observation, hands-on learning and professional growth during supervised placement.', 66, 282, 360, { size: 12.5, lineHeight: 20, color: C.muted });
    p.line(43, 380, 552, 380, C.ink, 1.4);
    const cells = [['NAME', s.name], ['STUDENT ID', s.id], ['PROGRAM', s.program], ['SEMESTER', s.semester], ['UNIVERSITY', s.university], ['BATCH', s.batch], ['CLINIC', c.name], ['CLINIC OWNER', c.owner]];
    cells.forEach(([k, v], i) => {
      const x = 43 + (i % 2) * 262, y = 418 + Math.floor(i / 2) * 64;
      p.text(k, x, y, 7.6, { bold: true, color: C.accent }); p.text(fit(v, 240, i === 0 ? 17 : 13, i === 0), x, y + 22, i === 0 ? 17 : 13, { bold: i === 0, color: C.ink });
      p.line(x, y + 38, x + 240, y + 38, C.line, .7);
    });
    p.rect(43, 712, 509, 56, C.ink); const st = stats();
    p.text(st[0], 63, 745, 11, { bold: true, color: C.white }); p.center(st[1], PAPER_W / 2, 745, 11, { bold: true, color: C.white }); p.right(st[2], 532, 745, 11, { bold: true, color: C.accent });
    p.text(c.joined.toUpperCase() + '   /   ' + c.address.toUpperCase(), 43, 806, 7.5, { bold: true, color: C.muted });
  }
  const COVERS = { band: coverBand, side: coverSide, frame: coverFrame, minimal: coverMinimal };

  /* ---------- Student profile page (presentation style) ---------- */
  function factGrid(p, items, y, colW = 245) {
    items.forEach(([k, v], i) => {
      const x = 45 + (i % 2) * (colW + 18), yy = y + Math.floor(i / 2) * 38;
      p.text(k.toUpperCase(), x, yy, 7.4, { bold: true, color: C.muted });
      p.text(fit(v || '-', colW - 6, 10.8, true), x, yy + 16, 10.8, { bold: true, color: C.ink });
      p.line(x, yy + 25, x + colW, yy + 25, C.line, .6);
    });
    return y + Math.ceil(items.length / 2) * 38;
  }
  async function drawProfile(doc, photo) {
    const s = S(), c = P().clinic;
    let p = basePage(doc, 'STUDENT PROFILE');
    label(p, '00 / student profile', 45, 104);
    p.text('About the student', 44, 146, 29, { color: C.ink });
    // Hero card
    p.rect(43, 168, 509, 160, C.dark); p.rect(43, 324, 509, 4, C.gold);
    await avatar(p, photo, 128, 248, 56, { ring: C.gold });
    p.text(fit(s.name, 330, 25, true), 212, 222, 25, { bold: true, color: C.white });
    p.text(fit(s.program + '  |  ' + s.semester, 330, 11.5), 213, 244, 11.5, { color: C.onDark });
    p.text(fit(s.university, 330, 10.5), 213, 262, 10.5, { color: C.onDarkMuted });
    p.rect(213, 278, measure('ID  ' + s.id, 9, true) + 22, 22, C.gold);
    p.text('ID  ' + s.id, 224, 293, 9, { bold: true, color: C.dark });
    let y = 356;
    if (s.about) { y = p.paragraph(s.about, 45, y, 505, { size: 10.6, lineHeight: 16, color: C.muted }) + 10; }
    label(p, 'Academic details', 45, y); y += 22;
    y = factGrid(p, [['Student ID', s.id], ['Program', s.program], ['Semester', s.semester], ['Batch / session', s.batch], ['University', s.university], ['Email', s.email]], y) + 12;
    label(p, 'Clinical placement', 45, y); y += 22;
    y = factGrid(p, [['Clinic', c.name], ['Clinic owner', c.owner], ['Address', c.address], ['Placement start', c.joined]], y) + 12;
    const staff = [];
    const sup = P().supervisor || {};
    if (sup.name) staff.push({ role: sup.title || 'Clinical Superintendent', name: sup.name, lead: true });
    (P().teachers || []).filter(t => t.name).forEach(t => staff.push({ role: t.role || 'Teacher', name: t.name }));
    if (!staff.length) return;
    if (y > 700) { p = basePage(doc, 'STUDENT PROFILE'); y = 104; }
    label(p, 'Supervision & faculty', 45, y); y += 14;
    for (let i = 0; i < staff.length; i++) {
      const t = staff[i], col = i % 2, x = 43 + col * 259;
      if (col === 0 && y + 44 > 785) { p = basePage(doc, 'STUDENT PROFILE'); label(p, 'Supervision & faculty (continued)', 45, 104); y = 118; }
      p.rect(x, y, 250, 44, t.lead ? C.dark : C.soft); p.rect(x, y, 3, 44, C.gold);
      p.circle(x + 27, y + 22, 13, t.lead ? C.gold : C.accent);
      p.center(window.ProfileStore ? window.ProfileStore.initials(t.name) : '', x + 27, y + 26, 9, { bold: true, color: t.lead ? C.dark : C.white });
      p.text(fit(t.role.toUpperCase(), 196, 7, true), x + 50, y + 18, 7, { bold: true, color: t.lead ? C.onDarkMuted : C.muted });
      p.text(fit(t.name, 196, 11.5, true), x + 50, y + 33, 11.5, { bold: true, color: t.lead ? C.white : C.ink });
      if (col === 1 || i === staff.length - 1) y += 52;
    }
  }

  /* ---------- Content pages ---------- */
  function drawIntroduction(doc) {
    const s = S(), p = basePage(doc, 'INTRODUCTION'); label(p, '01 / introduction', 45, 112);
    p.text('Why this portfolio', 44, 161, 31, { color: C.ink }); p.line(44, 177, 551, 177, C.line, 1);
    label(p, 'PURPOSE OF PORTFOLIO', 45, 213);
    p.paragraph(P().purpose, 45, 237, 490, { size: 12, lineHeight: 20, color: C.muted });
    p.rect(43, 390, 509, 225, C.soft); p.rect(43, 390, 4, 225, C.gold);
    label(p, 'CAREER GOAL', 65, 422);
    p.paragraph(P().goal, 65, 452, 458, { size: 13, lineHeight: 22, color: C.ink });
    label(p, 'STUDENT', 45, 668);
    p.text(s.name + '  |  ' + s.id, 45, 698, 11, { bold: true });
    p.text(s.university + '  |  ' + s.program, 45, 718, 10.5, { color: C.muted });
    p.text('Batch ' + s.batch + '  |  ' + s.semester, 45, 738, 10.5, { color: C.muted });
  }
  function weekContents(doc, week) {
    const total = pad2(P().weeks.length), p = basePage(doc, 'WEEK ' + pad2(week.id));
    label(p, 'CLINICAL ROTATION  /  WEEK ' + pad2(week.id) + ' OF ' + total, 45, 115);
    p.text(week.category, 45, 139, 8.7, { bold: true, color: C.muted });
    let y = 179;
    for (const line of wrap(week.title, 486, 28, true)) { p.text(line, 44, y, 28, { bold: true, color: C.ink }); y += 35; }
    p.rect(44, y + 2, 47, 2, C.gold);
    y += 34;
    y = p.paragraph(week.summary, 44, y, 494, { size: 13, lineHeight: 19, color: C.accent });
    y += 35;
    label(p, 'CLINICAL LEARNING & OBSERVATIONS', 45, y); y += 28;
    y = p.paragraph(week.description, 44, y, 500, { size: 11.1, lineHeight: 17.6, color: C.ink });
    y += 28;
    label(p, 'PRACTICE FOCUS', 45, y); y += 21;
    for (const t of week.focus) { p.rect(46, y - 7, 5, 5, C.gold); p.text(t, 60, y, 11, { color: C.muted }); y += 22; }
    const lower = Math.max(y + 17, 702);
    if (lower < 768) { p.line(45, lower, 550, lower, C.line, .8); p.text('VISUAL DOCUMENTATION', 45, lower + 22, 8.6, { bold: true, color: C.accent }); p.right(week.photos.length + ' PHOTOGRAPH' + (week.photos.length === 1 ? '' : 'S') + ' ON FOLLOWING PAGE' + (week.photos.length > 4 ? 'S' : ''), 550, lower + 22, 8, { bold: true, color: C.muted }); }
    if (week.note) { const noteY = Math.min(755, lower + 41); p.text('Note: Image 08 was not included in the supplied files.', 45, noteY, 8.6, { color: C.muted }); }
  }
  async function weekPhotos(doc, week) {
    const photos = week.photos;
    for (let start = 0; start < photos.length; start += 4) {
      const p = basePage(doc, 'WEEK ' + pad2(week.id) + ' / PHOTOS');
      label(p, 'DOCUMENTED CLINICAL PHOTOGRAPHS', 45, 109);
      p.text('Week ' + pad2(week.id) + '  /  ' + week.short, 44, 145, 21, { bold: true });
      p.text('Photographic observations from the placement', 45, 164, 10, { color: C.muted });
      p.line(44, 178, 551, 178, C.line, .8);
      const part = photos.slice(start, start + 4), single = part.length === 1;
      for (let j = 0; j < part.length; j++) {
        const id = part[j], globalIndex = start + j;
        const x = single ? 84 : 44 + (j % 2) * 257, y = single ? 206 : 206 + Math.floor(j / 2) * 280;
        const w = single ? 425 : 247, h = single ? 484 : 265;
        p.rect(x, y, w, h, C.soft);
        await p.photo(id, x + 8, y + 8, w - 16, h - 47);
        p.rect(x, y + h - 35, w, 35, C.white);
        p.text('PHOTO ' + pad2(id), x + 11, y + h - 21, 8.5, { bold: true, color: C.accent });
        p.text(wrap(week.captions[globalIndex] || 'Clinical photograph', w - 22, 7.6)[0] || '', x + 11, y + h - 9, 7.6, { color: C.muted });
      }
    }
  }
  function drawConclusion(doc) {
    const s = S(), p = basePage(doc, 'CONCLUSION'); label(p, 'FINAL REFLECTION', 45, 126);
    p.text('Continuing to learn,', 44, 183, 33, { color: C.ink }); p.text('committed to care.', 44, 224, 33, { color: C.accent });
    p.rect(43, 263, 54, 3, C.gold);
    p.paragraph(P().conclusion, 44, 323, 497, { size: 12.4, lineHeight: 21.5, color: C.muted });
    p.rect(43, 577, 509, 137, C.soft);
    label(p, 'PORTFOLIO PREPARED BY', 62, 610);
    p.text(s.name, 62, 641, 21, { color: C.ink });
    p.text(s.university + '  |  ' + s.semester, 62, 666, 10.3, { color: C.muted });
    p.text(s.id, 62, 687, 9.8, { bold: true, color: C.accent });
  }

  /* ---------- Assembly ---------- */
  function useTheme(key) { T = THEMES[key] || THEMES.classic; C = T.c; }
  async function profilePhoto() { return window.ProfileStore ? window.ProfileStore.photoJPEG() : null; }
  async function makeWeekPDF(week, opts = {}) {
    useTheme(opts.template);
    const pdf = new PDFDocument('Clinical Management Portfolio - Week ' + week.id + ' - ' + week.title);
    if (opts.withProfile) await drawProfile(pdf, await profilePhoto());
    weekContents(pdf, week); await weekPhotos(pdf, week); return pdf.build();
  }
  async function makeFullPDF(opts = {}) {
    useTheme(opts.template);
    const pdf = new PDFDocument(S().name + ' - Clinical Management Portfolio');
    // Cover shows the photo only for "with profile"; `undefined` means no photo slot at all.
    const photo = opts.withProfile ? await profilePhoto() : undefined;
    await COVERS[T.cover](pdf, photo);
    if (opts.withProfile) await drawProfile(pdf, photo);
    drawIntroduction(pdf);
    for (const week of P().weeks) { weekContents(pdf, week); await weekPhotos(pdf, week); }
    drawConclusion(pdf); return pdf.build();
  }
  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const fileSafe = v => ascii(v).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Student';
  let busy = false;
  async function exportFile(which, opts = {}) {
    if (busy) return;
    busy = true; const overlay = document.getElementById('exportOverlay'), progress = document.getElementById('exportProgressText');
    overlay.hidden = false;
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 20)));
      const theme = THEMES[opts.template] || THEMES.classic, suffix = '_' + fileSafe(theme.label) + (opts.withProfile ? '' : '_NoProfile');
      let blob, file;
      if (which === 'full') {
        progress.textContent = 'Building the ' + theme.label + ' portfolio with all weeks and photographs...';
        blob = await makeFullPDF(opts); file = fileSafe(S().name) + '_Clinical_Management_Portfolio' + suffix + '.pdf';
      } else {
        const week = P().weeks.find(w => w.id === Number(which));
        if (!week) throw Error('This week is not available.');
        progress.textContent = 'Embedding clinical photographs for week ' + week.id + '...';
        blob = await makeWeekPDF(week, opts); file = fileSafe(S().name) + '_Week_' + pad2(week.id) + suffix + '.pdf';
      }
      downloadBlob(blob, file);
      if (window.showAppToast) window.showAppToast('PDF generated', 'Your ' + (which === 'full' ? 'complete portfolio' : 'week ' + which + ' report') + ' (' + theme.label + (opts.withProfile ? ', with profile' : ', without profile') + ') is ready.');
    } catch (err) { console.error('PDF export failed:', err); if (window.showAppToast) window.showAppToast('Export could not finish', err.message || 'Please try again.', true); }
    finally { overlay.hidden = true; busy = false; }
  }
  window.ClinicalPDF = { export: exportFile, makeWeekPDF, makeFullPDF, themes: THEMES };
})();
