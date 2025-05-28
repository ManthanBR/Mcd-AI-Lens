// ui.js
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
      // URL.revokeObjectURL(url); // Consider revoking later or if share isn't used
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
      if (cameraManager) {
        const liveRenderTarget = document.getElementById("canvas")
        const currentSource = cameraManager.getSource()
        if (currentSource && liveRenderTarget) {
          // Pass cameraManager to updateRenderSize
          this.updateRenderSize(currentSource, liveRenderTarget, cameraManager)
        }
      }
       if(url) URL.revokeObjectURL(url);
    }
  }

  updateRenderSize(source, liveRenderTarget, cameraManager) {
    if (!source || !liveRenderTarget || !cameraManager) {
        console.warn("updateRenderSize: Missing source, liveRenderTarget, or cameraManager.");
        return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const streamDim = cameraManager.getStreamDimensions();
    const streamWidth = streamDim.width;
    const streamHeight = streamDim.height;

    if (streamWidth === 0 || streamHeight === 0) {
        console.error("Stream dimensions are zero. Canvas sizing might be incorrect.");
        // Fallback to prevent division by zero or incorrect aspect ratio
        // This part might need adjustment based on how often stream dimensions are zero
        // For now, if they are zero, we'll just make canvas fill screen, which might stretch
        liveRenderTarget.width = viewportWidth;
        liveRenderTarget.height = viewportHeight;
        liveRenderTarget.style.width = `${viewportWidth}px`;
        liveRenderTarget.style.height = `${viewportHeight}px`;
        liveRenderTarget.style.top = '0px';
        liveRenderTarget.style.left = '0px';
        source.setRenderSize(viewportWidth, viewportHeight);
        return;
    }

    const streamAspectRatio = streamWidth / streamHeight;
    const viewportAspectRatio = viewportWidth / viewportHeight;

    let displayWidth;
    let displayHeight;

    if (streamAspectRatio > viewportAspectRatio) {
      // Stream is wider than viewport (letterbox)
      displayWidth = viewportWidth;
      displayHeight = viewportWidth / streamAspectRatio;
    } else {
      // Stream is taller or same aspect as viewport (pillarbox)
      displayHeight = viewportHeight;
      displayWidth = viewportHeight * streamAspectRatio;
    }

    // Set canvas drawing buffer size to actual stream dimensions
    liveRenderTarget.width = streamWidth;
    liveRenderTarget.height = streamHeight;

    // Set canvas CSS display size to fit viewport while maintaining aspect ratio
    liveRenderTarget.style.width = `${displayWidth}px`;
    liveRenderTarget.style.height = `${displayHeight}px`;

    // Center the canvas
    liveRenderTarget.style.position = 'absolute';
    liveRenderTarget.style.top = `${(viewportHeight - displayHeight) / 2}px`;
    liveRenderTarget.style.left = `${(viewportWidth - displayWidth) / 2}px`;

    // Tell Camera Kit source to render at the buffer's dimensions
    source.setRenderSize(streamWidth, streamHeight);
    
    console.log(`Viewport: ${viewportWidth}x${viewportHeight} (AR: ${viewportAspectRatio.toFixed(2)})`);
    console.log(`Stream: ${streamWidth}x${streamHeight} (AR: ${streamAspectRatio.toFixed(2)})`);
    console.log(`Canvas Buffer: ${liveRenderTarget.width}x${liveRenderTarget.height}`);
    console.log(`Canvas Display: ${displayWidth.toFixed(2)}x${displayHeight.toFixed(2)}, Top: ${liveRenderTarget.style.top}, Left: ${liveRenderTarget.style.left}`);
  }
}