/**
 * SlapWin - Core Application Logic
 * Implements DeviceMotion sensing, Web Audio generation, and UI state.
 */

// --- Constants & State ---
const AppState = {
  sensitivity: parseFloat(localStorage.getItem('sw_sensitivity')) || 1.5,
  cooldown: parseFloat(localStorage.getItem('sw_cooldown')) || 1.0,
  volume: parseInt(localStorage.getItem('sw_volume')) || 100,
  pack: localStorage.getItem('sw_pack') || 'sexy',
  sessionSlaps: 0,
  lifetimeSlaps: parseInt(localStorage.getItem('sw_lifetime_slaps')) || 0,
  lastSlapTime: 0,
  audioContext: null,
  isSensorsEnabled: false
};

// --- DOM Elements ---
const DOM = {
  overlay: document.getElementById('flash-overlay'),
  indicator: document.getElementById('indicator'),
  menu: document.getElementById('settings-menu'),
  onboarding: document.getElementById('onboarding'),
  btnStart: document.getElementById('btn-start'),
  btnCloseMenu: document.getElementById('btn-close-menu'),
  btnSimulate: document.getElementById('btn-simulate'),
  statSession: document.getElementById('stat-session'),
  statLifetime: document.getElementById('stat-lifetime'),
  selPack: document.getElementById('select-pack'),
  rngSensitivity: document.getElementById('range-sensitivity'),
  valSensitivity: document.getElementById('val-sensitivity'),
  rngCooldown: document.getElementById('range-cooldown'),
  valCooldown: document.getElementById('val-cooldown'),
  rngVolume: document.getElementById('range-volume'),
  valVolume: document.getElementById('val-volume')
};

// --- Initialization ---
function init() {
  updateStatsUI();
  loadSettingsUI();
  bindEvents();

  // If user already onboarded in a previous session (check lifetime slaps or explicit flag)
  if (localStorage.getItem('sw_onboarded') === 'true') {
    DOM.onboarding.classList.add('hidden');
    enableSensors();
  }
}

function loadSettingsUI() {
  DOM.selPack.value = AppState.pack;
  DOM.rngSensitivity.value = AppState.sensitivity;
  DOM.valSensitivity.innerText = AppState.sensitivity.toFixed(1);
  DOM.rngCooldown.value = AppState.cooldown;
  DOM.valCooldown.innerText = AppState.cooldown.toFixed(1);
  DOM.rngVolume.value = AppState.volume;
  DOM.valVolume.innerText = AppState.volume;
}

// --- Event Binding ---
function bindEvents() {
  // Onboarding Start
  DOM.btnStart.addEventListener('click', () => {
    localStorage.setItem('sw_onboarded', 'true');
    DOM.onboarding.classList.add('hidden');
    enableSensors();
  });

  // Settings Menu Toggles
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    toggleMenu();
  });

  // Double tap to open menu (mobile fallback)
  let lastTap = 0;
  document.addEventListener('touchstart', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 500 && tapLength > 0) {
      toggleMenu();
      e.preventDefault();
    }
    lastTap = currentTime;
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') toggleMenu();
    if (e.key === ' ' && DOM.onboarding.classList.contains('hidden') && DOM.menu.classList.contains('hidden')) {
      e.preventDefault(); // prevent scrolling
      triggerSlap(Math.random() * 2 + 1.5); // Simulate random force
    }
    if (e.key === 'Escape' && !DOM.menu.classList.contains('hidden')) {
      toggleMenu();
    }
  });

  DOM.btnCloseMenu.addEventListener('click', toggleMenu);
  DOM.btnSimulate.addEventListener('click', () => triggerSlap(Math.random() * 2 + 1.5));

  // Settings Updates
  DOM.selPack.addEventListener('change', (e) => {
    AppState.pack = e.target.value;
    localStorage.setItem('sw_pack', AppState.pack);
  });

  DOM.rngSensitivity.addEventListener('input', (e) => {
    AppState.sensitivity = parseFloat(e.target.value);
    DOM.valSensitivity.innerText = AppState.sensitivity.toFixed(1);
    localStorage.setItem('sw_sensitivity', AppState.sensitivity);
  });

  DOM.rngCooldown.addEventListener('input', (e) => {
    AppState.cooldown = parseFloat(e.target.value);
    DOM.valCooldown.innerText = AppState.cooldown.toFixed(1);
    localStorage.setItem('sw_cooldown', AppState.cooldown);
  });

  DOM.rngVolume.addEventListener('input', (e) => {
    AppState.volume = parseInt(e.target.value, 10);
    DOM.valVolume.innerText = AppState.volume;
    localStorage.setItem('sw_volume', AppState.volume);
  });
}

// --- Sensor Handling ---
function enableSensors() {
  if (AppState.isSensorsEnabled) return;

  // Initialize Web Audio Context on first user interaction
  if (!AppState.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    AppState.audioContext = new AudioContext();
  } else if (AppState.audioContext.state === 'suspended') {
    AppState.audioContext.resume();
  }

  // Request permission for iOS 13+ devices
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(response => {
        if (response == 'granted') {
          window.addEventListener('devicemotion', handleMotion);
          AppState.isSensorsEnabled = true;
        } else {
          alert('Motion sensor permission denied. You can still use Spacebar to simulate slaps.');
        }
      })
      .catch(console.error);
  } else {
    // Non-iOS or older devices
    window.addEventListener('devicemotion', handleMotion);
    AppState.isSensorsEnabled = true;
  }
}

function handleMotion(event) {
  if (!event.accelerationIncludingGravity) return;

  const { x, y, z } = event.accelerationIncludingGravity;
  // Calculate magnitude of acceleration
  // Subtract 9.8 (1g) to roughly account for gravity if device is at rest
  const magnitude = Math.sqrt(x*x + y*y + z*z) / 9.8;

  // High-pass filter basic implementation (only react to sudden changes)
  // If magnitude exceeds sensitivity threshold
  if (magnitude > AppState.sensitivity) {
    triggerSlap(magnitude);
  }
}

// --- Core Slap Logic ---
function triggerSlap(force) {
  const now = Date.now();
  if (now - AppState.lastSlapTime < AppState.cooldown * 1000) return;

  AppState.lastSlapTime = now;

  // Update Stats
  AppState.sessionSlaps++;
  AppState.lifetimeSlaps++;
  localStorage.setItem('sw_lifetime_slaps', AppState.lifetimeSlaps);
  updateStatsUI();

  // Visual Feedback
  playVisuals();

  // Audio Feedback
  playProceduralSound(force);
}

function playVisuals() {
  // Flash Screen
  DOM.overlay.classList.remove('hidden');
  DOM.overlay.classList.remove('flash-anim');
  void DOM.overlay.offsetWidth; // trigger reflow
  DOM.overlay.classList.add('flash-anim');

  // Text Indicator
  DOM.indicator.classList.remove('hidden');
  DOM.indicator.style.animation = 'none';
  void DOM.indicator.offsetWidth; // trigger reflow
  DOM.indicator.style.animation = 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

  setTimeout(() => {
    DOM.overlay.classList.add('hidden');
  }, 150);
}

function updateStatsUI() {
  DOM.statSession.innerText = AppState.sessionSlaps;
  DOM.statLifetime.innerText = AppState.lifetimeSlaps;
}

function toggleMenu() {
  DOM.menu.classList.toggle('hidden');
}

// --- Procedural Audio Generation (Web Audio API) ---
// Generates sounds dynamically to keep the app 100% offline without large sound files.
function playProceduralSound(force) {
  if (!AppState.audioContext) return;

  const ctx = AppState.audioContext;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  const t = ctx.currentTime;

  // Normalize force for volume mapping (min force ~1.5, max ~5.0+)
  const normalizedForce = Math.min(Math.max((force - 1.0) / 4.0, 0.1), 1.0);
  const masterVolume = AppState.volume / 100;

  // Map parameters based on selected Pack
  let duration = 0.5;

  switch(AppState.pack) {
    case 'sexy':
      // Moan-like: Sine wave, sliding pitch down, low-pass filter
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + Math.random() * 200, t);
      osc.frequency.exponentialRampToValueAtTime(150 + Math.random() * 50, t + 0.6);
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      duration = 0.6 + Math.random() * 0.4;
      break;

    case 'goat':
      // Bleat: Sawtooth, vibrato, quick attack
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300 + Math.random() * 100, t);
      osc.frequency.linearRampToValueAtTime(250 + Math.random() * 50, t + 0.4);
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      duration = 0.4 + Math.random() * 0.2;
      break;

    case 'protest':
      // Megaphone shout: Square, high mid filter
      osc.type = 'square';
      osc.frequency.setValueAtTime(200 + Math.random() * 150, t);
      osc.frequency.linearRampToValueAtTime(180, t + 0.3);
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      duration = 0.5;
      break;

    case 'pain':
      // Oof/Grunt: Triangle, low pitch, sharp decay
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120 + Math.random() * 50, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      duration = 0.2 + Math.random() * 0.1;
      break;

    case 'robot':
      // Robotic: Square wave, stepped frequency
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.setValueAtTime(300, t + 0.1);
      osc.frequency.setValueAtTime(200, t + 0.2);
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      duration = 0.3;
      break;

    case 'alien':
      // Sci-fi sweep: Sine, fast high-to-low sweep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);
      filter.type = 'allpass';
      duration = 0.5;
      break;

    case 'ghost':
      // Spooky howl: Sine, slow attack, slow release
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 + Math.random() * 100, t);
      osc.frequency.linearRampToValueAtTime(350, t + 0.5);
      osc.frequency.linearRampToValueAtTime(250, t + 1.0);
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      duration = 1.0;
      break;

    case 'laser':
      // Pew pew: Sawtooth, extreme fast downward pitch sweep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500 + Math.random() * 500, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      duration = 0.2;
      break;
  }

  // Envelope (Volume Control)
  // Scale max volume by the force of the slap and user master volume
  const maxVol = normalizedForce * masterVolume * 2.0; // Boost max slightly

  gainNode.gain.setValueAtTime(0, t);

  if (AppState.pack === 'ghost') {
    // Slow attack/release for ghost
    gainNode.gain.linearRampToValueAtTime(maxVol, t + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, t + duration);
  } else if (AppState.pack === 'pain') {
    // Sharp attack/decay
    gainNode.gain.linearRampToValueAtTime(maxVol, t + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);
  } else {
    // Standard ADSR approximation
    gainNode.gain.linearRampToValueAtTime(maxVol, t + 0.05); // Attack
    gainNode.gain.exponentialRampToValueAtTime(maxVol * 0.5, t + 0.1); // Decay
    gainNode.gain.linearRampToValueAtTime(0.01, t + duration); // Release
  }

  osc.start(t);
  osc.stop(t + duration + 0.1);
}

// Start App
init();
