import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.cameraManager = cameraManager; // Keep reference if needed for other things, like getting current mediaStream
    this.canvasStream = null // The stream from canvas (video) and audio (cloned)

    // AudioContext setup
    this.audioContext = null;
    this.audioDestinationNode = null;
    this.currentAudioSourceNode = null; // Source node connected to audioDestinationNode
    this.sourceAudioTrack = null; // Reference to the original audio track that is being processed/cloned.
                                  // AC path: original track from audioDestinationNode.stream
                                  // Fallback path: cloned track from cameraManager.mediaStream

    try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioDestinationNode = this.audioContext.createMediaStreamDestination();
        console.log("AudioContext and MediaStreamAudioDestinationNode initialized.");
    } catch (e) {
        console.warn("AudioContext is not supported or failed to initialize. Audio processing will use fallback.", e);
        this.audioContext = null; // Ensure it's null if initialization failed
        this.audioDestinationNode = null;
    }
  }

  _connectAudioSource(mediaStream) {
    if (!this.audioContext || !this.audioDestinationNode || !mediaStream) {
        console.warn("_connectAudioSource: prerequisites not met.", { hasAC: !!this.audioContext, hasDest: !!this.audioDestinationNode, hasMS: !!mediaStream });
        return;
    }

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newAudioTrack = audioTracks[0];
      if (this.currentAudioSourceNode) {
        this.currentAudioSourceNode.disconnect();
        console.log("Disconnected old audio source from AudioContext destination.");
      }
      // Create a new MediaStream with only the desired audio track
      const audioStreamForSourceNode = new MediaStream([newAudioTrack]);
      this.currentAudioSourceNode = this.audioContext.createMediaStreamSource(audioStreamForSourceNode);
      this.currentAudioSourceNode.connect(this.audioDestinationNode);
      console.log("New audio source connected to AudioContext destination.");
    } else {
      console.warn("New mediaStream has no audio tracks to connect to AudioContext.");
      if (this.currentAudioSourceNode) {
        this.currentAudioSourceNode.disconnect();
        this.currentAudioSourceNode = null;
      }
    }
  }

  async startRecording(liveRenderTarget, cameraManagerInstance) {
    try {
      if (!cameraManagerInstance || !cameraManagerInstance.mediaStream) {
        console.error("CameraManager instance or its mediaStream is not available for recording.")
        this.uiManager.showLoading(false)
        alert("Camera not ready. Cannot start recording.")
        return false
      }

      let audioTrackForCanvasStream;

      if (this.audioContext && this.audioDestinationNode) {
        // AudioContext Path
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log("AudioContext resumed.");
        }
        this._connectAudioSource(cameraManagerInstance.mediaStream); // Connect current camera audio

        const mainTrackFromDestination = this.audioDestinationNode.stream.getAudioTracks()[0];
        if (!mainTrackFromDestination) {
          console.error("AudioContext: Failed to get audio track from AudioDestinationNode. Recording will likely be silent.");
          this.uiManager.showLoading(false);
          alert("Audio recording setup failed (destination node issue). Cannot start recording.");
          this.resetRecordingVariables();
          return false;
        }
        this.sourceAudioTrack = mainTrackFromDestination; // Store reference to the "live" track from destination
        audioTrackForCanvasStream = this.sourceAudioTrack.clone(); // Clone it for MediaRecorder's stream
        console.log("AudioContext: Using cloned audio track from AudioDestinationNode for MediaRecorder.", audioTrackForCanvasStream);
      } else {
        // Fallback Path (No AudioContext or it failed to initialize)
        console.warn("AudioContext not available or setup failed, falling back to direct audio track cloning from camera.");
        const cameraAudioTracks = cameraManagerInstance.mediaStream.getAudioTracks();
        if (cameraAudioTracks.length === 0) {
          console.error("No audio track found on camera stream for recording (fallback).");
          this.uiManager.showLoading(false);
          alert("Microphone not accessible or no audio track found. Cannot start recording with audio.");
          this.resetRecordingVariables();
          return false;
        }
        // In fallback, sourceAudioTrack directly becomes the cloned track for canvasStream
        this.sourceAudioTrack = cameraAudioTracks[0].clone(); 
        audioTrackForCanvasStream = this.sourceAudioTrack;
        console.log("Fallback: Using cloned audio track directly from camera stream for MediaRecorder.", audioTrackForCanvasStream);
      }

      if (!audioTrackForCanvasStream || audioTrackForCanvasStream.readyState === 'ended') {
        console.error("Failed to obtain a valid/live audio track for MediaRecorder.", audioTrackForCanvasStream);
        this.uiManager.showLoading(false);
        alert("Audio track acquisition failed or track is not live. Cannot start recording.");
        this.resetRecordingVariables();
        return false;
      }

      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      this.canvasStream.addTrack(audioTrackForCanvasStream); // Add the (cloned) audio track

      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
        audioBitsPerSecond: Settings.recording.audioBitsPerSecond, // Optional: add to settings if needed
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log("MediaRecorder stopped. Recorded chunks:", this.recordedChunks.length);
        this.uiManager.showLoading(true);
        
        let finalBlob;
        if (this.recordedChunks.length > 0) {
            const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType });
            try {
                const fixedBlob = await this.videoProcessor.fixVideoDuration(blob);
                finalBlob = fixedBlob;
            } catch (ffmpegError) {
                console.error("FFmpeg processing failed, using raw blob:", ffmpegError);
                finalBlob = blob; // Use raw blob if FFmpeg fails
            }
        } else {
            console.warn("No data recorded.");
            this.uiManager.showLoading(false);
            this.uiManager.toggleRecordButton(true); 
            this.resetRecordingVariables();
            return;
        }
        
        const url = URL.createObjectURL(finalBlob);
        this.uiManager.showLoading(false);
        this.uiManager.displayPostRecordButtons(url, finalBlob, this, this.cameraManager); // Pass cameraManager
        // Do not resetRecordingVariables() here, let displayPostRecordButtons's back button handle it
        // or reset only specific parts if needed immediately
      }
       this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        alert(`Recording error: ${event.error.name} - ${event.error.message}`);
        this.uiManager.showLoading(false);
        this.uiManager.updateRecordButtonState(false); // Reset button state
        this.uiManager.toggleRecordButton(true);      // Show record button
        this.resetRecordingVariables();
      };

      this.mediaRecorder.start()
      console.log("Recording started with MediaStream:", this.canvasStream, "Tracks:", this.canvasStream.getTracks());
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
        this.mediaRecorder.onstop = null; // Prevent onstop from firing again if stop was called programmatically
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onerror = null;
        this.mediaRecorder.stop(); 
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop(); // Stop all tracks (video from canvas, cloned audio)
        console.log("Stopped track in canvasStream:", track.kind, track.id, track.label);
      });
      this.canvasStream = null;
    }

    if (this.currentAudioSourceNode) { // Specific to AudioContext path
      this.currentAudioSourceNode.disconnect();
      this.currentAudioSourceNode = null;
      console.log("Disconnected and cleared currentAudioSourceNode.");
    }
    
    // sourceAudioTrack was either the main track from AudioDestinationNode (don't stop it, its lifecycle is AudioContext's)
    // OR it was the cloned track in the fallback path (which was added to canvasStream and stopped above).
    // So, just nullify the reference.
    this.sourceAudioTrack = null;
    console.log("Recording variables reset.");
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop() 
      console.log("Recording stopping command issued...")
    } else {
       console.log("Recorder not active or already stopped.");
       // If onstop didn't fire for some reason and we need to clean up:
       if (this.recordedChunks.length === 0 && !this.uiManager.actionButton.style.display === 'none') {
           // this.resetRecordingVariables(); // Potentially, if stuck
       }
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording"
  }

  switchCameraAudio(newCameraManagerMediaStream) {
    if (!this.isRecording()) {
      console.log("Not recording, no audio switch needed for MediaRecorder's stream.");
      // If not recording, but AudioContext is active, we might still want to update its source
      if (this.audioContext && this.audioDestinationNode) {
          this._connectAudioSource(newCameraManagerMediaStream);
      }
      return;
    }

    console.log("Attempting to switch camera audio during recording.");
    if (this.audioContext && this.audioDestinationNode) {
        // AudioContext path: just reconnect the source to the destination node.
        // The original this.sourceAudioTrack (from destination node) updates its content,
        // and its clone in canvasStream reflects these changes.
        console.log("AudioContext: Switching audio source via _connectAudioSource for ongoing recording.");
        this._connectAudioSource(newCameraManagerMediaStream);
    } else {
        // Fallback path: direct track replacement in canvasStream.
        console.warn("AudioContext not available for switch, attempting direct track replacement in MediaRecorder's stream.");
        if (!this.canvasStream) {
            console.error("Canvas stream not available for audio track replacement (fallback).")
            return;
        }
        
        // Remove and stop old audio track (which is this.sourceAudioTrack in fallback, as it's the cloned one)
        this.canvasStream.getAudioTracks().forEach(track => {
            console.log("Fallback: Removing old audio track from canvasStream:", track.id, track.label);
            this.canvasStream.removeTrack(track);
            if (this.sourceAudioTrack && track.id === this.sourceAudioTrack.id) {
                track.stop();
                console.log("Fallback: Stopped old sourceAudioTrack:", track.id);
            } else { // Should not happen if logic is correct, but stop any rogue audio tracks
                track.stop();
                console.warn("Fallback: Stopped an unexpected audio track during switch:", track.id);
            }
        });

        const newSourceCameraAudioTracks = newCameraManagerMediaStream.getAudioTracks();
        if (newSourceCameraAudioTracks.length > 0) {
            const newClonedTrack = newSourceCameraAudioTracks[0].clone();
            console.log("Fallback: Adding new cloned audio track to canvasStream:", newClonedTrack.id, newClonedTrack.label);
            this.canvasStream.addTrack(newClonedTrack);
            this.sourceAudioTrack = newClonedTrack; // Update reference to the new active cloned track
        } else {
            console.warn("Fallback: New camera stream has no audio track during switch.");
            this.sourceAudioTrack = null;
        }
    }
    console.log("Audio track switch attempt for MediaRecorder completed.");
  }
}