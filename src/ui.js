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
      // Consider revoking URL later, e.g. on back button or after a timeout
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
      // Re-apply render size for the live view
      if (cameraManager) {
        const liveRenderTarget = document.getElementById("canvas")
        const currentSource = cameraManager.getSource()
        if (currentSource && liveRenderTarget) {
          this.updateRenderSize(currentSource, liveRenderTarget) // This will re-apply 1080x1920 logic
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

    const targetWidth = Settings.camera.targetResolution.width;
    const targetHeight = Settings.camera.targetResolution.height;

    // Set the canvas drawing buffer size to the target recording resolution
    liveRenderTarget.width = targetWidth;
    liveRenderTarget.height = targetHeight;

    // Set the canvas CSS display size to fill the viewport.
    // The browser will scale the targetWidth x targetHeight content
    // according to the #canvas CSS (e.g., object-fit: contain).
    liveRenderTarget.style.width = "100vw";
    liveRenderTarget.style.height = "100vh";
    
    // Inform CameraKit source about the render target size.
    // This is the resolution CameraKit will render its effects at.
    source.setRenderSize(targetWidth, targetHeight);
    console.log(`Canvas buffer set to ${targetWidth}x${targetHeight}. CSS display size 100vw x 100vh. Source render size set.`);
  }
}