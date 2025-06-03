/**
 * Camera Kit Web Demo with Recording Feature
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA
 */

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import "./styles/index.v3.css"
import { CameraManager } from "./camera"
import { MediaRecorderManager } from "./recorder"
import { UIManager } from "./ui"
import { VideoProcessor } from "./videoProcessor"
import { Settings } from "./settings"

// DOM Elements for start screen
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const permissionStatusElem = document.getElementById('permission-status');
const mainAppContainer = document.getElementById('main-app-container');
const loadingElement = document.getElementById("loading"); // Used by UIManager and for global errors

// Hide loading initially, start screen will be shown
if (loadingElement) loadingElement.style.display = 'none';

async function requestMotionPermissions() {
  permissionStatusElem.style.display = 'none'; // Clear previous status

  const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent); // General iOS check
  const isIPhone = /iPhone/i.test(navigator.userAgent); // Specific iPhone check

  // Only request on iPhone and if the permission API exists (iOS 13+)
  if (isIPhone && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    console.log("iPhone detected, attempting to request motion permissions.");
    try {
      const permissionState = await DeviceMotionEvent.requestPermission();
      if (permissionState === 'granted') {
        // Attempt to get orientation permission as well if motion is granted
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          try { 
            await DeviceOrientationEvent.requestPermission(); 
            console.log("Orientation permission granted on iPhone.");
          } 
          catch (orientError) { 
            console.warn('Could not get orientation permission on iPhone, but motion was granted:', orientError); 
          }
        }
        console.log("Motion permission granted on iPhone.");
        return true;
      } else {
        permissionStatusElem.textContent = 'Motion sensor permission was denied on your iPhone. Please enable it in Safari settings (Settings > Safari > Motion & Orientation Access) if you wish to use features requiring motion data.';
        permissionStatusElem.style.display = 'block';
        console.log("Motion permission denied on iPhone.");
        return false;
      }
    } catch (error) {
      console.error('Error requesting motion permission on iPhone:', error);
      permissionStatusElem.textContent = 'Could not request motion sensor permissions on your iPhone. An error occurred.';
      permissionStatusElem.style.display = 'block';
      return false;
    }
  } else {
    if (isIOSDevice && !isIPhone) {
        console.log('iOS device (not iPhone) detected. Motion permissions typically not explicitly requested or handled by OS/browser.');
    } else if (!isIOSDevice) {
        console.log('Non-iOS device detected. Assuming motion permissions are granted or not strictly required to be explicitly requested.');
    } else {
        // This case would be an iPhone but without the requestPermission API (older iOS)
        console.log('iPhone detected, but DeviceMotionEvent.requestPermission not found. Assuming permissions are handled by OS/browser (older iOS).');
    }
    return true; // For non-iPhones or iPhones without the specific API, assume granted or not needed
  }
}

async function initializeAppAndCameraKit() {
  // UIManager will be instantiated below, it handles the #loading element.
  // Show loading using UIManager once it's initialized.
  // Get environment variables
  const apiToken = process.env.API_TOKEN
  const lensID = process.env.LENS_ID
  const groupID = process.env.GROUP_ID

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. Please check your environment settings.")
    permissionStatusElem.textContent = "Configuration error. App cannot start. Please check console.";
    permissionStatusElem.style.display = 'block';
    startScreen.style.display = 'flex'; // Re-show start screen
    mainAppContainer.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'none'; // Hide loading if it was shown
    startButton.disabled = false; 
    startButton.textContent = 'Try Again';
    return
  }

  // Initialize managers
  const cameraManager = new CameraManager()
  const uiManager = new UIManager() 
  const videoProcessor = new VideoProcessor()
  // Pass cameraManager to MediaRecorderManager constructor
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager, cameraManager)


  uiManager.showLoading(true); // Show loading indicator now that UIManager is ready

  try {
    // Initialize Camera Kit
    const cameraKit = await bootstrapCameraKit({
      apiToken: apiToken,
    })

    // Get canvas element for live render target
    const liveRenderTarget = document.getElementById("canvas")

    // Create camera kit session
    const session = await cameraKit.createSession({ liveRenderTarget })

    // Initialize camera and set up source
    const mediaStream = await cameraManager.initializeCamera()
    const initialSource = createMediaStreamSource(mediaStream, { // Renamed to initialSource for clarity
      cameraType: cameraManager.isBackFacing ? "environment" : "user",
      disableSourceAudio: false, // Ensure audio is not disabled for the source
    })
    cameraManager.currentSource = initialSource // Store initial source in CameraManager
    await session.setSource(initialSource)

    if (!cameraManager.isBackFacing) {
      initialSource.setTransform(Transform2D.MirrorX)
    }
    // SetRenderSize will be called by uiManager.updateRenderSize
    await session.setFPSLimit(Settings.camera.fps)
    await session.play()

    // Load and apply lens
    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
    await session.applyLens(lens)

    // Set up event listeners
    uiManager.recordButton.addEventListener("click", async () => {
      if (uiManager.recordPressedCount % 2 === 0) {
        // Pass cameraManager instance to startRecording
        const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager)
        if (success) {
          uiManager.updateRecordButtonState(true)
        } else {
          // If starting failed, reset UI relevant parts (e.g. recordPressedCount)
          // uiManager.recordPressedCount may need to be handled carefully if start fails
        }
      } else {
        uiManager.updateRecordButtonState(false)
        uiManager.toggleRecordButton(false) // This hides the record button after stopping
        mediaRecorder.stopRecording()
      }
    })

    uiManager.switchButton.addEventListener("click", async () => {
      try {
        // cameraManager.updateCamera updates cameraManager.mediaStream and cameraManager.currentSource
        const newSource = await cameraManager.updateCamera(session)
        uiManager.updateRenderSize(newSource, liveRenderTarget)

        // If recording, switch the audio track for the MediaRecorder
        if (mediaRecorder.isRecording()) {
          mediaRecorder.switchCameraAudio(cameraManager.mediaStream) // Use the new mediaStream from cameraManager
        }
      } catch (error) {
        console.error("Error switching camera:", error)
        // Potentially inform the user
      }
    })

    // The back-button's onclick is now primarily managed within UIManager.displayPostRecordButtons
    // to ensure it has access to necessary instances for resetting state.

    // Add window resize listener
    window.addEventListener("resize", () => uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget))

    // Update initial render size
    uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget)
    // Hide loading icon once everything is ready
    uiManager.showLoading(false);
  } catch (error) {
    console.error("Error during app initialization:", error);
    permissionStatusElem.textContent = `Error initializing application: ${error.message}. Please refresh and try again.`;
    permissionStatusElem.style.display = 'block';
    startScreen.style.display = 'flex'; 
    mainAppContainer.style.display = 'none';
    uiManager.showLoading(false); // Ensure loading is hidden on error
    startButton.disabled = false;
    startButton.textContent = 'Try Again';
  }
}

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  startButton.textContent = 'Requesting Permissions...';
  permissionStatusElem.style.display = 'none'; 

  const permissionsGranted = await requestMotionPermissions();

  if (permissionsGranted) {
    startButton.textContent = 'Loading Experience...';
    // Hiding start screen and showing app container is done before calling initializeAppAndCameraKit
    startScreen.style.display = 'none';
    mainAppContainer.style.display = 'block'; 
    await initializeAppAndCameraKit(); 
  } else {
    // Permission message already set by requestMotionPermissions
    startButton.disabled = false;
    startButton.textContent = 'Grant Permissions & Start'; // Or 'Try Again' if more appropriate
    mainAppContainer.style.display = 'none'; 
  }
});