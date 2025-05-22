

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

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. Please check your environment settings.")
    return
  }

  // Initialize managers
  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor()
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

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
  const source = createMediaStreamSource(mediaStream, {
    // Use 'environment' (back) if mobile, 'user' (front/default) otherwise
    cameraType: cameraManager.isMobile ? "environment" : "user",
    disableSourceAudio: false,
  })
  await session.setSource(source)
  // No mirroring needed for the back camera (or default desktop)
  // source.setTransform(Transform2D.MirrorX)
  await source.setRenderSize(window.innerWidth, window.innerHeight)
  await session.setFPSLimit(Settings.camera.fps)
  await session.play()

  // Load and apply lens
  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
  await session.applyLens(lens)

  // Set up event listeners
  uiManager.recordButton.addEventListener("click", async () => {
    if (uiManager.recordPressedCount % 2 === 0) {
      // Use the current camera's constraints for audio recording
      const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.getConstraints())
      if (success) {
        uiManager.updateRecordButtonState(true)
      }
    } else {
      uiManager.updateRecordButtonState(false)
      uiManager.toggleRecordButton(false)
      mediaRecorder.stopRecording()
    }
  })

  // Remove switch button event listener as the button is removed

  // Add back button handler
  document.getElementById("back-button").addEventListener("click", async () => {
    try {
      mediaRecorder.resetRecordingVariables()
      // Need to ensure the UI state resets correctly without switch button logic
      uiManager.actionButton.style.display = "none"
      uiManager.backButtonContainer.style.display = "none"
      uiManager.toggleRecordButton(true)
      // Re-apply render size in case the window was resized while showing results
      uiManager.updateRenderSize(source, liveRenderTarget)
    } catch (error) {
      console.error("Error resetting after recording:", error)
    }
  })

  // Add window resize listener
  window.addEventListener("resize", () => uiManager.updateRenderSize(source, liveRenderTarget))

  // Update initial render size
  uiManager.updateRenderSize(source, liveRenderTarget)
})()