/**
 * SlapWin - Core Application Logic
 * Implements DeviceMotion sensing, Web Audio playback, and UI state.
 */

// --- Constants & State ---
const AppState = {
  sensitivity: parseFloat(localStorage.getItem('sw_sensitivity')) || 1.5,
  cooldown: parseFloat(localStorage.getItem('sw_cooldown')) || 1.0,
  volume: parseInt(localStorage.getItem('sw_volume')) || 100,
  sessionSlaps: 0,
  lifetimeSlaps: parseInt(localStorage.getItem('sw_lifetime_slaps')) || 0,
  lastSlapTime: 0,
  audioContext: null,
  isSensorsEnabled: false,
  audioBuffers: [] // Stores decoded audio data
};

// --- Sound Files ---
// List of your actual audio files here.
// For production, place .mp3/.ogg files in the 'sounds' folder.
const SOUND_FILES = [
  'sounds/sound1.mp3',
  'sounds/sound2.mp3',
  'sounds/sound3.mp3'
];

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
  rngSensitivity: document.getElementById('range-sensitivity'),
  valSensitivity: document.getElementById('val-sensitivity'),
  rngCooldown: document.getElementById('range-cooldown'),
  valCooldown: document.getElementById('val-cooldown'),
  rngVolume: document.getElementById('range-volume'),
  valVolume: document.getElementById('val-volume'),
  loadingText: document.getElementById('loading-text')
};

// --- Initialization ---
async function init() {
  updateStatsUI();
  loadSettingsUI();
  bindEvents();

  if (localStorage.getItem('sw_onboarded') === 'true') {
    DOM.onboarding.classList.add('hidden');
    await enableSensors();
  }
}

function loadSettingsUI() {
  DOM.rngSensitivity.value = AppState.sensitivity;
  DOM.valSensitivity.innerText = AppState.sensitivity.toFixed(1);
  DOM.rngCooldown.value = AppState.cooldown;
  DOM.valCooldown.innerText = AppState.cooldown.toFixed(1);
  DOM.rngVolume.value = AppState.volume;
  DOM.valVolume.innerText = AppState.volume;
}

// --- Event Binding ---
function bindEvents() {
  DOM.btnStart.addEventListener('click', async () => {
    localStorage.setItem('sw_onboarded', 'true');
    DOM.btnStart.innerText = "Loading sounds...";
    DOM.btnStart.disabled = true;

    await enableSensors();
    DOM.onboarding.classList.add('hidden');
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    toggleMenu();
  });

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
      e.preventDefault();
      triggerSlap(Math.random() * 2 + 1.5);
    }
    if (e.key === 'Escape' && !DOM.menu.classList.contains('hidden')) {
      toggleMenu();
    }
  });

  DOM.btnCloseMenu.addEventListener('click', toggleMenu);
  DOM.btnSimulate.addEventListener('click', () => triggerSlap(Math.random() * 2 + 1.5));

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

// --- Sensor Handling & Audio Init ---
async function enableSensors() {
  if (AppState.isSensorsEnabled) return;

  // Initialize Web Audio Context
  if (!AppState.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    AppState.audioContext = new AudioContext();
  } else if (AppState.audioContext.state === 'suspended') {
    AppState.audioContext.resume();
  }

  // Pre-load audio files into buffers
  await loadAudioFiles();

  // Request permission for iOS 13+ devices
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const response = await DeviceMotionEvent.requestPermission();
      if (response == 'granted') {
        window.addEventListener('devicemotion', handleMotion);
        AppState.isSensorsEnabled = true;
      } else {
        alert('Motion sensor permission denied. You can still use Spacebar to simulate slaps.');
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    // Non-iOS or older devices
    window.addEventListener('devicemotion', handleMotion);
    AppState.isSensorsEnabled = true;
  }
}

// Loads audio files over network/cache and decodes them into memory for instant playback
async function loadAudioFiles() {
  AppState.audioBuffers = [];

  for (const url of SOUND_FILES) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Could not load sound: ${url}`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await AppState.audioContext.decodeAudioData(arrayBuffer);
      AppState.audioBuffers.push(decodedBuffer);
    } catch (err) {
      console.error(`Error decoding sound ${url}:`, err);
    }
  }

  if (AppState.audioBuffers.length === 0) {
    console.warn("No sounds loaded. Please place .mp3 files in the sounds/ directory and update the SOUND_FILES array.");
  }
}

function handleMotion(event) {
  if (!event.accelerationIncludingGravity) return;

  const { x, y, z } = event.accelerationIncludingGravity;
  const magnitude = Math.sqrt(x*x + y*y + z*z) / 9.8;

  if (magnitude > AppState.sensitivity) {
    triggerSlap(magnitude);
  }
}

// --- Core Slap Logic ---
function triggerSlap(force) {
  const now = Date.now();
  if (now - AppState.lastSlapTime < AppState.cooldown * 1000) return;

  AppState.lastSlapTime = now;

  AppState.sessionSlaps++;
  AppState.lifetimeSlaps++;
  localStorage.setItem('sw_lifetime_slaps', AppState.lifetimeSlaps);
  updateStatsUI();

  playVisuals();
  playSound(force);
}

function playVisuals() {
  DOM.overlay.classList.remove('hidden');
  DOM.overlay.classList.remove('flash-anim');
  void DOM.overlay.offsetWidth; // trigger reflow
  DOM.overlay.classList.add('flash-anim');

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

// --- Audio Playback ---
function playSound(force) {
  if (!AppState.audioContext || AppState.audioBuffers.length === 0) return;

  const ctx = AppState.audioContext;
  if (ctx.state === 'suspended') ctx.resume();

  // Pick a random sound
  const randomBuffer = AppState.audioBuffers[Math.floor(Math.random() * AppState.audioBuffers.length)];

  const source = ctx.createBufferSource();
  source.buffer = randomBuffer;

  const gainNode = ctx.createGain();

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Normalize force for volume mapping (min force ~1.5, max ~5.0+)
  const normalizedForce = Math.min(Math.max((force - 1.0) / 4.0, 0.1), 1.0);
  const masterVolume = AppState.volume / 100;

  // Scale volume based on slap force and user settings
  gainNode.gain.value = normalizedForce * masterVolume * 1.5;

  source.start(0);
}

// Start App
init();
