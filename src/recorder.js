import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.cameraManager = cameraManager;
    this.canvasStream = null
  }

  async startRecording(liveRenderTarget, cameraManagerInstance) {
    try {
      if (!cameraManagerInstance || !cameraManagerInstance.mediaStream) {
        console.error("CameraManager instance or its mediaStream is not available for recording.")
        this.uiManager.showLoading(false)
        alert("Camera not ready. Cannot start recording.")
        return false
      }

      const audioTracks = cameraManagerInstance.mediaStream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.error("No audio track found in CameraManager's current mediaStream.")
        // Consider if user should be alerted or if recording should proceed without audio
        // For now, let's assume audio is desired.
        this.uiManager.showLoading(false);
        alert("Microphone access is required for recording audio. Please check permissions.");
        return false;
      }
      const audioTrack = audioTracks[0]

      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      this.canvasStream.addTrack(audioTrack.clone())

      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("MediaRecorder data available")
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder stopped")
        this.uiManager.showLoading(true)
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType })
        
        let finalBlob = blob;
        if (this.recordedChunks.length > 0) {
            try {
                const fixedBlob = await this.videoProcessor.fixVideoDuration(blob)
                finalBlob = fixedBlob;
            } catch (ffmpegError) {
                console.error("FFmpeg processing failed:", ffmpegError);
                // Fallback to using the original blob if ffmpeg fails or inform user
                alert("Video processing failed. The raw recording will be used.");
            }
        } else {
            console.warn("No data recorded.");
            this.uiManager.showLoading(false);
            this.uiManager.toggleRecordButton(true);
            this.uiManager.recordPressedCount = 0; // Reset count
            // Potentially inform user that recording was empty
            this.resetRecordingVariables(); // Still reset even if empty
            return;
        }
        
        const url = URL.createObjectURL(finalBlob)
        this.uiManager.showLoading(false)
        this.uiManager.displayPostRecordButtons(url, finalBlob, this, this.cameraManager)
        // resetRecordingVariables() is called within displayPostRecordButtons' back button,
        // or if we navigate away. Consider if it should be called here unconditionally.
        // For now, let post-record UI handle explicit reset.
      }

      this.mediaRecorder.start()
      console.log("Recording started")
      return true
    } catch (error) {
      console.error("Error starting recording:", error)
      this.uiManager.showLoading(false)
      alert(`Could not start recording: ${error.message}. Please ensure permissions are granted.`)
      this.resetRecordingVariables();
      return false
    }
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables");
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
        this.mediaRecorder.stop(); // This will trigger onstop
    }
    this.mediaRecorder = null
    this.recordedChunks = []

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.canvasStream = null
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
      console.log("Recording stopping...")
    } else {
       console.log("Recorder not active or already stopped.");
       // If stop is called when not recording, ensure UI state is consistent
       this.uiManager.updateRecordButtonState(false); // Update button to "start"
       this.uiManager.toggleRecordButton(true);     // Ensure button is visible
       if (this.uiManager.recordPressedCount % 2 !== 0) { // If it was "pressed"
            this.uiManager.recordPressedCount++;
       }
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording"
  }

  switchCameraAudio(newCameraManagerMediaStream) {
    if (!this.isRecording()) {
      console.log("Not recording, no audio switch needed for MediaRecorder.")
      return
    }

    if (!this.canvasStream) {
      console.error("Canvas stream not available for audio track replacement.")
      return
    }
    if (!newCameraManagerMediaStream) {
        console.error("New camera media stream is not available for audio switch.");
        return;
    }

    const newAudioTracks = newCameraManagerMediaStream.getAudioTracks()
    if (newAudioTracks.length === 0) {
      console.warn("New camera stream does not have an audio track. Audio might be lost or silent.")
    }
    const newAudioTrack = newAudioTracks.length > 0 ? newAudioTracks[0] : null

    this.canvasStream.getAudioTracks().forEach(track => {
      console.log("Removing old audio track from canvasStream:", track.label, track.id)
      this.canvasStream.removeTrack(track)
      track.stop()
    })

    if (newAudioTrack) {
      console.log("Adding new audio track to canvasStream:", newAudioTrack.label, newAudioTrack.id)
      this.canvasStream.addTrack(newAudioTrack.clone())
    } else {
      console.warn("No new audio track to add. Recording may continue with no audio on this segment.")
    }
    console.log("Audio track switch attempt for MediaRecorder completed.")
  }
}