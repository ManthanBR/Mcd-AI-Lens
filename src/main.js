/**
 * Camera Kit Web Demo with Recording Feature
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA
 */

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import "./styles/index.v3.css" // Make sure this path is correct
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
    const loadingElement = document.getElementById("loading")
    if (loadingElement) {
        loadingElement.innerHTML = "Configuration error. Please check console."
        loadingElement.style.display = "flex"; // Make sure it's visible
        loadingElement.style.color = "red";
        loadingElement.style.textAlign = "center";
        loadingElement.style.padding = "20px";
    }
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

  // Create camera kit session
  const session = await cameraKit.createSession({ liveRenderTarget })

  // Initialize camera and set up source
  const mediaStream = await cameraManager.initializeCamera()
  const initialSource = createMediaStreamSource(mediaStream, {
    cameraType: cameraManager.isBackFacing ? "environment" : "user",
    disableSourceAudio: false,
  })
  cameraManager.currentSource = initialSource
  await session.setSource(initialSource)

  if (!cameraManager.isBackFacing) {
    initialSource.setTransform(Transform2D.MirrorX)
  }
  
  // Set initial render size for the source (as per original logic)
  await initialSource.setRenderSize(window.innerWidth, window.innerHeight); 

  await session.setFPSLimit(Settings.camera.fps)
  await session.play()

  // Load and apply lens
  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
  await session.applyLens(lens)

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
      const newSource = await cameraManager.updateCamera(session)
      // Call updateRenderSize AFTER the new source is set and played by updateCamera
      // and ensure the newSource is passed to updateRenderSize.
      // updateCamera should set cameraManager.currentSource = newSource
      uiManager.updateRenderSize(newSource, liveRenderTarget) // Pass the new source

      if (mediaRecorder.isRecording()) {
        mediaRecorder.switchCameraAudio(cameraManager.mediaStream)
      }
    } catch (error) {
      console.error("Error switching camera:", error)
    }
  })

  // Add window resize listener
  window.addEventListener("resize", () => uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget))

  // Update initial render size using UIManager (this will set styles)
  uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget)
  uiManager.showLoading(false); // Hide loading icon once everything is ready
})()