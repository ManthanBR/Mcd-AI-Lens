// main.js
// ... imports ...
;(async function () {
  // ... env variable checks ...

  // Initialize managers
  const uiManager = new UIManager(); // Will pass dependencies later if refactoring
  const cameraManager = new CameraManager();
  const videoProcessor = new VideoProcessor();
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager);

  // Pass mediaRecorder to uiManager if it needs to call resetRecordingVariables
  // This is part of the refactor mentioned above, for now, we focus on the recording bug fix.
  // uiManager.setMediaRecorder(mediaRecorder); // Example of setting dependency

  // ... Camera Kit initialization ...
  const cameraKit = await bootstrapCameraKit({ apiToken });
  const liveRenderTarget = document.getElementById("canvas");
  const session = await cameraKit.createSession({ liveRenderTarget });
  const mediaStream = await cameraManager.initializeCamera();
  
  // Keep track of the current CameraKit source
  let currentCameraKitSource = createMediaStreamSource(mediaStream, {
    cameraType: cameraManager.isBackFacing ? "environment" : "user",
    disableSourceAudio: false,
  });
  await session.setSource(currentCameraKitSource);
  if (!cameraManager.isBackFacing) {
    currentCameraKitSource.setTransform(Transform2D.MirrorX);
  }
  await currentCameraKitSource.setRenderSize(window.innerWidth, window.innerHeight);
  await session.setFPSLimit(Settings.camera.fps);
  await session.play();

  const lens = await cameraKit.lensRepository.loadLens(lensID, groupID);
  await session.applyLens(lens);

  // Set up event listeners
  uiManager.recordButton.addEventListener("click", async () => {
    if (uiManager.recordPressedCount % 2 === 0) { // Start
      const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.getConstraints());
      if (success) {
        uiManager.updateRecordButtonState(true);
      } else {
        // Optional: alert user or specific UI update for failed start
        console.error("Failed to initiate recording.");
        uiManager.showLoading(false); // Ensure loading is off if startRecording showed it
        uiManager.updateRecordButtonState(false); // Back to record icon
        uiManager.toggleRecordButton(true); // Ensure button is visible
      }
    } else { // Stop
      uiManager.updateRecordButtonState(false);
      uiManager.toggleRecordButton(false); // Typically hides record, shows loading then post-record UI
      mediaRecorder.stopRecording();
    }
  });

  uiManager.switchButton.addEventListener("click", async () => {
    try {
      const newSource = await cameraManager.updateCamera(session);
      currentCameraKitSource = newSource; // Update the reference
      uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget);
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  });

  // Remove or refactor this if UIManager's displayPostRecordButtons handles all back button logic
  // For now, assuming this is still desired for actions *not* covered by UIManager's .onclick
  const backButton = document.getElementById("back-button");
  if (backButton) {
      backButton.addEventListener("click", async () => {
          console.log("Main.js back-button listener fired.");
          // This will fire IN ADDITION to any .onclick set by UIManager if not careful.
          // It's better to consolidate. If UIManager's .onclick should be the sole handler,
          // then mediaRecorder.resetRecordingVariables() and uiManager.updateRenderSize()
          // should be called from within that UIManager .onclick handler.

          // If this listener is intended to remain:
          mediaRecorder.resetRecordingVariables();
          uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget);
      });
  }


  window.addEventListener("resize", () => uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget));
  uiManager.updateRenderSize(currentCameraKitSource, liveRenderTarget);
})();