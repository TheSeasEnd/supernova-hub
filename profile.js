/* Shared robot profile store. One object that every calculator can read/write, so a future
   "robot designer" can share specs (battery, components, drivetrain...) across tools.
   Stored in localStorage under 'sn_robot_profile_v1'. */
(function () {
  'use strict';
  var KEY = 'sn_robot_profile_v1';
  var listeners = [];
  // Example defaults. 6S LiPo is from Supernova's NHRL wiki page; every other number is a generic
  // example (not Supernova's real spec) until the user edits it. `isExample` drives the UI banner.
  function defaults() {
    return {
      version: 2,
      name: 'Supernova',
      weightClassLb: 12,
      isExample: true,
      battery: {
        chemistry: 'LiPo',
        cellsSeries: 6,          // S
        cellsParallel: 1,        // P
        packCapacityMah: 1300,   // TOTAL pack capacity in mAh (as printed on the pack label)
        resistanceMode: 'ir',    // 'ir' = measured mΩ per cell, 'pack' = measured total pack mΩ, 'c' = estimate from C-rating
        cellResistanceMohm: 5,   // per cell
        packResistanceMohm: 30,  // whole pack (used when resistanceMode = 'pack')
        cRating: 100,
        cellFullV: 4.2,
        cellNominalV: 3.7,
        allowedSagPct: 10
      },
      components: [
        { id: 'c1', name: 'Drive motor (left)', qty: 1, peakA: 40, typicalA: 10 },
        { id: 'c2', name: 'Drive motor (right)', qty: 1, peakA: 40, typicalA: 10 },
        { id: 'c3', name: 'Weapon motor', qty: 1, peakA: 120, typicalA: 40 }
      ],
      // Reserved for future calculators / robot designer:
      drivetrain: {},
      weapon: {},
      updatedAt: null
    };
  }
  function merge(base, over) {
    if (!over || typeof over !== 'object') return base;
    Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }
  function load() {
    var p = defaults();
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      // v1 -> v2 migration: v1 stored capacity PER CELL ('capacityMah'); v2 stores TOTAL pack capacity.
      // Total = per-cell capacity × cells in parallel (P), which is what the v1 math already used.
      if (saved && saved.battery && saved.battery.capacityMah != null && saved.battery.packCapacityMah == null) {
        var per = parseFloat(saved.battery.capacityMah), par = parseFloat(saved.battery.cellsParallel) || 1;
        if (isFinite(per)) saved.battery.packCapacityMah = Math.round(per * par);
      }
      if (saved && saved.battery) delete saved.battery.capacityMah;
      if (saved) saved.version = 2;
      merge(p, saved);
    } catch (e) {}
    return p;
  }
  var current = load();
  window.RobotProfile = {
    get: function () { return current; },
    save: function (mutator) {
      if (typeof mutator === 'function') mutator(current);
      current.updatedAt = new Date().toISOString();
      try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) {}
      listeners.forEach(function (fn) { try { fn(current); } catch (e) {} });
      return current;
    },
    reset: function () { current = defaults(); try { localStorage.removeItem(KEY); } catch (e) {} listeners.forEach(function (fn) { fn(current); }); return current; },
    onChange: function (fn) { listeners.push(fn); },
    defaults: defaults
  };
})();
