// main.js

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";
// CSS is linked in HTML, so no import needed here: // import "./styles/index.v3.css";
import { CameraManager } from "./camera";
import { MediaRecorderManager } from "./recorder";
import { UIManager } from "./ui";
import { VideoProcessor } from "./videoProcessor";
import { Settings } from "./settings";

// Motion Permission Request Function
async function requestMotionPermissions() {
  let motionGranted = false;
  let orientationGranted = false;

  // Helper to request a specific permission
  async function requestPermission(eventType, eventName) {
    let granted = false;
    if (typeof eventType !== 'undefined' && typeof eventType.requestPermission === 'function') {
      try {
        console.log(`Requesting ${eventName} permission...`);
        const permissionState = await eventType.requestPermission();
        if (permissionState === 'granted') {
          console.log(`${eventName} permission granted.`);
          granted = true;
        } else {
          console.warn(`${eventName} permission ${permissionState}.`);
        }
      } catch (error) {
        console.error(`Error requesting ${eventName} permission:`, error);
        // Avoid alerting for non-critical errors, log them instead.
      }
    } else {
      console.log(`${eventName}.requestPermission API not available (e.g., not iOS 12.2+/Safari, or already handled).`);
      granted = true; // Assume accessible or not strictly required by this API if not present
    }
    return granted;
  }

  motionGranted = await requestPermission(DeviceMotionEvent, 'DeviceMotionEvent');
  orientationGranted = await requestPermission(DeviceOrientationEvent, 'DeviceOrientationEvent');

  return { motionGranted, orientationGranted };
}

// Main application initialization logic
async function initializeARApp(uiManager) {
  const loadingElement = document.getElementById("loading"); // The spinner div

  // Get environment variables
  const apiToken = process.env.API_TOKEN;
  const lensID = process.env.LENS_ID;
  const groupID = process.env.GROUP_ID;

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. Please check your environment settings.");
    if (loadingElement) {
        loadingElement.innerHTML = `<p style="color:red; text-align:center; padding:20px; font-weight:bold;">Configuration Error!<br>Please check console.</p>`;
        loadingElement.style.display = 'flex'; // Ensure it's visible
    }
    return false; // Indicate failure
  }

  // Initialize managers
  const cameraManager = new CameraManager();
  const videoProcessor = new VideoProcessor();
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager, cameraManager);

  try {
    // Request Motion Sensor Permissions (now tied to user gesture from start button)
    const motionPermissions = await requestMotionPermissions();
    if (!motionPermissions.motionGranted || !motionPermissions.orientationGranted) {
        console.warn("Motion/Orientation permissions were not fully granted. Some AR features might be limited.");
        // Non-blocking, app can often proceed.
    }

    // Initialize Camera Kit
    const cameraKit = await bootstrapCameraKit({ apiToken });

    const liveRenderTarget = document.getElementById("canvas");
    if (!liveRenderTarget) throw new Error("Canvas element not found!");
    const session = await cameraKit.createSession({ liveRenderTarget });

    // Initialize camera (this will also prompt for camera/mic)
    const mediaStream = await cameraManager.initializeCamera();
    const initialSource = createMediaStreamSource(mediaStream, {
      cameraType: cameraManager.isBackFacing ? "environment" : "user",
      disableSourceAudio: false,
    });
    cameraManager.currentSource = initialSource;
    await session.setSource(initialSource);

    if (!cameraManager.isBackFacing && cameraManager.isMobile) { // Mirror front camera on mobile
      initialSource.setTransform(Transform2D.MirrorX);
    }
    await session.setFPSLimit(Settings.camera.fps);
    await session.play();

    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID);
    await session.applyLens(lens);

    // Set up UI event listeners
    uiManager.recordButton.addEventListener("click", async () => {
      if (uiManager.recordPressedCount % 2 === 0) {
        const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager);
        if (success) {
          uiManager.updateRecordButtonState(true);
        } else {
            // If startRecording failed, reset button state
            uiManager.recordPressedCount = 0; // Or ensure it's even
            uiManager.updateRecordButtonState(false);
        }
      } else {
        uiManager.updateRecordButtonState(false);
        uiManager.toggleRecordButton(false); // Hides record button after stopping
        mediaRecorder.stopRecording();
      }
    });

    uiManager.switchButton.addEventListener("click", async () => {
      try {
        uiManager.showLoading(true); // Show loader during camera switch
        const newSource = await cameraManager.updateCamera(session);
        uiManager.updateRenderSize(newSource, liveRenderTarget);
        if (mediaRecorder.isRecording()) {
          mediaRecorder.switchCameraAudio(cameraManager.mediaStream);
        }
      } catch (error) {
        console.error("Error switching camera:", error);
        alert("Could not switch camera. Please try again."); // User feedback
      } finally {
        uiManager.showLoading(false);
      }
    });

    window.addEventListener("resize", () => uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget));
    uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget);

    document.body.classList.add("app-started"); // For CSS targeting

    return true; // Indicate success

  } catch (error) {
    console.error("Error during application startup:", error);
    if (loadingElement) {
        loadingElement.innerHTML = `<p style="color:red; text-align:center; padding:20px; font-weight:bold;">Failed to Start AR Experience <br>(${error.message})<br>Please refresh and ensure camera/microphone permissions are granted.</p>`;
        loadingElement.style.display = 'flex';
    } else {
        alert(`Failed to Start AR Experience: ${error.message}. Please refresh and ensure permissions are granted.`);
    }
    return false; // Indicate failure
  } finally {
    // Hide loading spinner only if initialization was successful or if it was not handled by error case
    // The error cases above explicitly manage the loadingElement's content and visibility.
    // If no error, it will be hidden at the end of this block by uiManager.showLoading(false) from the caller.
  }
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const startScreen = document.getElementById('start-screen');
  const startArButton = document.getElementById('start-ar-button');
  const loadingElement = document.getElementById('loading'); // The main spinner
  const uiManager = new UIManager(); // Instantiate UIManager once, it manages its own elements

  if (startArButton && startScreen && loadingElement) {
    startArButton.addEventListener('click', async () => {
      startArButton.disabled = true; // Prevent double clicks
      startArButton.textContent = "Loading...";

      // Hide start screen using CSS class for transition
      startScreen.classList.add('hidden');

      // Show the main loading spinner
      uiManager.showLoading(true); // UIManager handles the #loading element

      // A brief delay can make the transition feel smoother if CSS transition isn't enough
      // or if heavy JS follows immediately. Usually, class-based transition is sufficient.
      // setTimeout(async () => {
        try {
          const success = await initializeARApp(uiManager);
          if (success) {
            // App initialized successfully, hide loader
            uiManager.showLoading(false);
          } else {
            // Initialization failed, error message should be visible in loadingElement
            // No need to hide loadingElement as it displays the error
            startArButton.disabled = false; // Re-enable button if start failed
            startArButton.textContent = "Try Again";
            startScreen.classList.remove('hidden'); // Show start screen again
          }
        } catch (e) {
          // Catch any unexpected errors from initializeARApp itself
          console.error("Critical error during app initialization sequence:", e);
          if (loadingElement) {
              loadingElement.innerHTML = `<p style="color:red; text-align:center;padding:20px;font-weight:bold;">Critical Application Error.<br>Could not start. Check console for details.</p>`;
              loadingElement.style.display = 'flex';
          }
          startArButton.disabled = false;
          startArButton.textContent = "Error - Try Again";
          startScreen.classList.remove('hidden');
        }
      // }, 100); // Small delay example, often not needed

    });
  } else {
    console.error("Essential UI elements (start screen, start button, or loading indicator) not found! App cannot initialize.");
    document.body.innerHTML = `<p style="color:red; text-align:center; padding: 50px; font-size: 1.2em; font-weight:bold;">Critical Error: UI Components Missing.<br>The application cannot start. Please contact support.</p>`;
  }
});