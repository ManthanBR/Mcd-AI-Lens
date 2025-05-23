// recorder.js
import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager // UIManager instance
    this.audioVideoStream = null
    this.canvasStream = null
  }

  resetRecordingVariables() {
    console.log("Resetting recording variables...");
    // Stop the MediaRecorder if it's active and prevent its onstop/ondataavailable
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
      console.log("Stopping active MediaRecorder during reset. State:", this.mediaRecorder.state);
      // Detach handlers to prevent them from firing after manual stop
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
      console.log("Stopping audioVideoStream tracks.");
      this.audioVideoStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.audioVideoStream = null;
    }

    // Stop all tracks in the canvas stream
    if (this.canvasStream) {
      console.log("Stopping canvasStream tracks.");
      this.canvasStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.canvasStream = null;
    }
    console.log("Recording variables reset complete.");
  }

  async startRecording(liveRenderTarget, constraints) {
    console.log("Attempting to start recording...");
    // **** CRITICAL: Reset variables at the start of every recording attempt ****
    this.resetRecordingVariables();

    try {
      console.log("Requesting user media with constraints:", constraints);
      this.audioVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = this.audioVideoStream.getAudioTracks()[0];

      if (!audioTrack) {
        console.error("Failed to get audio track for recording.");
        this.uiManager.showLoading(false); // Ensure loading is off
        return false;
      }
      console.log('Acquired audio track for recording:', audioTrack.label, 'id:', audioTrack.id, 'readyState:', audioTrack.readyState);

      console.log("Capturing stream from liveRenderTarget.");
      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps);
      this.canvasStream.addTrack(audioTrack);

      // Verify stream health
      if (this.canvasStream.getTracks().length === 0 ||
          this.canvasStream.getVideoTracks().length === 0 ||
          this.canvasStream.getAudioTracks().length === 0) {
        console.error("MediaStream for MediaRecorder is invalid or missing tracks.");
        this.uiManager.showLoading(false);
        // Clean up tracks acquired in this failed attempt
        this.resetRecordingVariables(); // Use the comprehensive reset
        return false;
      }
      this.canvasStream.getTracks().forEach(t => {
        console.log('CanvasStream track for MediaRecorder:', t.kind, t.label, 'id:', t.id, 'readyState:', t.readyState);
      });

      console.log("Creating MediaRecorder instance.");
      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
      });

      this.mediaRecorder.onstart = () => {
        console.log('MediaRecorder started successfully. State:', this.mediaRecorder.state);
      };

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("MediaRecorder.ondataavailable, data size:", event.data.size);
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        } else {
          console.warn("ondataavailable called with no data or zero size.");
        }
      };

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder.onstop called. Recorded chunks:", this.recordedChunks.length, "State:", this.mediaRecorder?.state);
        
        // Stop all source tracks for the MediaRecorder *after* it has stopped
        // This ensures MediaRecorder has processed all data but releases resources.
        if (this.canvasStream) {
          this.canvasStream.getTracks().forEach(track => track.stop());
          this.canvasStream = null; // Clear reference
        }
        if (this.audioVideoStream) {
            this.audioVideoStream.getTracks().forEach(track => track.stop());
            this.audioVideoStream = null; // Clear reference
        }

        if (this.recordedChunks.length === 0) {
            console.warn("No data recorded. Showing record UI again.");
            this.uiManager.showLoading(false);
            this.uiManager.updateRecordButtonState(false); // Show record icon
            this.uiManager.toggleRecordButton(true); // Show record button
            this.uiManager.actionButton.style.display = "none";
            this.uiManager.backButtonContainer.style.display = "none";
            this.uiManager.switchButton.style.display = "block";
            this.resetRecordingVariables(); // Ensure a full clean slate
            return;
        }

        this.uiManager.showLoading(true);
        const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType });
        this.recordedChunks = []; // Clear chunks after creating blob

        try {
            console.log("Processing video duration...");
            const fixedBlob = await this.videoProcessor.fixVideoDuration(blob);
            const url = URL.createObjectURL(fixedBlob);
            this.uiManager.showLoading(false);
            console.log("Video processed. Displaying post-record buttons.");
            this.uiManager.displayPostRecordButtons(url, fixedBlob);
        } catch (processingError) {
            console.error("Error processing video:", processingError);
            this.uiManager.showLoading(false);
            // Optionally, revert UI to recording state or show specific error
            this.uiManager.updateRecordButtonState(false);
            this.uiManager.toggleRecordButton(true);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error || event);
        this.uiManager.showLoading(false);
        // Reset UI to allow another attempt, and ensure variables are clean
        this.resetRecordingVariables(); // Crucial for cleaning up failed state
        this.uiManager.updateRecordButtonState(false);
        this.uiManager.toggleRecordButton(true);
        this.uiManager.actionButton.style.display = "none";
        this.uiManager.backButtonContainer.style.display = "none";
        this.uiManager.switchButton.style.display = "block";
      };

      console.log("Starting MediaRecorder...");
      this.mediaRecorder.start();
      return true;
    } catch (error) {
      console.error("Error in startRecording:", error);
      this.uiManager.showLoading(false);
      // Clean up any partially acquired resources from this attempt
      this.resetRecordingVariables(); // Ensure clean state after error
      return false;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("Calling mediaRecorder.stop(). Current state:", this.mediaRecorder.state);
      this.mediaRecorder.stop();
      // `onstop` handler will now manage track cleanup and UI.
    } else {
        console.log("stopRecording called but mediaRecorder not active or doesn't exist. State:", this.mediaRecorder?.state);
        // If somehow stop is called without an active recorder, ensure UI isn't stuck
        if (this.uiManager.recordPressedCount % 2 !== 0) { // If UI thinks it's recording
            this.uiManager.updateRecordButtonState(false);
            this.uiManager.toggleRecordButton(true);
        }
    }
  }
}