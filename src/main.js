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
;(async function () {
  // Get environment variables
  const apiToken = process.env.API_TOKEN
  const lensID = process.env.LENS_ID
  const groupID = process.env.GROUP_ID

  const loadingElement = document.getElementById("loading") // Get loading element early

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. Please check your environment settings.")
    if (loadingElement) loadingElement.innerHTML = "Configuration error. Please check console and refresh."
    return
  }

  // Initialize managers
  const cameraManager = new CameraManager()
  const uiManager = new UIManager()
  const videoProcessor = new VideoProcessor()
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager, cameraManager)


  // Initialize Camera Kit
  const cameraKit = await bootstrapCameraKit({
    apiToken: apiToken,
  })

  // Get canvas element for live render target
  const liveRenderTarget = document.getElementById("canvas")
  // Add a background color to the canvas via CSS or JS to see letterboxing/pillarboxing
  liveRenderTarget.style.backgroundColor = 'black';


  // Create camera kit session
  const session = await cameraKit.createSession({ liveRenderTarget })

  // Initialize camera and set up source
  try {
    const mediaStream = await cameraManager.initializeCamera() // This now sets stream dimensions in cameraManager

    // A short delay here might give _updateStreamDimensions more time to get accurate values
    // This is a pragmatic workaround if initial dimensions are often reported as 0.
    await new Promise(resolve => setTimeout(resolve, 200)); // e.g., 200ms

    const initialSource = createMediaStreamSource(mediaStream, {
      cameraType: cameraManager.isBackFacing ? "environment" : "user",
      disableSourceAudio: false,
    })
    cameraManager.currentSource = initialSource
    await session.setSource(initialSource)

    if (!cameraManager.isBackFacing) {
      initialSource.setTransform(Transform2D.MirrorX)
    }
    
    // SetRenderSize will be called by uiManager.updateRenderSize shortly
    await session.setFPSLimit(Settings.camera.fps)
    await session.play()

    // Load and apply lens
    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
    await session.applyLens(lens)

    // Update initial render size
    // Ensure cameraManager.getSource() is valid and stream dimensions are (hopefully) set
    if (cameraManager.getSource()) {
      uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget, cameraManager)
    } else {
      console.error("Initial source not available for first render size update.");
    }

  } catch (err) {
    console.error("Error during camera initialization or lens loading:", err);
    if (loadingElement) loadingElement.innerHTML = `Error: ${err.message}. Please check permissions and refresh.`;
    // Potentially show a user-friendly error message on the page
    return; // Stop execution if critical setup fails
  }


  // Set up event listeners
  uiManager.recordButton.addEventListener("click", async () => {
    if (uiManager.recordPressedCount % 2 === 0) {
      const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager)
      if (success) {
        uiManager.updateRecordButtonState(true)
      }
    } else {
      uiManager.updateRecordButtonState(false)
      uiManager.toggleRecordButton(false)
      mediaRecorder.stopRecording()
    }
  })

  uiManager.switchButton.addEventListener("click", async () => {
    try {
      const newSource = await cameraManager.updateCamera(session) // This now updates stream dimensions

      // A short delay similar to initialization might be needed if dimensions are not immediately correct
      await new Promise(resolve => setTimeout(resolve, 200));

      uiManager.updateRenderSize(newSource, liveRenderTarget, cameraManager)

      if (mediaRecorder.isRecording()) {
        mediaRecorder.switchCameraAudio(cameraManager.mediaStream)
      }
    } catch (error) {
      console.error("Error switching camera:", error)
    }
  })


  window.addEventListener("resize", () => {
    if (cameraManager.getSource() && liveRenderTarget && cameraManager) {
        // It's good practice to debounce or throttle resize events if performance becomes an issue
        uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget, cameraManager)
    }
  })
  
  uiManager.showLoading(false);
})()