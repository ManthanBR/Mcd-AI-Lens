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
      alert("Sharing not supported on this device.")
    }
  } catch (error) {
    console.error("Error while sharing:", error)
  }
}
