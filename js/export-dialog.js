/* Export dialog: asks which PDF template to use and whether to include the student profile. */
(function () {
  'use strict';
  const KEY = 'clinicalJournal.export.v1';
  const $ = s => document.querySelector(s);
  const themes = window.ClinicalPDF.themes;
  const modalEl = $('#exportModal'), modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  let target = 'full';
  let prefs = { template: 'classic', withProfile: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (!themes[prefs.template]) prefs.template = 'classic';

  function preview(key, t) {
    const c = t.c;
    return `<span class="tpl-preview tpl-${t.cover}" style="--d:${c.dark};--a:${c.accent};--g:${c.gold};--s:${c.soft};--cr:${c.cream}">
      <i class="tp-a"></i><i class="tp-b"></i><i class="tp-c"></i><i class="tp-d"></i><i class="tp-e"></i><i class="tp-f"></i></span>`;
  }
  $('#templateGrid').innerHTML = Object.entries(themes).map(([key, t]) => `
    <label class="tpl-card">
      <input type="radio" name="pdfTemplate" value="${key}">
      ${preview(key, t)}
      <span class="tpl-meta"><strong>${t.label}</strong><small>${t.note}</small></span>
      <span class="tpl-check"><svg class="icon"><use href="#ico-check"/></svg></span>
    </label>`).join('');

  function markSelected() {
    modalEl.querySelectorAll('.tpl-card').forEach(card => card.classList.toggle('is-selected', card.querySelector('input').checked));
  }
  $('#templateGrid').addEventListener('change', markSelected);

  function open(which) {
    target = String(which);
    const week = window.PORTFOLIO.weeks.find(w => w.id === Number(which));
    $('#exportTargetLabel').textContent = target === 'full' ? 'Complete portfolio' : 'Week ' + String(week.id).padStart(2, '0') + ' — ' + week.title;
    modalEl.querySelector(`[name="pdfTemplate"][value="${prefs.template}"]`).checked = true;
    modalEl.querySelector(`[name="pdfProfile"][value="${prefs.withProfile ? 'with' : 'without'}"]`).checked = true;
    markSelected();
    modal.show();
  }
  $('#exportForm').addEventListener('submit', e => {
    e.preventDefault();
    prefs = { template: modalEl.querySelector('[name="pdfTemplate"]:checked').value, withProfile: modalEl.querySelector('[name="pdfProfile"]:checked').value === 'with' };
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (err) {}
    modal.hide();
    window.ClinicalPDF.export(target, prefs);
  });
  window.ExportDialog = { open };
})();
