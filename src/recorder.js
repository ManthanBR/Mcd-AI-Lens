import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager, cameraManager, monitorNodes) { 
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.videoProcessor = videoProcessor;
    this.uiManager = uiManager;
    this.cameraManager = cameraManager;
    this.canvasStream = null; 

    this.audioMixContext = null;
    this.audioMixDestinationNode = null;
    this.microphoneSourceNode = null; 
    this.lensAudioSourceNodes = [];   
    this.monitorNodes = monitorNodes; // This is a reference to g_monitorNodes

    try {
        this.audioMixContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioMixDestinationNode = this.audioMixContext.createMediaStreamDestination();
        console.log("AudioMixContext and MediaStreamAudioDestinationNode for mixing initialized.");
    } catch (e) {
        console.warn("AudioMixContext for mixing is not supported or failed to initialize. Audio recording might be limited.", e);
        this.audioMixContext = null;
        this.audioMixDestinationNode = null;
    }
  }

  // --- NEW: Helper to check if mixer is ready ---
  isMixerActive() {
    return !!this.audioMixContext && !!this.audioMixDestinationNode;
  }

  // --- NEW: Method to dynamically add a lens audio source ---
  dynamicallyAddLensAudioSource(monitorNode) {
    if (!this.isMixerActive()) {
        console.warn("Mixer not active, cannot dynamically add lens audio source.");
        return;
    }
    if (this.audioMixContext.state === 'suspended') {
        this.audioMixContext.resume().catch(e => console.error("Error resuming audio context for dynamic add:", e));
    }

    if (monitorNode && monitorNode.stream && monitorNode.stream.active && monitorNode.stream.getAudioTracks().length > 0) {
        // Check if this stream is already connected
        const existingSource = this.lensAudioSourceNodes.find(s => s.mediaStream && s.mediaStream.id === monitorNode.stream.id);
        if (existingSource) {
            // console.log("Lens audio source from stream already connected:", monitorNode.stream.id);
            return;
        }

        try {
            const lensAudioTrack = monitorNode.stream.getAudioTracks()[0];
            const singleLensAudioStream = new MediaStream([lensAudioTrack]); // Use a new stream for the source node
            const lensSourceNode = this.audioMixContext.createMediaStreamSource(singleLensAudioStream);
            lensSourceNode.connect(this.audioMixDestinationNode);
            this.lensAudioSourceNodes.push(lensSourceNode); // Track it
            console.log("Dynamically added lens audio from monitorNode's stream to mix destination:", monitorNode.stream.id);
        } catch (e) {
            console.error("Error dynamically connecting lens audio from monitorNode's stream:", monitorNode.stream.id, e);
        }
    } else {
        // console.warn("Skipping dynamic add for monitorNode: stream inactive, null, or no audio tracks.", monitorNode);
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

      if (!this.isMixerActive()) {
        console.error("Audio mixing context not available. Cannot start recording with mixed audio.");
        this.uiManager.showLoading(false);
        alert("Audio mixing setup failed. Cannot start recording.");
        this.resetRecordingVariables(); 
        return false;
      }

      if (this.audioMixContext.state === 'suspended') {
        await this.audioMixContext.resume();
        console.log("AudioMixContext resumed for recording.");
      }

      // 1. Connect Microphone Audio
      const micAudioTracks = cameraManagerInstance.mediaStream.getAudioTracks();
      if (micAudioTracks.length > 0) {
        if (this.microphoneSourceNode) {
            try { this.microphoneSourceNode.disconnect(); } catch(e) { /* ignore */ }
        }
        const micOnlyStream = new MediaStream([micAudioTracks[0]]);
        this.microphoneSourceNode = this.audioMixContext.createMediaStreamSource(micOnlyStream);
        this.microphoneSourceNode.connect(this.audioMixDestinationNode);
        console.log("Microphone audio connected to mix destination.");
      } else {
        console.warn("No microphone audio track found on camera stream to connect to mixer.");
      }

      // 2. Connect Lens Audio (from initially captured monitorNodes)
      // Disconnect any previously connected lens sources before reconnecting from the current list
      this.lensAudioSourceNodes.forEach(node => { try { node.disconnect(); } catch(e) { /* ignore */ }});
      this.lensAudioSourceNodes = []; // Reset the list of connected nodes

      if (Settings.recording.includeLensAudio) {
        // this.monitorNodes is a reference to g_monitorNodes from main.js, so it's always up-to-date
        this.monitorNodes.forEach(mn => {
            // Call the dynamic add function, which includes checks
            this.dynamicallyAddLensAudioSource(mn);
        });
      } else {
        console.log("Lens audio inclusion is disabled via settings.");
      }


      // 3. Get the mixed audio track
      const mixedAudioTracks = this.audioMixDestinationNode.stream.getAudioTracks();
      let audioTrackForCanvasStream;

      if (mixedAudioTracks.length > 0) {
        audioTrackForCanvasStream = mixedAudioTracks[0].clone(); // Clone for safety
        console.log("Using cloned mixed audio track for MediaRecorder:", audioTrackForCanvasStream);
      } else {
        console.warn("No audio tracks in mix destination stream after attempting to connect sources.");
        if (micAudioTracks.length > 0 && Settings.recording.fallbackToMicOnlyOnError) {
            audioTrackForCanvasStream = micAudioTracks[0].clone();
            console.warn("Fallback: Using direct microphone audio track as mixed stream was empty.");
        } else {
            console.error("Mixed audio track acquisition failed, and fallback not possible/disabled. Cannot start recording with audio.");
            this.uiManager.showLoading(false);
            alert("Audio track setup failed (mixed or fallback). Cannot start recording.");
            this.resetRecordingVariables(); 
            return false;
        }
      }

      if (!audioTrackForCanvasStream || audioTrackForCanvasStream.readyState === 'ended') {
        console.error("Failed to obtain a valid/live audio track for MediaRecorder.", audioTrackForCanvasStream);
        this.uiManager.showLoading(false);
        alert("Audio track acquisition failed or track is not live. Cannot start recording.");
        this.resetRecordingVariables();
        return false;
      }

      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      this.canvasStream.addTrack(audioTrackForCanvasStream);

      this.mediaRecorder = new MediaRecorder(this.canvasStream, {
        mimeType: Settings.recording.mimeType,
        audioBitsPerSecond: Settings.recording.audioBitsPerSecond,
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
                if (Settings.ffmpeg && Settings.ffmpeg.enabled !== false) {
                    const fixedBlob = await this.videoProcessor.fixVideoDuration(blob);
                    finalBlob = fixedBlob;
                } else {
                    console.log("FFmpeg processing is disabled. Using raw blob.");
                    finalBlob = blob;
                }
            } catch (ffmpegError) {
                console.error("FFmpeg processing failed, using raw blob:", ffmpegError);
                finalBlob = blob; 
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
        this.uiManager.displayPostRecordButtons(url, finalBlob, this, this.cameraManager);
      }

       this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        alert(`Recording error: ${event.error.name} - ${event.error.message}`);
        this.uiManager.showLoading(false);
        this.uiManager.updateRecordButtonState(false);
        this.uiManager.toggleRecordButton(true);      
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
        this.mediaRecorder.onstop = null; 
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onerror = null;
        try {
            if (this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop(); 
        } catch(e) {
            console.warn("Error stopping media recorder during reset:", e);
        }
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.canvasStream = null;
    }

    if (this.microphoneSourceNode) {
      try { this.microphoneSourceNode.disconnect(); } catch(e) { /* ignore */ }
      this.microphoneSourceNode = null;
    }
    this.lensAudioSourceNodes.forEach(node => {
        try { node.disconnect(); } catch(e) { /* ignore */ }
    });
    this.lensAudioSourceNodes = []; // Clear the list of connected lens audio nodes
    
    console.log("Recording variables reset.");
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop() 
      console.log("Recording stopping command issued...")
    } else {
       console.log("Recorder not active or already stopped.");
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording"
  }

  switchCameraAudio(newCameraManagerMediaStream) {
    if (!this.isMixerActive()) {
        console.warn("AudioMixContext not available for switching camera audio.");
        return;
    }
    if (this.audioMixContext.state === 'suspended') {
        this.audioMixContext.resume().catch(e => console.error("Error resuming audio context on switch:", e));
    }

    console.log("Attempting to switch camera's microphone audio input to the mixer.");

    if (this.microphoneSourceNode) {
        try { this.microphoneSourceNode.disconnect(); } catch (e) { /* ignore */ }
        this.microphoneSourceNode = null;
    }

    if (newCameraManagerMediaStream) {
        const newMicAudioTracks = newCameraManagerMediaStream.getAudioTracks();
        if (newMicAudioTracks.length > 0) {
            const micOnlyStream = new MediaStream([newMicAudioTracks[0]]);
            this.microphoneSourceNode = this.audioMixContext.createMediaStreamSource(micOnlyStream);
            this.microphoneSourceNode.connect(this.audioMixDestinationNode);
            console.log("AudioMixContext: Switched microphone audio source.");
        } else {
            console.warn("AudioMixContext: New camera stream has no audio track during switch.");
        }
    } else {
        console.warn("AudioMixContext: newCameraManagerMediaStream is null during switch.");
    }
    console.log("Microphone audio switch attempt for mixer completed.");
  }
}