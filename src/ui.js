import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.actionButton = document.getElementById("action-buttons")
    this.switchButton = document.getElementById("switch-button")
    this.loadingIcon = document.getElementById("loading")
    this.backButtonContainer = document.getElementById("back-button-container")
    this.recordPressedCount = 0
  }

  toggleRecordButton(isVisible) {
    if (isVisible) {
      this.recordOutline.style.display = "block"
      this.recordButton.style.display = "block"
    } else {
      this.recordOutline.style.display = "none"
      this.recordButton.style.display = "none"
    }
  }

  updateRecordButtonState(isRecording) {
    this.recordButton.style.backgroundImage = isRecording ? `url('${Settings.ui.recordButton.stopImage}')` : `url('${Settings.ui.recordButton.startImage}')`
    if (!isRecording && this.recordPressedCount % 2 !== 0) { 
        this.recordPressedCount++; 
    } else if (isRecording && this.recordPressedCount % 2 === 0) { 
        this.recordPressedCount++;
    }
  }


  showLoading(show) {
    this.loadingIcon.style.display = show ? "flex" : "none" 
  }

  displayPostRecordButtons(url, fixedBlob, mediaRecorder, cameraManager) { 
    this.actionButton.style.display = "flex" 
    this.backButtonContainer.style.display = "block"
    this.switchButton.style.display = "none"
    this.toggleRecordButton(false) 

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      document.body.appendChild(a) 
      a.click()
      document.body.removeChild(a) 
      // URL.revokeObjectURL(url); // Consider revoking later or if share not used
    }

    document.getElementById("share-button").onclick = async () => {
      try {
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recorded Video",
            text: "Check out this recording!",
          })
          console.log("File shared successfully")
        } else {
          alert("Sharing files is not supported on this browser/device. Please download the video.")
          console.warn("navigator.canShare({ files: [file] }) returned false.")
        }
      } catch (error) {
        console.error("Error while sharing:", error)
        alert(`Error sharing file: ${error.message}`)
      }
    }

    document.getElementById("back-button").onclick = async () => {
      this.actionButton.style.display = "none"
      this.backButtonContainer.style.display = "none"
      this.switchButton.style.display = "block"
      this.toggleRecordButton(true)
      this.recordPressedCount = 0; 

      if (mediaRecorder) {
        mediaRecorder.resetRecordingVariables() 
      }
      // When going back, ensure the render size is updated correctly for the live preview
      if (cameraManager) {
        const liveRenderTarget = document.getElementById("canvas")
        const currentSource = cameraManager.getSource()
        if (currentSource && liveRenderTarget) {
          this.updateRenderSize(currentSource, liveRenderTarget)
        }
      }
       if(url) URL.revokeObjectURL(url); 
    }
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!source || !liveRenderTarget) {
        console.warn("updateRenderSize called with invalid source or liveRenderTarget.");
        return;
    }

    const targetCanvasWidth = 1080;
    const targetCanvasHeight = 1920;
    const targetAspectRatio = targetCanvasWidth / targetCanvasHeight; // Should be 9/16

    // Set the Camera Kit source render size. This tells Camera Kit
    // what resolution to render at internally.
    source.setRenderSize(targetCanvasWidth, targetCanvasHeight);

    // DO NOT set liveRenderTarget.width and liveRenderTarget.height directly
    // if control has been transferred (e.g., to an OffscreenCanvas by Camera Kit).
    // Doing so will cause the "Cannot resize canvas after call to transferControlToOffscreen()" error.
    // The source.setRenderSize() call above should handle the internal bitmap size.
    // liveRenderTarget.width = targetCanvasWidth; // REMOVE THIS
    // liveRenderTarget.height = targetCanvasHeight; // REMOVE THIS

    // Calculate the display size for the canvas element to fit the screen while maintaining aspect ratio
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspectRatio = windowWidth / windowHeight;

    let displayWidth;
    let displayHeight;

    if (windowAspectRatio > targetAspectRatio) {
      // Window is wider than target aspect ratio (e.g., landscape screen for portrait video)
      // Fit to height, width will be less than window width (letterbox sides)
      displayHeight = windowHeight;
      displayWidth = displayHeight * targetAspectRatio;
    } else {
      // Window is taller than or same as target aspect ratio (e.g., portrait screen for portrait video)
      // Fit to width, height will be less than window height (letterbox top/bottom)
      displayWidth = windowWidth;
      displayHeight = displayWidth / targetAspectRatio;
    }

    // Apply the calculated display size to the canvas style
    // This controls how the canvas is displayed on the page, not its internal rendering resolution.
    liveRenderTarget.style.width = `${displayWidth}px`;
    liveRenderTarget.style.height = `${displayHeight}px`;

    // Center the canvas on the screen
    liveRenderTarget.style.position = 'absolute'; // Ensure positioning context
    liveRenderTarget.style.left = `${(windowWidth - displayWidth) / 2}px`;
    liveRenderTarget.style.top = `${(windowHeight - displayHeight) / 2}px`;
  }
}