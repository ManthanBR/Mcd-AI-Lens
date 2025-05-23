// recorder.js
import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.audioVideoStream = null
    this.canvasStream = null
  }

  resetRecordingVariables() {
    // Stop the MediaRecorder if it's active and prevent its onstop/ondataavailable
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
      this.mediaRecorder.onstop = null; 
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onerror = null;
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn("Error stopping media recorder during reset:", e);
      }
    }
    this.mediaRecorder = null;
    this.recordedChunks = []; // Ensure chunks are cleared

    // Stop all tracks in the audio/video stream
    if (this.audioVideoStream) {
      this.audioVideoStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.audioVideoStream = null;
    }

    // Stop all tracks in the canvas stream
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.canvasStream = null;
    }
  }

  async startRecording(liveRenderTarget, constraints) {
    // **** CRITICAL CHANGE: Reset variables at the start of every recording attempt ****
    this.resetRecordingVariables();

    try {
      this.audioVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = this.audioVideoStream.getAudioTracks()[0];

      if (!audioTrack) {
        console.error("Failed to get audio track for recording.");
        return false;
      }
      console.log('Audio track for recording:', audioTrack.label, 'id:', audioTrack.id, 'readyState:', audioTrack.readyState);


      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps);
      this.canvasStream.addTrack(audioTrack);

      // Verify stream health
      if (this.canvasStream.getTracks().length === 0 || 
          this.canvasStream.getVideoTracks().length === 0 ||
          this.canvasStream.getAudioTracks().length === 0) {
        console.error("MediaStream for MediaRecorder is invalid or missing tracks.");
        // Clean up tracks acquired in this failed attempt
        this.audioVideoStream.getTracks().forEach(track => track.stop());
        this.audioVideoStream = null;
        this.canvasStream.getTracks().forEach(track => track.stop()); // Should be empty or already stopped
        this.canvasStream = null;
        return false;
      }
      this.canvasStream.getTracks().forEach(t => {
        console.log('CanvasStream track for MediaRecorder:', t.kind, t.label, 'id:', t.id, 'readyState:', t.readyState);
      });


      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
      });
      // this.recordedChunks = []; // Already done by resetRecordingVariables

      this.mediaRecorder.onstart = () => {
        console.log('MediaRecorder started successfully.');
      };
      
      this.mediaRecorder.ondataavailable = (event) => {
        console.log("MediaRecorder.ondataavailable, data size:", event.data.size);
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder.onstop called. Recorded chunks:", this.recordedChunks.length);
        if (this.recordedChunks.length === 0) {
            console.warn("No data recorded.");
            this.uiManager.showLoading(false);
            // Potentially show an error to the user that recording failed
            // And reset UI to pre-recording state
            this.uiManager.updateRecordButtonState(false); // Show record icon
            this.uiManager.toggleRecordButton(true); // Show record button
            this.uiManager.actionButton.style.display = "none";
            this.uiManager.backButtonContainer.style.display = "none";
            this.uiManager.switchButton.style.display = "block";
            return;
        }
        this.uiManager.showLoading(true);
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType });
        try {
            const fixedBlob = await this.videoProcessor.fixVideoDuration(blob);
            const url = URL.createObjectURL(fixedBlob);
            this.uiManager.showLoading(false);
            this.uiManager.displayPostRecordButtons(url, fixedBlob);
        } catch (processingError) {
            console.error("Error processing video:", processingError);
            this.uiManager.showLoading(false);
            // Handle video processing error (e.g., show message to user)
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error || event);
        this.uiManager.showLoading(false);
        // Reset UI to allow another attempt, and ensure variables are clean
        this.resetRecordingVariables(); 
        this.uiManager.updateRecordButtonState(false);
        this.uiManager.toggleRecordButton(true);
      };

      this.mediaRecorder.start();
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      // Clean up any partially acquired resources from this attempt
      this.resetRecordingVariables(); // Ensure clean state after error
      return false;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("Calling mediaRecorder.stop()");
      this.mediaRecorder.stop();
      // Do NOT call resetRecordingVariables() here, as onstop needs to process.
      // Cleanup is handled by the next call to startRecording or explicitly via back button.
    } else {
        console.log("stopRecording called but mediaRecorder not active or doesn't exist. State:", this.mediaRecorder?.state);
    }
  }
}