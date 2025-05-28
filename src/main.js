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

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. Please check your environment settings.")
    // Display error to user in a more friendly way if possible
    const loadingElement = document.getElementById("loading")
    if (loadingElement) loadingElement.innerHTML = "Configuration error. Please check console."
    return
  }

  // Initialize managers
  const cameraManager = new CameraManager()
  const uiManager = new UIManager() // UIManager dependencies will be set later if needed, or passed to methods
  const videoProcessor = new VideoProcessor()
  // Pass cameraManager to MediaRecorderManager constructor
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager, cameraManager)


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
})()