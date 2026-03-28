import re

with open('/app/SlapWin/index.html', 'r') as f:
    content = f.read()

# Inject MediaPipe dependencies into the head
mediapipe_scripts = """  <link rel="stylesheet" href="style.css">

  <!-- MediaPipe Vision -->
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js" crossorigin="anonymous"></script>"""
content = content.replace('  <link rel="stylesheet" href="style.css">', mediapipe_scripts)

# Inject hidden video element for webcam inside main
video_el = """  <main id="app-container">
    <video id="webcam" autoplay playsinline class="hidden"></video>
    <img id="indicator" src="images/slap_image.webp" alt="Slap Indicator" class="hidden">"""
content = content.replace('  <main id="app-container">\n    <img id="indicator"', video_el)

# Inject Toggle for Camera Gestures into settings menu
camera_toggle = """      <div class="control-group">
        <label>Custom Sound Effects</label>"""
camera_html = """      <div class="control-group switch-group">
        <label for="toggle-camera">Camera Gestures (Thumbs Up)</label>
        <label class="switch">
          <input type="checkbox" id="toggle-camera">
          <span class="slider round"></span>
        </label>
      </div>
      <small id="camera-status" style="display: block; margin-bottom: 1.2rem; margin-top: -0.8rem; color: var(--text-secondary);"></small>

      <div class="control-group">
        <label>Custom Sound Effects</label>"""
content = content.replace(camera_toggle, camera_html)

# Add instructions to Onboarding
onboarding_text = """        <li>Open menu: <strong>Right-Click</strong>, tap the screen with two fingers, or press <strong>Ctrl+Shift+S</strong>.</li>
        <li>Simulate Slap: Press <strong>Spacebar</strong>.</li>
        <li><strong>New:</strong> Enable camera in settings to slap with a Thumbs Up gesture! 👍</li>"""
content = content.replace('        <li>Simulate Slap: Press <strong>Spacebar</strong>.</li>', onboarding_text)

with open('/app/SlapWin/index.html', 'w') as f:
    f.write(content)
