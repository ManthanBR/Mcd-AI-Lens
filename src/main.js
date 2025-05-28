// main.js
// ... (imports and initial setup)
;(async function () {
  // ... (env variables)

  const cameraManager = new CameraManager()
  const uiManager = new UIManager()
  const videoProcessor = new VideoProcessor()
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager, cameraManager)

  // ... (Camera Kit bootstrap, session creation)

  const liveRenderTarget = document.getElementById("canvas")
  // Add a background color to the canvas via CSS or JS to see letterboxing/pillarboxing
  liveRenderTarget.style.backgroundColor = 'black';


  const mediaStream = await cameraManager.initializeCamera() // This now sets stream dimensions in cameraManager
  const initialSource = createMediaStreamSource(mediaStream, {
    cameraType: cameraManager.isBackFacing ? "environment" : "user",
    disableSourceAudio: false,
  })
  cameraManager.currentSource = initialSource
  await session.setSource(initialSource)

  if (!cameraManager.isBackFacing) {
    initialSource.setTransform(Transform2D.MirrorX)
  }
  await session.setFPSLimit(Settings.camera.fps)
  await session.play()

  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
  await session.applyLens(lens)

  // Initial render size update
  // Make sure cameraManager.getSource() is valid and stream dimensions are set
  if (cameraManager.getSource()) {
    uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget, cameraManager)
  } else {
    console.error("Initial source not available for first render size update.");
  }


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
      // Pass cameraManager to updateRenderSize
      uiManager.updateRenderSize(newSource, liveRenderTarget, cameraManager)

      if (mediaRecorder.isRecording()) {
        mediaRecorder.switchCameraAudio(cameraManager.mediaStream)
      }
    } catch (error) {
      console.error("Error switching camera:", error)
    }
  })

  window.addEventListener("resize", () => {
    if (cameraManager.getSource()) {
      uiManager.updateRenderSize(cameraManager.getSource(), liveRenderTarget, cameraManager)
    }
  })

  uiManager.showLoading(false);
})()