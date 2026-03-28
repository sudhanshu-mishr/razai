/**
 * SlapWin - Core Application Logic
 * Implements DeviceMotion sensing, custom Web Audio playback, and UI state.
 */

const AppState = {
  sensitivity: parseFloat(localStorage.getItem('sw_sensitivity')) || 1.5,
  cooldown: parseFloat(localStorage.getItem('sw_cooldown')) || 1.0,
  volume: parseInt(localStorage.getItem('sw_volume')) || 100,
  sessionSlaps: 0,
  lifetimeSlaps: parseInt(localStorage.getItem('sw_lifetime_slaps')) || 0,
  lastSlapTime: 0,
  audioContext: null,
  isSensorsEnabled: false,
  audioBuffers: [], // Array of pre-decoded ArrayBuffers ready for playback
  isCameraEnabled: localStorage.getItem('sw_camera') === 'true',
  gestureRecognizer: null,
  cameraStream: null,
  lastVideoTime: -1,
  cameraAnimFrame: null
};

// Default sound files (placeholder groans)
const DEFAULT_SOUNDS = [
  'sounds/sound1.mp3',
  'sounds/sound2.mp3',
  'sounds/sound3.mp3'
];

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
  fileUpload: document.getElementById('file-upload'),
  uploadStatus: document.getElementById('upload-status'),
  chkCamera: document.getElementById('toggle-camera'),
  webcam: document.getElementById('webcam'),
  cameraStatus: document.getElementById('camera-status')
};

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
  DOM.chkCamera.checked = AppState.isCameraEnabled;
  if (AppState.isCameraEnabled) toggleCamera(true);
}

function bindEvents() {
  DOM.btnStart.addEventListener('click', async () => {
    localStorage.setItem('sw_onboarded', 'true');
    DOM.btnStart.innerText = "Loading...";
    DOM.btnStart.disabled = true;

    await enableSensors();
    DOM.onboarding.classList.add('hidden');
  });

  // Handle Custom Audio Uploads
  DOM.fileUpload.addEventListener('change', handleFileUpload);

  DOM.chkCamera.addEventListener('change', (e) => {
    toggleCamera(e.target.checked);
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

// Custom Audio Importer
async function handleFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  DOM.uploadStatus.innerText = "Processing files...";
  DOM.uploadStatus.style.color = "var(--text-secondary)";

  if (!AppState.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    AppState.audioContext = new AudioContext();
  }

  if (AppState.audioContext.state === 'suspended') {
    AppState.audioContext.resume();
  }

  const newBuffers = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await AppState.audioContext.decodeAudioData(arrayBuffer);
      newBuffers.push(decodedBuffer);
    } catch (err) {
      console.error("Error decoding custom file:", err);
    }
  }

  // If successful, REPLACE the default buffers with the user's custom buffers for this session
  if (newBuffers.length > 0) {
    AppState.audioBuffers = newBuffers;
    DOM.uploadStatus.innerText = `Success! Loaded ${newBuffers.length} custom sounds.`;
    DOM.uploadStatus.style.color = "var(--accent)";
  } else {
    DOM.uploadStatus.innerText = "Failed to load files.";
    DOM.uploadStatus.style.color = "red";
  }
}

async function enableSensors() {
  if (AppState.isSensorsEnabled) return;

  if (!AppState.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    AppState.audioContext = new AudioContext();
  } else if (AppState.audioContext.state === 'suspended') {
    AppState.audioContext.resume();
  }

  // Load default fallback sounds only if the user hasn't already uploaded custom ones during setup
  if (AppState.audioBuffers.length === 0) {
    await loadDefaultAudio();
  }

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
    window.addEventListener('devicemotion', handleMotion);
    AppState.isSensorsEnabled = true;
  }
}

async function loadDefaultAudio() {
  AppState.audioBuffers = [];

  for (const url of DEFAULT_SOUNDS) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await AppState.audioContext.decodeAudioData(arrayBuffer);
      AppState.audioBuffers.push(decodedBuffer);
    } catch (err) {
      console.error(`Error decoding default sound ${url}:`, err);
    }
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
  void DOM.overlay.offsetWidth;
  DOM.overlay.classList.add('flash-anim');

  // Trigger Image Pop
  DOM.indicator.classList.remove('hidden');
  DOM.indicator.classList.remove('pop-anim');
  void DOM.indicator.offsetWidth;
  DOM.indicator.classList.add('pop-anim');

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

function playSound(force) {
  if (!AppState.audioContext || AppState.audioBuffers.length === 0) return;

  const ctx = AppState.audioContext;
  if (ctx.state === 'suspended') ctx.resume();

  const randomBuffer = AppState.audioBuffers[Math.floor(Math.random() * AppState.audioBuffers.length)];

  const source = ctx.createBufferSource();
  source.buffer = randomBuffer;

  const gainNode = ctx.createGain();

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  const normalizedForce = Math.min(Math.max((force - 1.0) / 4.0, 0.1), 1.0);
  const masterVolume = AppState.volume / 100;

  gainNode.gain.value = normalizedForce * masterVolume * 1.5;

  source.start(0);
}

init();


// --- Camera & Gesture Logic ---

async function initMediaPipe() {
  if (AppState.gestureRecognizer) return true;
  DOM.cameraStatus.innerText = "Loading AI models...";
  try {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    AppState.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1
    });
    DOM.cameraStatus.innerText = "AI models ready.";
    return true;
  } catch (error) {
    console.error("Failed to load MediaPipe:", error);
    DOM.cameraStatus.innerText = "Error loading AI models. Check connection.";
    return false;
  }
}

async function toggleCamera(enable) {
  AppState.isCameraEnabled = enable;
  localStorage.setItem('sw_camera', enable);

  if (enable) {
    if (!AppState.gestureRecognizer) {
      const ready = await initMediaPipe();
      if (!ready) {
        DOM.chkCamera.checked = false;
        AppState.isCameraEnabled = false;
        return;
      }
    }

    try {
      DOM.cameraStatus.innerText = "Requesting camera...";
      AppState.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      DOM.webcam.srcObject = AppState.cameraStream;
      DOM.webcam.addEventListener("loadeddata", predictWebcam);
      DOM.cameraStatus.innerText = "Camera Active. Thumbs Up to slap!";
      DOM.cameraStatus.style.color = "var(--accent)";
    } catch (err) {
      console.error("Camera error:", err);
      DOM.cameraStatus.innerText = "Camera access denied or unavailable.";
      DOM.cameraStatus.style.color = "red";
      DOM.chkCamera.checked = false;
      AppState.isCameraEnabled = false;
    }
  } else {
    // Disable camera
    if (AppState.cameraStream) {
      AppState.cameraStream.getTracks().forEach(track => track.stop());
      DOM.webcam.srcObject = null;
    }
    if (AppState.cameraAnimFrame) {
      cancelAnimationFrame(AppState.cameraAnimFrame);
    }
    DOM.cameraStatus.innerText = "Camera disabled.";
    DOM.cameraStatus.style.color = "var(--text-secondary)";
  }
}

async function predictWebcam() {
  if (!AppState.isCameraEnabled || !AppState.gestureRecognizer) return;

  const startTimeMs = performance.now();
  if (DOM.webcam.currentTime !== AppState.lastVideoTime) {
    AppState.lastVideoTime = DOM.webcam.currentTime;
    const results = AppState.gestureRecognizer.recognizeForVideo(DOM.webcam, startTimeMs);

    if (results.gestures.length > 0) {
      const gestureName = results.gestures[0][0].categoryName;
      const confidence = results.gestures[0][0].score;

      // Trigger slap if Thumb_Up is detected with good confidence
      if (gestureName === "Thumb_Up" && confidence > 0.6) {
        // Trigger with a random strong force for satisfying sound
        triggerSlap(Math.random() * 2 + 3.0);
      }
    }
  }

  // Loop request
  AppState.cameraAnimFrame = window.requestAnimationFrame(predictWebcam);
}
