// main.js
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
    // You might want to display this error to the user as well
    document.body.innerHTML = "<p style='color:red; text-align:center; margin-top: 50px;'>Configuration Error: Missing API Token, Lens ID, or Group ID. Please check setup.</p>";
    return
  }

  // Initialize managers
  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor()
  // Pass uiManager instance to MediaRecorderManager for UI updates from recorder logic
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

  // Keep track of the current Camera Kit source
  let currentCameraKitSource = null; // Will be initialized after camera
  const liveRenderTarget = document.getElementById("canvas")

  // Set dependencies for UIManager
  uiManager.setDependencies(
    mediaRecorder,
    () => currentCameraKitSource, // Function to get the current source
    liveRenderTarget
  )

  try {
    uiManager.showLoading(true); // Show loading while initializing

    // Initialize Camera Kit
    const cameraKit = await bootstrapCameraKit({
      apiToken: apiToken,
    })

    // Create camera kit session
    const session = await cameraKit.createSession({ liveRenderTarget })

    // Initialize camera and set up source
    const mediaStream = await cameraManager.initializeCamera()
    currentCameraKitSource = createMediaStreamSource(mediaStream, {
      cameraType: cameraManager.isBackFacing ? "environment" : "user",
      disableSourceAudio: false, // Keep source audio for CameraKit, MediaRecorder uses its own
    })
    await session.setSource(currentCameraKitSource)
    if (!cameraManager.isBackFacing) {
      currentCameraKitSource.setTransform(Transform2D.MirrorX)
    }
    await currentCameraKitSource.setRenderSize(window.innerWidth, window.innerHeight)
    await session.setFPSLimit(Settings.camera.fps)
    await session.play()

    // Load and apply lens
    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
    await session.applyLens(lens)

    // Update initial render size
    uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget)
    uiManager.showLoading(false); // Hide loading after initialization

    // Set up event listeners
    uiManager.recordButton.addEventListener("click", async () => {
      if (uiManager.recordPressedCount % 2 === 0) { // Is even, so start recording
        console.log("Record button pressed - starting recording.");
        const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.getConstraints())
        if (success) {
          uiManager.updateRecordButtonState(true) // Show stop icon, increment count
        } else {
          console.error("Failed to initiate recording from main.js.");
          // uiManager.showLoading(false); // Already handled in recorder.js potentially
          uiManager.updateRecordButtonState(false); // Revert to record icon
          uiManager.toggleRecordButton(true); // Ensure button is visible
          // alert("Could not start recording. Please check permissions or try again.");
        }
      } else { // Is odd, so stop recording
        console.log("Record button pressed - stopping recording.");
        // uiManager.updateRecordButtonState(false) // State update is now handled by onstop or directly
        uiManager.toggleRecordButton(false) // Hide record button, loading/post-record UI will appear
        mediaRecorder.stopRecording()
      }
    })

    uiManager.switchButton.addEventListener("click", async () => {
      // Prevent switching if recording is in progress or post-record UI is shown
      if (uiManager.recordPressedCount % 2 !== 0 || uiManager.actionButton.style.display === "block") {
        console.warn("Camera switch attempted while recording or in post-record state.");
        return;
      }
      uiManager.showLoading(true);
      try {
        const newSource = await cameraManager.updateCamera(session)
        currentCameraKitSource = newSource // Update the reference
        uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget)
      } catch (error) {
        console.error("Error switching camera:", error)
        // alert("Error switching camera. Please try again.");
      } finally {
        uiManager.showLoading(false);
      }
    })

    // The back button listener previously here is now handled within UIManager.displayPostRecordButtons

    // Add window resize listener
    window.addEventListener("resize", () => {
        if (currentCameraKitSource) {
            uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget)
        }
    })

  } catch (error) {
    console.error("Critical error during initialization:", error);
    uiManager.showLoading(false);
    document.body.innerHTML = `<p style='color:red; text-align:center; margin-top: 50px;'>An error occurred: ${error.message}. Please refresh the page or check the console.</p>`;
  }
})()