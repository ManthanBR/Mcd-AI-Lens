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
    this.loadingIcon.style.display = show ? "flex" : "none";
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
      // URL.revokeObjectURL(url); // Consider revoking later, e.g., in back button or after share
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
      // Re-calculate and apply render size on back, in case orientation changed etc.
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

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const targetAspectRatio = 9 / 16; // Target W/H ratio

    let newCanvasWidth;
    let newCanvasHeight;

    // Calculate dimensions for 9:16 aspect ratio that fits within the screen
    // This formula prioritizes fitting within the screen dimensions while maintaining 9:16
    if (screenHeight * targetAspectRatio <= screenWidth) {
      // Screen is wide enough (or wider) to fit 9:16 using full screen height
      newCanvasHeight = screenHeight;
      newCanvasWidth = Math.floor(screenHeight * targetAspectRatio);
    } else {
      // Screen is too narrow for full height 9:16, so fit to screen width
      newCanvasWidth = screenWidth;
      newCanvasHeight = Math.floor(screenWidth / targetAspectRatio); // width * (16/9)
    }
    
    // Ensure dimensions are integers
    newCanvasWidth = Math.floor(newCanvasWidth);
    newCanvasHeight = Math.floor(newCanvasHeight);

    // Apply to canvas style for display
    liveRenderTarget.style.width = `${newCanvasWidth}px`;
    liveRenderTarget.style.height = `${newCanvasHeight}px`;

    // Center the canvas on the screen
    liveRenderTarget.style.position = 'absolute'; // Ensure positioning context
    liveRenderTarget.style.left = `${(screenWidth - newCanvasWidth) / 2}px`;
    liveRenderTarget.style.top = `${(screenHeight - newCanvasHeight) / 2}px`;

    // Apply to canvas drawing buffer
    liveRenderTarget.width = newCanvasWidth;
    liveRenderTarget.height = newCanvasHeight;
    
    // Tell Camera Kit to render to these 9:16 dimensions
    source.setRenderSize(newCanvasWidth, newCanvasHeight);
  }
}