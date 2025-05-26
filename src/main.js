import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import "./styles/index.v3.css"
import { CameraManager } from "./camera"
import { MediaRecorderManager } from "./recorder"
import { UIManager } from "./ui"
import { VideoProcessor } from "./videoProcessor"
import { Settings } from "./settings"

;(async function () {
  const apiToken = process.env.API_TOKEN
  const lensID = process.env.LENS_ID
  const groupID = process.env.GROUP_ID

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. Please check your environment settings.")
    return
  }

  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor()
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

  const cameraKit = await bootstrapCameraKit({ apiToken })
  const liveRenderTarget = document.getElementById("canvas")
  const session = await cameraKit.createSession({ liveRenderTarget })

  const mediaStream = await cameraManager.initializeCamera()
  const source = createMediaStreamSource(mediaStream, {
    cameraType: cameraManager.isBackFacing ? "environment" : "user",
    disableSourceAudio: false,
  })

  await session.setSource(source)
  if (!cameraManager.isBackFacing) {
    source.setTransform(Transform2D.MirrorX)
  }
  await source.setRenderSize(window.innerWidth, window.innerHeight)
  await session.setFPSLimit(Settings.camera.fps)
  await session.play()

  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
  await session.applyLens(lens)

  // Gesture-based control (tap to photo, long-press to record)
  let longPressTimer = null
  let isLongPress = false

  uiManager.recordButton.addEventListener("touchstart", () => {
    isLongPress = false
    longPressTimer = setTimeout(async () => {
      isLongPress = true
      const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.getConstraints())
      if (success) {
        uiManager.updateRecordButtonState(true)
      }
    }, 500)
  })

  uiManager.recordButton.addEventListener("touchend", () => {
    clearTimeout(longPressTimer)
    if (!isLongPress) {
      takePhotoFromCanvas(liveRenderTarget, uiManager)
    } else {
      uiManager.updateRecordButtonState(false)
      uiManager.toggleRecordButton(false)
      mediaRecorder.stopRecording()
    }
  })

  uiManager.recordButton.addEventListener("touchcancel", () => {
    clearTimeout(longPressTimer)
  })

  // Camera switch
  uiManager.switchButton.addEventListener("click", async () => {
    try {
      const source = await cameraManager.updateCamera(session)
      uiManager.updateRenderSize(source, liveRenderTarget)
    } catch (error) {
      console.error("Error switching camera:", error)
    }
  })

  document.getElementById("back-button").addEventListener("click", async () => {
    try {
      mediaRecorder.resetRecordingVariables()
      uiManager.updateRenderSize(source, liveRenderTarget)
    } catch (error) {
      console.error("Error resetting camera:", error)
    }
  })

  window.addEventListener("resize", () => uiManager.updateRenderSize(source, liveRenderTarget))
  uiManager.updateRenderSize(source, liveRenderTarget)
})()

function takePhotoFromCanvas(canvas, uiManager) {
  try {
    const imageDataURL = canvas.toDataURL("image/png")
    uiManager.flashEffect()
    if (navigator.vibrate) navigator.vibrate(50)
    uiManager.showPhotoPreview(imageDataURL)

    uiManager.sharePhotoButton.onclick = async () => {
      try {
        const blob = await (await fetch(imageDataURL)).blob()
        const file = new File([blob], "photo.png", { type: "image/png" })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Captured Photo",
            text: "Check out this photo!",
          })
        } else {
          alert("Sharing is not supported on this device.")
        }
      } catch (err) {
        console.error("Photo sharing failed:", err)
      }
    }

    uiManager.closePreviewButton.onclick = () => {
      uiManager.hidePhotoPreview()
    }
  } catch (err) {
    console.error("Failed to take photo:", err)
  }
}
