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
      version: 1,
      name: 'Supernova',
      weightClassLb: 12,
      isExample: true,
      battery: {
        chemistry: 'LiPo',
        cellsSeries: 6,          // S
        cellsParallel: 1,        // P
        capacityMah: 1300,       // per cell (per parallel group member)
        resistanceMode: 'ir',    // 'ir' = measured mΩ per cell, 'c' = estimate from C-rating
        cellResistanceMohm: 5,
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
    try { merge(p, JSON.parse(localStorage.getItem(KEY))); } catch (e) {}
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
