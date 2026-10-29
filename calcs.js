/* Calculators tab: a list of calculators (credited to their owners) + our own native
   Battery Sag & Wh calculator (sagcalc.js + sagmath.js, currently disabled) and Weight Budget (weightview.js + weightmath.js). Nothing is embedded: ROBO CALC, Ember (Level 5 Robotics)
   and the rest are link-outs that open in a new browser tab (target=_blank rel=noopener). No third-party calculator code is copied here. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  var EMBER = 'https://ember.level5robotics.com';
  var EMBER_CREDIT = 'Ember by <a href="https://level5robotics.com" target="_blank" rel="noopener">Level 5 Robotics</a> (with the SCAR community)';

  var CALCS = [
    // disabled: true greys a card out and blocks opening it (deep links fall back to the list); disabledLabel is the tag shown.
    // Battery Sag & Wh is switched off for now: delete "disabled: true, disabledLabel: 'Coming soon'," below to turn it back on (sagcalc.js/sagmath.js are untouched).
    { id: 'battery', kind: 'native', render: 'sag', disabled: true, disabledLabel: 'Coming soon', group: 'Built in', title: 'Battery Sag & Wh',
      desc: 'Any robot, any pack: watt-hours, pack resistance, voltage sag for weapon spin-up and drive pushes, late-match checks, heat and capacity.',
      credit: 'Built into this app · general-purpose estimate (sources inside)' },
    { id: 'weight', kind: 'native', render: 'weight', badge: 'Work in progress', group: 'Built in', title: 'Weight Budget',
      desc: 'Parts list per robot with category subtotals, 3D-print weights, and a running total vs. the class limit (NHRL 2026 rules; SPARC for 1lb). Excel/CSV import and export.',
      credit: 'Built into this app · follows the robot switcher · saved on this device' },
    // v27: ROBO CALC is a link-out (no iframe). Old #calc/robocalc links land on the Calcs list.
    { id: 'robocalc', kind: 'link', group: 'ROBO CALC (opens in browser)', title: 'ROBO CALC',
      desc: 'Combat Robotics Calculator Tool: weapon, drive and more.',
      url: 'https://bdboxell.github.io/robocalc/',
      credit: 'Calculator by <a href="https://github.com/bdboxell/robocalc" target="_blank" rel="noopener">Brian Boxell / Too Hot Robotics</a>' },
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
        : '<button class="btn sm" data-open="' + c.id + '">Open</button>';
      h += '<div class="card calcitem' + (c.kind === 'native' ? ' native' : '') + (c.disabled ? ' disabled" aria-disabled="true' : '') + '"><div class="ci-main"><div class="ci-title">' + esc(c.title) + (c.badge ? ' <span class="tbuild">' + esc(c.badge) + '</span>' : '') + '</div>' +
        '<div class="ci-desc">' + esc(c.desc) + '</div><div class="ci-credit">' + c.credit + '</div></div><div class="ci-act">' + action + '</div></div>';
    });
    h += '<div class="note" style="padding:0 4px">External calculators belong to their owners and load live from their sites. Nothing is copied or embedded in this app; each one opens in a new browser tab.</div>';
    root.innerHTML = h;
  }


  function onClick(e) {
    var t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.dataset.open && (byId(t.dataset.open) || {}).disabled) return;
    if (t.dataset.open) window.App.navigate('#calc/' + t.dataset.open, true);
    else if (t.hasAttribute('data-back')) window.App.back('#calc');
  }

  function open(id, fromHash) {
    // Only native calcs open in-app. Unknown, disabled or link-out ids (e.g. an old #calc/robocalc
    // link from when ROBO CALC was embedded) fall back to the list and the URL is rewritten to #calc.
    var c = byId(id); current = c && c.kind === 'native' && !c.disabled ? id : 'list';
    if (current === 'list' && /^#calc\/./.test(location.hash)) try { history.replaceState(null, '', '#calc'); } catch (e) {}
    if (current === 'list') renderList(); else if (c.render === 'weight') window.WeightView.mount(root); else window.SagCalc.render(root);

  }

  window.Calcs = {
    init: function (el) { root = el; root.addEventListener('click', onClick); renderList(); },
    open: open,
    rerender: function () { if (current === 'weight') { if (window.WeightView) window.WeightView.rerender(); } else if (current !== 'battery') open(current); },
    list: CALCS
  };
})();
