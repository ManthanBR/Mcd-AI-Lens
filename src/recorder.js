import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    // this.audioVideoStream = null // No longer needed if using camera's main stream
    this.canvasStream = null
    this.audioTrackFromCamera = null // To keep a reference if needed for cleanup
  }

  async startRecording(liveRenderTarget, cameraMediaStream) {
    try {
      if (!cameraMediaStream) {
        console.error("Camera media stream is not available for recording.")
        return false
      }

      const audioTracks = cameraMediaStream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.warn("No audio track found in the provided camera stream. Recording without audio.")
        // Optionally, you could try a fallback to a new getUserMedia for audio only:
        // const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // this.audioTrackFromCamera = audioStream.getAudioTracks()[0];
        // But this adds complexity and another permission prompt.
        // For now, proceed without audio or throw an error if audio is mandatory.
        this.audioTrackFromCamera = null;
      } else {
        this.audioTrackFromCamera = audioTracks[0]
      }
      
      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      
      if (this.audioTrackFromCamera) {
        // Ensure the track is not already added or stopped
        if (this.audioTrackFromCamera.readyState === 'live') {
            this.canvasStream.addTrack(this.audioTrackFromCamera.clone()); // Clone to avoid issues if original is stopped
        } else {
            console.warn("Audio track from camera is not live. Recording may not have audio.");
        }
      }


      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
        // Consider adding videoBitsPerSecond and audioBitsPerSecond for quality control
        // videoBitsPerSecond: 2500000, // Example: 2.5 Mbps
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        // console.log("Data available for MediaRecorder") // Less verbose log
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder stopped")
        this.uiManager.showLoading(true)
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })
        
        // Clean up streams and tracks associated with this recording instance
        this.cleanupStreamsAfterRecording();

        try {
            const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
            const url = URL.createObjectURL(fixedBlob)
            this.uiManager.showLoading(false)
            this.uiManager.displayPostRecordButtons(url, fixedBlob)
        } catch (error) {
            console.error("Error processing video:", error);
            this.uiManager.showLoading(false);
            // Inform user about processing error
            alert("Error processing video. Please try again.");
            this.uiManager.toggleRecordButton(true); // Show record button again
            this.uiManager.updateRecordButtonState(false); // Reset record button state
        }
      }

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        this.uiManager.showLoading(false);
        alert(`Recording error: ${event.error.name}. Please try again.`);
        this.cleanupStreamsAfterRecording();
        this.uiManager.toggleRecordButton(true);
        this.uiManager.updateRecordButtonState(false);
      };

      this.mediaRecorder.start()
      console.log("MediaRecorder started")
      return true
    } catch (error) {
      console.error("Error starting recording:", error)
      this.uiManager.showLoading(false) // Ensure loading is hidden on error
      this.cleanupStreamsAfterRecording();
      return false
    }
  }

  cleanupStreamsAfterRecording() {
    // Stop only the tracks that MediaRecorderManager exclusively owns or cloned.
    // The original camera audio track (this.audioTrackFromCamera) should not be stopped here
    // if it's the main camera audio track, as it's managed by CameraManager.
    // However, if we cloned it, the clone added to canvasStream will be stopped.
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.canvasStream = null
    }
    // If this.audioTrackFromCamera was from a separate getUserMedia call (fallback), stop it.
    // But in the current design, it's a reference/clone from the main camera stream.
    this.audioTrackFromCamera = null; // Clear the reference
  }


  resetRecordingVariables() {
    // This method is called by the back button after recording.
    // It should ensure that any resources held by the recorder are released
    // without interfering with the live camera view.
    this.mediaRecorder = null
    this.recordedChunks = []
    
    this.cleanupStreamsAfterRecording(); // Use the same cleanup logic

    // Revoke any object URLs created for download/share if they are stored in the class
    // (Currently, `url` is local to `onstop` and `displayPostRecordButtons`)
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
      // onstop will handle further cleanup and UI updates
    } else {
        // If somehow stopRecording is called when not active, ensure UI is reasonable
        console.warn("stopRecording called but MediaRecorder was not active or doesn't exist.");
        this.uiManager.toggleRecordButton(true); // Make sure record button is visible
        this.uiManager.updateRecordButtonState(false); // Reset its state
    }
  }
}