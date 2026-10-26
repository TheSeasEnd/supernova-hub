/* Calculators tab: a list of calculators (credited to their owners) + our own native
   Battery Sag & Wh calculator (sagcalc.js + sagmath.js). Only ROBO CALC is embedded (iframe); Ember (Level 5 Robotics)
   and the rest open in a new browser tab. No third-party calculator code is copied here. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  var EMBER = 'https://ember.level5robotics.com';
  var EMBER_CREDIT = 'Ember by <a href="https://level5robotics.com" target="_blank" rel="noopener">Level 5 Robotics</a> (with the SCAR community)';

  var CALCS = [
    // Add disabled: true (optionally disabledLabel) to grey a card out and block opening it; deep links then fall back to the list.
    { id: 'battery', kind: 'native', group: 'Built in', title: 'Battery Sag & Wh',
      desc: 'Any robot, any pack: watt-hours, pack resistance, voltage sag for weapon spin-up and drive pushes, late-match checks, heat and capacity.',
      credit: 'Built into this app · general-purpose estimate (sources inside)' },
    { id: 'robocalc', kind: 'embed', group: 'Embedded calculator', title: 'ROBO CALC',
      desc: 'Combat Robotics Calculator Tool: weapon, drive and more.',
      url: 'https://bdboxell.github.io/robocalc/',
      credit: 'Calculator by <a href="https://github.com/bdboxell/robocalc" target="_blank" rel="noopener">Brian Boxell / Too Hot Robotics</a>',
      note: 'CSV import/export may not work inside the embedded view on phones. Use “Open in browser” for that.' },
    { id: 'ember-wh', kind: 'link', group: 'Ember by Level 5 Robotics (opens in browser)', title: 'Ember · Watt-Hour Calculator',
      desc: 'Battery energy in watt-hours (handy for event battery limits).', url: EMBER + '/watt-hour', credit: EMBER_CREDIT },
    { id: 'ember-battery', kind: 'link', group: 'Ember by Level 5 Robotics (opens in browser)', title: 'Ember · Battery Size Calculator',
      desc: 'Size a pack for your robot’s loads.', url: EMBER + '/battery-size', credit: EMBER_CREDIT },
    { id: 'ember-cd', kind: 'link', group: 'Ember by Level 5 Robotics (opens in browser)', title: 'Ember · Center Distance',
      desc: 'Gears, chain and timing belt center distance.', url: EMBER + '/center-distance', credit: EMBER_CREDIT },
    { id: 'ember-vbelt', kind: 'link', group: 'Ember by Level 5 Robotics (opens in browser)', title: 'Ember · Center Distance (V-belt mode)',
      desc: 'Center distance with the V-belt mode preselected.', url: EMBER + '/center-distance?type=vbelt', credit: EMBER_CREDIT },
    { id: 'ember-home', kind: 'link', group: 'Ember by Level 5 Robotics (opens in browser)', title: 'Ember · all calculators',
      desc: 'Drivetrain, weapon, motor torque, scale factors, tach, tournament and more.', url: EMBER + '/', credit: EMBER_CREDIT },
    { id: 'fingertech', kind: 'link', group: 'Other calculators (open in browser)', title: 'FingerTech Pulley & Belt Calculator',
      desc: 'Pulley and belt how-to and calculator.', url: 'https://www.fingertechrobotics.com/how-to_pulley_belt.php',
      credit: 'By <a href="https://www.fingertechrobotics.com" target="_blank" rel="noopener">FingerTech Robotics</a>' },
    { id: 'sdpsi', kind: 'link', group: 'Other calculators (open in browser)', title: 'SDP/SI Center Distance Designer',
      desc: 'Belt/pulley center distance designer.', url: 'https://sdp-si.com/tools/center-distance-designer.php',
      credit: 'By <a href="https://sdp-si.com" target="_blank" rel="noopener">SDP/SI (Stock Drive Products / Sterling Instrument)</a>' },
    { id: 'gates', kind: 'link', group: 'Other calculators (open in browser)', title: 'Gates Belt Tension Calculator',
      desc: 'Recommended belt installation tension.', url: 'https://calculators.gates.com/BeltTension',
      credit: 'By <a href="https://www.gates.com" target="_blank" rel="noopener">Gates Corporation</a>' }
  ];
  function byId(id) { for (var i = 0; i < CALCS.length; i++) if (CALCS[i].id === id) return CALCS[i]; return null; }

  var root, current = 'list';

  function renderList() {
    var h = '<div class="sectiontitle" style="margin:2px 2px 10px">Calculators</div>', group = null;
    CALCS.forEach(function (c) {
      if (c.group !== group) { group = c.group; h += '<div class="calcgroup">' + esc(group) + '</div>'; }
      var action = c.disabled ? '<span class="ci-soon">' + esc(c.disabledLabel || 'Disabled') + '</span>'
        : c.kind === 'link'
        ? '<a class="btn ghost sm" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open ↗</a>'
        : '<button class="btn sm" data-open="' + c.id + '">' + (c.kind === 'native' ? 'Open' : 'Open here') + '</button>';
      h += '<div class="card calcitem' + (c.kind === 'native' ? ' native' : '') + (c.disabled ? ' disabled" aria-disabled="true' : '') + '"><div class="ci-main"><div class="ci-title">' + esc(c.title) + '</div>' +
        '<div class="ci-desc">' + esc(c.desc) + '</div><div class="ci-credit">' + c.credit + '</div></div><div class="ci-act">' + action +
        (c.kind === 'embed' ? '<a class="ci-ext" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open in browser ↗</a>' : '') + '</div></div>';
    });
    h += '<div class="note" style="padding:0 4px">External calculators belong to their owners and load live from their sites. Nothing is copied into this app. ROBO CALC loads in a frame here; the others open in a new browser tab.</div>';
    root.innerHTML = h;
  }

  function renderEmbed(c) {
    root.innerHTML = '<div class="calcbar"><button class="back" data-back>‹ Calculators</button>' +
      '<a class="btn sm" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open in browser ↗</a></div>' +
      '<div class="calctitle">' + esc(c.title) + '</div><div class="calccredit">' + c.credit + '</div>' +
      (c.note ? '<div class="calcnote">' + esc(c.note) + '</div>' : '') +
      '<div class="framewrap"><iframe title="' + esc(c.title) + '" src="' + esc(c.url) + '" referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
  }

  function onClick(e) {
    var t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.dataset.open && (byId(t.dataset.open) || {}).disabled) return;
    if (t.dataset.open) window.App.navigate('#calc/' + t.dataset.open, true);
    else if (t.hasAttribute('data-back')) window.App.back('#calc');
  }

  function open(id, fromHash) {
    var c = byId(id); current = c && c.kind !== 'link' && !c.disabled ? id : 'list';
    if (c && c.disabled && /^#calc\//.test(location.hash)) try { history.replaceState(null, '', '#calc'); } catch (e) {}
    if (current === 'list') renderList(); else if (c.kind === 'native') window.SagCalc.render(root); else renderEmbed(c);
    root.classList.toggle('embedmode', !!(c && c.kind === 'embed'));

  }

  window.Calcs = {
    init: function (el) { root = el; root.addEventListener('click', onClick); renderList(); },
    open: open,
    rerender: function () { if (current !== 'battery') open(current); },
    list: CALCS
  };
})();
