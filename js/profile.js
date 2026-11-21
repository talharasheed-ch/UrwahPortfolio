/* Student profile: defaults come from js/content.js, edits are saved in this browser (localStorage).
   No server or backend is used. */
(function () {
  'use strict';
  const KEY = 'clinicalJournal.profile.v1';
  const P = window.PORTFOLIO;
  const $ = s => document.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const clone = v => JSON.parse(JSON.stringify(v));

  const defaults = clone({ student: P.student, clinic: P.clinic, supervisor: P.supervisor || {title:'Clinical Superintendent',name:''}, teachers: P.teachers || [] });
  const listeners = [];
  let state = load();
  let photoOK = false;           // whether the current photo actually loads

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    const s = clone(defaults);
    if (saved) {
      Object.assign(s.student, saved.student || {});
      Object.assign(s.clinic, saved.clinic || {});
      Object.assign(s.supervisor, saved.supervisor || {});
      if (Array.isArray(saved.teachers)) s.teachers = saved.teachers;
    }
    return s;
  }
  function sync() {
    // Keep window.PORTFOLIO in step so every other script reads the latest details.
    Object.assign(P.student, state.student); Object.assign(P.clinic, state.clinic);
    P.supervisor = state.supervisor; P.teachers = state.teachers;
  }
  function save(next) {
    state = next; sync();
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { if (window.showAppToast) window.showAppToast('Could not save', 'The browser storage is full. Try a smaller photo.', true); }
    render(); listeners.forEach(fn => fn(state));
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} state = load(); sync(); render(); listeners.forEach(fn => fn(state)); }

  function initials(name) { return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'ST'; }
  function semesterShort(sem) { const m = String(sem || '').match(/\d+/); return m ? 'Sem ' + m[0].padStart(2, '0') : sem; }
  function fields() {
    const s = state.student, c = state.clinic;
    return {
      name: s.name, initials: initials(s.name), initialsLower: initials(s.name).toLowerCase(), id: s.id, program: s.program,
      semester: s.semester, semesterShort: semesterShort(s.semester), batch: s.batch, university: s.university,
      universityUpper: String(s.university || '').toUpperCase(), email: s.email, about: s.about,
      programLine: s.program + ' · ' + semesterShort(s.semester), clinicName: c.name, clinicOwner: c.owner,
      clinicAddress: c.address, clinicJoined: 'Joined ' + c.joined, clinicPhone: c.telephone,
      nameUpper: String(s.name || '').toUpperCase(), coverLine: String(s.name || '').toUpperCase() + ' · ' + String(s.semester || '').toUpperCase()
    };
  }

  /* ---------- Photo helpers ---------- */
  function loadImage(src) {
    return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  }
  function squareJPEG(img, size = 600, quality = .88) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2, sy = Math.max(0, (img.naturalHeight - side) / 2 - side * .08);
    g.drawImage(img, sx, Math.min(sy, img.naturalHeight - side), side, side, 0, 0, size, size);
    return c.toDataURL('image/jpeg', quality);
  }
  /* Returns a square JPEG data URL for the PDF, or null if no usable photo is available. */
  async function photoJPEG() {
    const src = state.student.photo; if (!src) return null;
    try { return squareJPEG(await loadImage(src)); } catch (e) { return null; }
  }

  /* ---------- Rendering ---------- */
  function applyBindings() {
    const f = fields();
    document.querySelectorAll('[data-bind]').forEach(el => { const v = f[el.dataset.bind]; if (v != null) el.textContent = v; });
    document.querySelectorAll('[data-bind-mail]').forEach(el => { el.href = 'mailto:' + state.student.email; });
    document.title = 'Clinical Journal | ' + state.student.name;
  }
  function setAvatar(el, cls) {
    if (!el) return;
    const s = state.student;
    el.innerHTML = s.photo && photoOK ? `<img src="${esc(s.photo)}" alt="${esc(s.name)}" class="${cls || ''}">` : `<span>${esc(initials(s.name))}</span>`;
    el.classList.toggle('has-photo', !!(s.photo && photoOK));
  }
  function renderPhotos() {
    setAvatar($('#sideAvatar')); setAvatar($('#profilePhoto'));
  }
  function staffList() {
    const list = [];
    list.push({ role: state.supervisor.title || 'Clinical Superintendent', name: state.supervisor.name, lead: true });
    state.teachers.forEach(t => list.push({ role: t.role, name: t.name }));
    return list;
  }
  function render() {
    applyBindings();
    const s = state.student, c = state.clinic;
    const details = [['Student ID', s.id], ['Program', s.program], ['Semester', s.semester], ['Batch', s.batch], ['University', s.university], ['Email', s.email]];
    const grid = $('#profileDetails');
    if (grid) grid.innerHTML = details.map(([k, v]) => `<div class="profile-fact"><span>${esc(k)}</span><strong>${esc(v || '—')}</strong></div>`).join('');
    const place = $('#profilePlacement');
    if (place) place.innerHTML = [['Clinic', c.name], ['Clinic owner', c.owner], ['Address', c.address], ['Placement start', c.joined]]
      .map(([k, v]) => `<div class="profile-fact"><span>${esc(k)}</span><strong>${esc(v || '—')}</strong></div>`).join('');
    const staff = $('#profileStaff');
    if (staff) staff.innerHTML = staffList().map(t => `<div class="staff-card${t.lead ? ' lead' : ''}"><div class="staff-avatar">${esc(t.name ? initials(t.name) : '?')}</div><div><span>${esc(t.role || 'Teacher')}</span><strong class="${t.name ? '' : 'is-empty'}">${esc(t.name || 'Name not added yet')}</strong></div></div>`).join('');
    // Probe the photo; fall back to initials when the file is missing.
    if (s.photo) loadImage(s.photo).then(() => { photoOK = true; renderPhotos(); }, () => { photoOK = false; renderPhotos(); });
    else { photoOK = false; renderPhotos(); }
  }

  /* ---------- Edit form ---------- */
  let draftPhoto = null;
  const formFields = [
    ['student.name', 'Full name'], ['student.id', 'Student ID'], ['student.program', 'Program'], ['student.semester', 'Semester'],
    ['student.batch', 'Batch / Session'], ['student.university', 'University'], ['student.email', 'Email', 'email'],
    ['clinic.name', 'Clinic name'], ['clinic.owner', 'Clinic owner'], ['clinic.address', 'Clinic address'], ['clinic.joined', 'Placement start date'],
    ['supervisor.title', 'Superintendent title'], ['supervisor.name', 'Superintendent name']
  ];
  const getPath = (obj, path) => path.split('.').reduce((o, k) => o && o[k], obj);
  function teacherRow(t = { role: '', name: '' }) {
    return `<div class="teacher-row"><input class="form-control" data-t="role" placeholder="Role / subject" value="${esc(t.role)}"><input class="form-control" data-t="name" placeholder="Teacher name" value="${esc(t.name)}"><button type="button" class="teacher-remove" aria-label="Remove teacher"><svg class="icon"><use href="#ico-x"/></svg></button></div>`;
  }
  function fillForm() {
    const form = $('#profileForm');
    formFields.forEach(([path]) => { const el = form.querySelector(`[name="${path}"]`); if (el) el.value = getPath(state, path) || ''; });
    form.querySelector('[name="student.about"]').value = state.student.about || '';
    $('#teacherRows').innerHTML = state.teachers.map(teacherRow).join('');
    draftPhoto = state.student.photo;
    updatePhotoPreview();
  }
  function updatePhotoPreview() {
    const box = $('#photoPreview');
    box.innerHTML = draftPhoto ? `<img src="${esc(draftPhoto)}" alt="Profile photo preview">` : `<span>${esc(initials($('#profileForm [name="student.name"]').value))}</span>`;
    const img = box.querySelector('img'); if (img) img.onerror = () => { box.innerHTML = `<span>${esc(initials(state.student.name))}</span>`; };
  }
  function buildForm() {
    const host = $('#profileFormFields'); if (!host) return;
    const group = (title, items) => `<div class="form-group-title">${title}</div><div class="profile-form-grid">` + items.map(([path, label, type]) =>
      `<label><span>${label}</span><input class="form-control" name="${path}" type="${type || 'text'}"></label>`).join('') + '</div>';
    host.innerHTML = group('Student information', formFields.slice(0, 7)) +
      `<label class="full"><span>About (short introduction)</span><textarea class="form-control" name="student.about" rows="3"></textarea></label>` +
      group('Clinical placement', formFields.slice(7, 11)) + group('Superintendent', formFields.slice(11));
  }
  function readForm() {
    const form = $('#profileForm'), next = clone(state);
    formFields.forEach(([path]) => { const [a, b] = path.split('.'); next[a][b] = form.querySelector(`[name="${path}"]`).value.trim(); });
    next.student.about = form.querySelector('[name="student.about"]').value.trim();
    next.student.photo = draftPhoto || '';
    next.teachers = [...document.querySelectorAll('#teacherRows .teacher-row')].map(r => ({ role: r.querySelector('[data-t="role"]').value.trim(), name: r.querySelector('[data-t="name"]').value.trim() })).filter(t => t.role || t.name);
    if (!next.student.name) next.student.name = defaults.student.name;
    return next;
  }
  function initEditor() {
    const modalEl = $('#profileModal'); if (!modalEl) return;
    buildForm();
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    document.querySelectorAll('[data-edit-profile]').forEach(b => b.addEventListener('click', () => { fillForm(); modal.show(); }));
    $('#addTeacher').addEventListener('click', () => { $('#teacherRows').insertAdjacentHTML('beforeend', teacherRow()); $('#teacherRows .teacher-row:last-child input').focus(); });
    $('#teacherRows').addEventListener('click', e => { const b = e.target.closest('.teacher-remove'); if (b) b.closest('.teacher-row').remove(); });
    $('#photoInput').addEventListener('change', async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try { const url = URL.createObjectURL(file); const img = await loadImage(url); draftPhoto = squareJPEG(img); URL.revokeObjectURL(url); updatePhotoPreview(); }
      catch (err) { if (window.showAppToast) window.showAppToast('Photo not supported', 'Please choose a JPG or PNG image.', true); }
    });
    $('#photoRemove').addEventListener('click', () => { draftPhoto = ''; updatePhotoPreview(); });
    $('#profileForm').addEventListener('submit', e => {
      e.preventDefault(); save(readForm()); modal.hide();
      if (window.showAppToast) window.showAppToast('Profile updated', 'The website and future PDF exports now use these details.');
    });
    $('#profileDeploy').addEventListener('click', () => {
      save(readForm());
      downloadContentJS();
      if (window.showAppToast) window.showAppToast('content.js downloaded', 'Replace js/content.js with this file and push. Everyone will then see these details.');
    });
    $('#profileReset').addEventListener('click', () => {
      reset(); fillForm();
      if (window.showAppToast) window.showAppToast('Profile reset', 'Original details from content.js have been restored.');
    });
  }

  /* Builds a complete js/content.js with the current profile (photo embedded), ready to commit and deploy. */
  function downloadContentJS() {
    const data = clone(P);
    data.student = clone(state.student); data.clinic = clone(state.clinic);
    data.supervisor = clone(state.supervisor); data.teachers = clone(state.teachers);
    const text = '/* All portfolio copy and week-to-photo mappings are editable here.\n' +
      '   Generated from the website "Edit profile" -> "Save for website" button on ' + new Date().toISOString().slice(0, 10) + '.\n' +
      '   student.photo may be an embedded image (data URL) or a path such as assets/profile.jpg. */\n' +
      'window.PORTFOLIO = ' + JSON.stringify(data, null, 2) + ';\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' })), a = document.createElement('a');
    a.href = url; a.download = 'content.js'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  sync();
  window.ProfileStore = { get: () => clone(state), fields, initials, photoJPEG, staffList, onChange: fn => listeners.push(fn) };
  render();
  initEditor();
})();
