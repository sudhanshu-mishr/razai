import re

with open('/app/SlapWin/app.js', 'r') as f:
    content = f.read()

# Add AppState vars for Camera
app_state = """  audioContext: null,
  isSensorsEnabled: false,
  audioBuffers: [] // Array of pre-decoded ArrayBuffers ready for playback"""
app_state_new = """  audioContext: null,
  isSensorsEnabled: false,
  audioBuffers: [], // Array of pre-decoded ArrayBuffers ready for playback
  isCameraEnabled: localStorage.getItem('sw_camera') === 'true',
  gestureRecognizer: null,
  cameraStream: null,
  lastVideoTime: -1,
  cameraAnimFrame: null"""
content = content.replace(app_state, app_state_new)

# Add DOM elements
dom = """  rngVolume: document.getElementById('range-volume'),
  valVolume: document.getElementById('val-volume'),
  fileUpload: document.getElementById('file-upload'),
  uploadStatus: document.getElementById('upload-status')"""
dom_new = """  rngVolume: document.getElementById('range-volume'),
  valVolume: document.getElementById('val-volume'),
  fileUpload: document.getElementById('file-upload'),
  uploadStatus: document.getElementById('upload-status'),
  chkCamera: document.getElementById('toggle-camera'),
  webcam: document.getElementById('webcam'),
  cameraStatus: document.getElementById('camera-status')"""
content = content.replace(dom, dom_new)


# Load Settings for Camera UI
load_settings = """  DOM.rngVolume.value = AppState.volume;
  DOM.valVolume.innerText = AppState.volume;"""
load_settings_new = """  DOM.rngVolume.value = AppState.volume;
  DOM.valVolume.innerText = AppState.volume;
  DOM.chkCamera.checked = AppState.isCameraEnabled;
  if (AppState.isCameraEnabled) toggleCamera(true);"""
content = content.replace(load_settings, load_settings_new)


# Bind Camera Checkbox Event
bind_events = """  // Handle Custom Audio Uploads
  DOM.fileUpload.addEventListener('change', handleFileUpload);"""
bind_events_new = """  // Handle Custom Audio Uploads
  DOM.fileUpload.addEventListener('change', handleFileUpload);

  DOM.chkCamera.addEventListener('change', (e) => {
    toggleCamera(e.target.checked);
  });"""
content = content.replace(bind_events, bind_events_new)


# Append MediaPipe and Camera Logic to end of file
camera_logic = """

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
"""

with open('/app/SlapWin/app.js', 'w') as f:
    f.write(content + camera_logic)
