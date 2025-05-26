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
    uiManager.showLoading(false) // Hide loading if it was shown
    document.getElementById("loading").innerHTML = "<p>Configuration Error. Please check console.</p>"
    return
  }

  // Initialize managers
  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor()
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

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
    // This mediaStream is for CameraKit's video input.
    // Audio from this stream will be disabled for the CameraKit source.
    const initialMediaStream = await cameraManager.initializeCamera()
    const source = createMediaStreamSource(initialMediaStream, {
      cameraType: cameraManager.isBackFacing ? "environment" : "user",
      // Disable audio from this source, as MediaRecorderManager will handle its own audio stream
      disableSourceAudio: true, 
    })
    await session.setSource(source)
    if (!cameraManager.isBackFacing) {
      source.setTransform(Transform2D.MirrorX)
    }
    await source.setRenderSize(window.innerWidth, window.innerHeight)
    await session.setFPSLimit(Settings.camera.fps)
    await session.play()

    // Load and apply lens
    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
    await session.applyLens(lens)

    uiManager.showLoading(false) // Hide loading icon once lens is applied

    // Set up event listeners
    uiManager.recordButton.addEventListener("click", async () => {
      if (uiManager.recordPressedCount % 2 === 0) { // Corresponds to "not yet recording" or "stopped"
        // Start recording: pass current camera constraints for initial audio
        const audioConstraints = cameraManager.getConstraints() // Gets audio:true and correct facingMode
        const success = await mediaRecorder.startRecording(liveRenderTarget, audioConstraints)
        if (success) {
          uiManager.updateRecordButtonState(true) // Show "stop" icon
        } else {
          // Handle recording start failure (e.g., permissions denied for audio)
          console.error("Failed to start recording.")
          // uiManager.recordPressedCount remains even, so next click is still "start"
        }
      } else { // Corresponds to "is recording"
        uiManager.updateRecordButtonState(false) // Show "start" icon (or will be hidden)
        uiManager.toggleRecordButton(false) // Hide record button immediately
        mediaRecorder.stopRecording() // This will trigger onstop in MediaRecorderManager
      }
    })

    uiManager.switchButton.addEventListener("click", async () => {
      if (mediaRecorder.isRecording() && !confirm("Switching camera will continue recording with the new camera. Proceed?")) {
          console.log("Camera switch cancelled by user during recording.");
          return;
      }
      uiManager.switchButton.disabled = true; // Prevent multiple clicks while switching

      try {
        const wasRecording = mediaRecorder.isRecording()

        // updateCamera in CameraManager stops the old CameraKit mediaStream,
        // gets a new one, and updates session.source.
        // The returned `newCkSource` is CameraKit's new source.
        const newCkSource = await cameraManager.updateCamera(session) // This updates cameraManager.isBackFacing

        if (wasRecording) {
          // Get the audio constraints for the NEW camera orientation
          const newAudioConstraints = cameraManager.getConstraints()
          console.log("Switching audio for MediaRecorder to:", newAudioConstraints.video.facingMode)
          await mediaRecorder.switchAudioSource(newAudioConstraints)
        }

        // Update render size for the new CameraKit source
        uiManager.updateRenderSize(newCkSource, liveRenderTarget)
        // If CameraKit has a specific event for camera switches, you might send it.
        // await session.sendBehaviorEvent("onSwitchCamera"); // Example, if supported/needed
      } catch (error) {
        console.error("Error switching camera:", error)
        // Optionally, handle the error, e.g., by stopping recording if it's critical
        if (mediaRecorder.isRecording()) {
           alert("An error occurred while switching cameras. Recording may be affected.");
        //   mediaRecorder.stopRecording();
        //   uiManager.updateRecordButtonState(false);
        //   uiManager.toggleRecordButton(false); // Or true if you want them to try again
        }
      } finally {
        uiManager.switchButton.disabled = false;
      }
    })

    // Add back button handler (for after recording is done and preview is shown)
    document.getElementById("back-button").addEventListener("click", async () => {
      // This is handled by UIManager's own click handler for UI visibility.
      // We primarily need to ensure recording resources are fully reset.
      mediaRecorder.resetRecordingVariables() // Resets streams and recorder state
      
      // The UIManager's back button handler will make the record button visible again.
      // We also need to ensure the render size is correct for the *current* camera source.
      // 'source' here might be stale if camera was switched. Get current source from session.
      const currentSource = session.getSource();
      if (currentSource) {
        uiManager.updateRenderSize(currentSource, liveRenderTarget)
      } else {
        // Fallback or re-initialize if source is lost, though unlikely here.
        console.warn("Could not get current source from session on back button click.");
      }
    })

    // Add window resize listener
    window.addEventListener("resize", () => {
        const currentSource = session.getSource();
        if (currentSource) {
            uiManager.updateRenderSize(currentSource, liveRenderTarget);
        }
    })

    // Update initial render size
    uiManager.updateRenderSize(source, liveRenderTarget)

  } catch (error) {
    console.error("Fatal error during initialization:", error)
    uiManager.showLoading(false)
    document.getElementById("loading").innerHTML = `<p>Error initializing application: ${error.message}. Please check console.</p>`
  }
})()