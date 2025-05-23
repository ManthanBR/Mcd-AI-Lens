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

  let mediaStream = await cameraManager.initializeCamera()
  let source = createMediaStreamSource(mediaStream, {
    cameraType: cameraManager.isBackFacing ? "environment" : "user",
    disableSourceAudio: false,
  })
  await session.setSource(source)
  if (!cameraManager.isBackFacing) source.setTransform(Transform2D.MirrorX)
  await source.setRenderSize(window.innerWidth, window.innerHeight)
  await session.setFPSLimit(Settings.camera.fps)
  await session.play()

  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
  await session.applyLens(lens)

  uiManager.recordButton.addEventListener("click", async () => {
    if (uiManager.recordPressedCount % 2 === 0) {
      const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.mediaStream)
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
      source = await cameraManager.updateCamera(session)
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
