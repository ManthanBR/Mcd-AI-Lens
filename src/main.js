/**
 * Camera Kit Web Demo with Recording Feature
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA
 */

import { bootstrapCameraKit, Transform2D } from "@snap/camera-kit" // createMediaStreamSource removed as CameraManager handles it
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
    uiManager.showLoading(false) // Hide loading if env vars are missing
    // Optionally display an error message to the user
    const loadingElement = document.getElementById("loading")
    if (loadingElement) {
        loadingElement.innerHTML = "<p style='color:red; text-align:center;'>Configuration Error. Check console.</p>"
        loadingElement.style.display = "block"
    }
    return
  }

  // Initialize managers
  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor()
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

  uiManager.showLoading(true) // Show loading early

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
    // CameraManager.initializeCamera now returns an object with mediaStream and source
    const { source: initialSource } = await cameraManager.initializeCamera(session)
    let currentSource = initialSource // Use let to allow reassignment

    // SetRenderSize and FPSLimit are now called on the source from CameraManager
    await currentSource.setRenderSize(window.innerWidth, window.innerHeight)
    await session.setFPSLimit(Settings.camera.fps)
    await session.play()

    // Load and apply lens
    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
    await session.applyLens(lens)

    uiManager.showLoading(false) // Hide loading after setup

    // Set up event listeners
    uiManager.recordButton.addEventListener("click", async () => {
      if (uiManager.recordPressedCount % 2 === 0) {
        const cameraMediaStream = cameraManager.getCurrentMediaStream()
        if (!cameraMediaStream) {
            console.error("Cannot start recording, camera stream is not available.");
            // Optionally, provide user feedback
            return;
        }
        const success = await mediaRecorder.startRecording(liveRenderTarget, cameraMediaStream)
        if (success) {
          uiManager.updateRecordButtonState(true)
        }
      } else {
        uiManager.updateRecordButtonState(false)
        uiManager.toggleRecordButton(false) // Hide record button while processing
        mediaRecorder.stopRecording()
      }
    })

    uiManager.switchButton.addEventListener("click", async () => {
      uiManager.showLoading(true)
      try {
        const newSource = await cameraManager.updateCamera(session)
        currentSource = newSource // Update the currentSource reference
        await currentSource.setRenderSize(window.innerWidth, window.innerHeight) // Ensure new source has correct size
        await session.play() // Ensure session is playing after source update
        uiManager.updateRenderSize(currentSource, liveRenderTarget) // This might be redundant if setRenderSize on source is enough
      } catch (error) {
        console.error("Error switching camera:", error)
        // Optionally inform the user about the error
      } finally {
        uiManager.showLoading(false)
      }
    })

    // The "back-button" click handler is now primarily managed within UIManager.displayPostRecordButtons
    // The one here can be removed if UIManager's handler covers all desired "back" functionality.
    // If there's a specific scenario for this back button *before* recording, it might be kept,
    // but ensure it doesn't conflict with the one in UIManager.
    // For now, assuming UIManager handles it post-recording.

    // Add window resize listener
    window.addEventListener("resize", () => {
        if (currentSource) { // Check if currentSource is valid
            uiManager.updateRenderSize(currentSource, liveRenderTarget)
        }
    })

    // Update initial render size (already done by setRenderSize above)
    // uiManager.updateRenderSize(currentSource, liveRenderTarget) // This is okay as a final check

  } catch (error) {
    console.error("Failed to initialize Camera Kit or camera:", error)
    uiManager.showLoading(false)
    const loadingElement = document.getElementById("loading")
    if (loadingElement) {
        loadingElement.innerHTML = `<p style='color:red; text-align:center;'>Initialization Error: ${error.message}. Please try refreshing.</p>`
        loadingElement.style.display = "block"
    }
    // Disable UI elements that depend on successful initialization
    if(uiManager.recordButton) uiManager.recordButton.disabled = true;
    if(uiManager.switchButton) uiManager.switchButton.disabled = true;
  }
})()