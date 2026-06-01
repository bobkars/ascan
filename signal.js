// ══════════════════════════════════════════════════════════════
// signal.js — Simulated A-scan signal source
//
// This file will be replaced by a Bluetooth hardware interface.
//
// It must expose two functions that app.js calls:
//
//   Signal.start(probeIndex)
//     Begin streaming waveform data for the given probe (0, 1, or 2).
//     Calls Signal.onFrame(pts) on each animation frame with a
//     Float32Array of normalised samples in [-1, 1].
//
//   Signal.stop()
//     Stop streaming. Safe to call when already stopped.
//
//   Signal.capture(probeIndex)
//     Return a single frozen waveform snapshot as an Array.
//     Called by doSave() to store with the record.
//
// The Bluetooth replacement should implement the same three
// functions and fire Signal.onFrame with real hardware samples.
// No changes to app.js should be needed.
// ══════════════════════════════════════════════════════════════

const Signal = (function () {

  // ── Simulated waveform config per probe ──────────────────────
  // Each entry is a list of echo pulses:
  //   t  = start position (0..1 along time axis)
  //   w  = pulse width
  //   a  = amplitude
  //   f  = oscillation frequency (cycles per pulse width)
  //   d  = decay rate
  const PROBE_CFG = [
    // 0° — Compression, straight beam
    // Initial pulse + two back-wall echoes + weak far reflection
    [
      { t: 0.03, w: 0.05, a: 0.85, f: 3,   d: 22  },
      { t: 0.19, w: 0.12, a: 0.52, f: 5,   d: 4   },
      { t: 0.43, w: 0.13, a: 0.70, f: 7,   d: 3.5 },
      { t: 0.68, w: 0.09, a: 0.28, f: 4,   d: 5   },
    ],
    // 37° — Shear, half-skip
    // Initial pulse + two shear echoes
    [
      { t: 0.03, w: 0.05, a: 0.80, f: 3,   d: 20  },
      { t: 0.24, w: 0.10, a: 0.44, f: 6,   d: 5   },
      { t: 0.50, w: 0.11, a: 0.58, f: 5,   d: 4   },
    ],
    // 70° — Shear, near-surface
    // Initial pulse + strong near-surface echo + two weaker ones
    [
      { t: 0.03, w: 0.05, a: 0.76, f: 3,   d: 18  },
      { t: 0.16, w: 0.08, a: 0.73, f: 8,   d: 6   },
      { t: 0.33, w: 0.10, a: 0.52, f: 6,   d: 4.5 },
      { t: 0.56, w: 0.07, a: 0.26, f: 5,   d: 7   },
    ],
  ];

  // Noise amplitude — set to 0 for a cleaner signal
  const NOISE = 0.025;

  let _phase     = 0;       // running phase accumulator
  let _animFrame = null;    // requestAnimationFrame handle
  let _probeIdx  = 0;       // current probe

  // ── Core sample generator ─────────────────────────────────────
  function _generate(probeIdx, phase, N) {
    const cfg = PROBE_CFG[probeIdx];
    const pts = new Array(N);
    for (let x = 0; x < N; x++) {
      const t = x / N;
      let y = 0;
      for (const e of cfg) {
        if (t > e.t && t < e.t + e.w) {
          const r = (t - e.t) / e.w;
          y += e.a * Math.sin(r * Math.PI * e.f + phase * 0.09) * Math.exp(-r * e.d);
        }
      }
      y += (Math.random() - 0.5) * NOISE;
      pts[x] = y;
    }
    return pts;
  }

  // ── Streaming loop ────────────────────────────────────────────
  function _loop() {
    _phase += 0.07;
    if (typeof Signal.onFrame === 'function') {
      Signal.onFrame(_generate(_probeIdx, _phase, 300));
    }
    _animFrame = requestAnimationFrame(_loop);
  }

  // ── Public API ────────────────────────────────────────────────
  return {

    // Called by app.js each frame with the latest waveform data.
    // Replace with Bluetooth data handler in the hardware version.
    onFrame: null,

    // Start streaming for the given probe.
    // probeIndex: 0, 1, or 2 (array index)
    // probeAngle: 0, 37, or 70 (degrees) — use this for the Bluetooth command
    start(probeIndex, probeAngle) {
      _probeIdx = probeIndex;
      // TODO: send Bluetooth command to hardware, e.g.:
      //   bluetooth.send({ cmd: 'SET_PROBE', angle: probeAngle });
      cancelAnimationFrame(_animFrame);
      _loop();
    },

    // Stop the stream
    stop() {
      cancelAnimationFrame(_animFrame);
      _animFrame = null;
    },

    // Return a single frozen snapshot for saving with a record
    capture(probeIndex) {
      return _generate(probeIndex, _phase, 300);
    },

  };

})();
