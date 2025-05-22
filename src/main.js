import {
  bootstrapCameraKit,
  createMediaStreamSource,
  Transform2D,
} from "@snap/camera-kit"
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

  // Initialize initial camera stream
  let mediaStream = await cameraManager.initializeCamera()
  let source = createMediaStreamSource(mediaStream, {
    cameraType: cameraManager.isBackFacing ? "environment" : "user",
    disableSourceAudio: false,
  })

  if (!cameraManager.isBackFacing) {
    source.setTransform(Transform2D.MirrorX)
  }

  await source.setRenderSize(window.innerWidth, window.innerHeight)
  await session.setSource(source)
  await session.setFPSLimit(Settings.camera.fps)
  await session.play()

  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
  await session.applyLens(lens)

  // 🎥 RECORD BUTTON
  uiManager.recordButton.addEventListener("click", async () => {
    if (uiManager.recordPressedCount % 2 === 0) {
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

  // 🔄 SWITCH CAMERA BUTTON
  uiManager.switchButton.addEventListener("click", async () => {
    try {
      const newStream = await cameraManager.updateCamera(session)
      const newSource = createMediaStreamSource(newStream, {
        cameraType: cameraManager.isBackFacing ? "environment" : "user",
        disableSourceAudio: false,
      })

      if (!cameraManager.isBackFacing) {
        newSource.setTransform(Transform2D.MirrorX)
      }

      await session.setSource(newSource)
      await newSource.setRenderSize(window.innerWidth, window.innerHeight)
      mediaRecorder.updateStreamSource(cameraManager.getConstraints())
      uiManager.updateRenderSize(newSource, liveRenderTarget)
    } catch (error) {
      console.error("Error switching camera:", error)
    }
  })

  // 🔙 BACK BUTTON
  document.getElementById("back-button").addEventListener("click", async () => {
    try {
      mediaRecorder.resetRecordingVariables()

      mediaStream = await cameraManager.initializeCamera()
      source = createMediaStreamSource(mediaStream, {
        cameraType: cameraManager.isBackFacing ? "environment" : "user",
        disableSourceAudio: false,
      })

      if (!cameraManager.isBackFacing) {
        source.setTransform(Transform2D.MirrorX)
      }

      await session.setSource(source)
      await source.setRenderSize(window.innerWidth, window.innerHeight)

      mediaRecorder.updateStreamSource(cameraManager.getConstraints())
      uiManager.updateRenderSize(source, liveRenderTarget)
    } catch (error) {
      console.error("Error resetting camera:", error)
    }
  })

  // 🔄 WINDOW RESIZE
  window.addEventListener("resize", () => {
    uiManager.updateRenderSize(source, liveRenderTarget)
  })

  // Initial canvas sizing
  uiManager.updateRenderSize(source, liveRenderTarget)
})()
