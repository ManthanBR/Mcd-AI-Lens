import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.actionButton = document.getElementById("action-buttons")
    this.switchButton = document.getElementById("switch-button")
    // Use the new ID for the global loading icon
    this.loadingIcon = document.getElementById("loading-global");
    this.backButtonContainer = document.getElementById("back-button-container")
    this.recordPressedCount = 0

    if (!this.loadingIcon) {
        console.warn("UIManager: Global loading icon (#loading-global) not found!");
    }
  }

  toggleRecordButton(isVisible) {
    if (this.recordOutline && this.recordButton) {
        this.recordOutline.style.display = isVisible ? "block" : "none"
        this.recordButton.style.display = isVisible ? "block" : "none"
    }
  }

  updateRecordButtonState(isRecording) {
    if (this.recordButton) {
        this.recordButton.style.backgroundImage = isRecording ? `url('${Settings.ui.recordButton.stopImage}')` : `url('${Settings.ui.recordButton.startImage}')`
        if (!isRecording && this.recordPressedCount % 2 !== 0) {
            this.recordPressedCount++;
        } else if (isRecording && this.recordPressedCount % 2 === 0) {
            this.recordPressedCount++;
        }
    }
  }

  showLoading(show) { // This controls the GLOBAL loading icon
    if (this.loadingIcon) {
      this.loadingIcon.style.display = show ? "flex" : "none"; // Assuming #loading-global is display:flex
    }
  }

  displayPostRecordButtons(url, fixedBlob, mediaRecorder, cameraManager) {
    if (this.actionButton) this.actionButton.style.display = "flex"
    if (this.backButtonContainer) this.backButtonContainer.style.display = "block"
    if (this.switchButton) this.switchButton.style.display = "none"
    this.toggleRecordButton(false)

    const downloadButton = document.getElementById("download-button");
    if (downloadButton) {
        downloadButton.onclick = () => {
          const a = document.createElement("a")
          a.href = url
          a.download = Settings.recording.outputFileName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
    }

    const shareButton = document.getElementById("share-button");
    if (shareButton) {
        shareButton.onclick = async () => {
          try {
            const file = new File([fixedBlob], Settings.recording.outputFileName, {
              type: Settings.recording.mimeType,
            })

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: "RanveerSinghMeal",
                text: "Check out the Ranveer Singh Meal! - made by FilterYou",
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
    }

    const backButton = document.getElementById("back-button");
    if (backButton) {
        backButton.onclick = async () => {
          if (this.actionButton) this.actionButton.style.display = "none"
          if (this.backButtonContainer) this.backButtonContainer.style.display = "none"
          if (this.switchButton) this.switchButton.style.display = "block"
          this.toggleRecordButton(true)
          this.recordPressedCount = 0;

          if (mediaRecorder) {
            mediaRecorder.resetRecordingVariables()
          }
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
  }

  updateRenderSize(source, liveRenderTarget) {
    if (!source || !liveRenderTarget) {
        console.warn("updateRenderSize called with invalid source or liveRenderTarget.");
        return;
    }

    const targetCanvasWidth = 1080;
    const targetCanvasHeight = 1920;
    const targetAspectRatio = targetCanvasWidth / targetCanvasHeight;

    source.setRenderSize(targetCanvasWidth, targetCanvasHeight);

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspectRatio = windowWidth / windowHeight;

    let displayWidth;
    let displayHeight;

    if (windowAspectRatio > targetAspectRatio) {
      displayHeight = windowHeight;
      displayWidth = displayHeight * targetAspectRatio;
    } else {
      displayWidth = windowWidth;
      displayHeight = displayWidth / targetAspectRatio;
    }

    liveRenderTarget.style.width = `${displayWidth}px`;
    liveRenderTarget.style.height = `${displayHeight}px`;
    liveRenderTarget.style.position = 'absolute';
    liveRenderTarget.style.left = `${(windowWidth - displayWidth) / 2}px`;
    liveRenderTarget.style.top = `${(windowHeight - displayHeight) / 2}px`;
  }
}