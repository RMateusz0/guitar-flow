document.addEventListener("DOMContentLoaded", () => {
  const backingTrack = new Audio("./samples/backing.mp3");
  backingTrack.volume = 0.4;
  backingTrack.preload = "auto";

  const noteElements = Array.from(document.querySelectorAll(".item"));
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  let audioContext = null;
  let masterGain = null;

  const noteBuffers = new Array(noteElements.length);

  if (AudioContextClass) {
    try {
      try {
        audioContext = new AudioContextClass({
          latencyHint: "interactive",
        });
      } catch {
        audioContext = new AudioContextClass();
      }

      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(audioContext.destination);
    } catch (error) {
      console.error("AudioContext initialization failed:", error);
      audioContext = null;
      masterGain = null;
    }
  } else {
    console.error("Web Audio API is not available in this browser.");
  }

  const resumeAudio = () => {
    if (!audioContext || audioContext.state === "running") {
      return;
    }

    audioContext.resume().catch((error) => {
      console.error("Failed to resume AudioContext:", error);
    });
  };

  document.addEventListener("pointerdown", resumeAudio, {
    capture: true,
    passive: true,
  });

  document.addEventListener("keydown", resumeAudio, {
    capture: true,
  });

  const playNote = (noteIndex) => {
    if (!audioContext || !masterGain || !noteBuffers[noteIndex]) {
      return;
    }

    const startPlayback = () => {
      if (audioContext.state !== "running") {
        return;
      }

      const source = audioContext.createBufferSource();
      source.buffer = noteBuffers[noteIndex];
      source.connect(masterGain);
      source.addEventListener("ended", () => source.disconnect(), {
        once: true,
      });
      source.start(0);
    };

    if (audioContext.state === "running") {
      startPlayback();
      return;
    }

    audioContext
      .resume()
      .then(() => {
        if (audioContext.state === "running") {
          startPlayback();
        }
      })
      .catch((error) => {
        console.error("Failed to resume audio for guitar note:", error);
      });
  };

  noteElements.forEach((element, index) => {
    element.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        playNote(index);
      }
    });

    element.addEventListener(
      "touchstart",
      () => {
        if (!audioContext) {
          return;
        }

        if (!noteBuffers[index]) {
          console.warn(`Sample ${index + 1} is not loaded.`);
          return;
        }

        playNote(index);
      },
      { passive: true },
    );
  });

  const playButton = document.querySelector(".play-backing-track-button");
  const pauseButton = document.querySelector(".pause-backing-track-button");
  const reloadButton = document.querySelector(".reload-backing-track-button");

  const playBackingTrack = () => {
    // Wywołanie play() następuje bezpośrednio w obsłudze kliknięcia.
    const playPromise = backingTrack.play();

    if (playPromise) {
      playPromise.catch((error) => {
        console.error("Failed to play backing track:", error);
      });
    }

    resumeAudio();
  };

  if (playButton) {
    playButton.addEventListener("click", playBackingTrack);
  }

  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      backingTrack.pause();
    });
  }

  if (reloadButton) {
    reloadButton.addEventListener("click", () => {
      backingTrack.pause();
      backingTrack.currentTime = 0;
      playBackingTrack();
    });
  }

  const loadNoteSamples = async () => {
    if (!audioContext) {
      return;
    }

    const results = await Promise.allSettled(
      noteElements.map(async (_, index) => {
        const path = `./samples/${index + 1}.wav`;
        const response = await fetch(path);

        if (!response.ok) {
          throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
        }

        const data = await response.arrayBuffer();
        return audioContext.decodeAudioData(data);
      }),
    );

    let loadedCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        noteBuffers[index] = result.value;
        loadedCount++;
      } else {
        console.error(
          `Failed to load guitar sample ${index + 1}:`,
          result.reason,
        );
      }
    });

    console.info(
      `Loaded ${loadedCount}/${noteElements.length} guitar samples.`,
    );
  };

  loadNoteSamples().catch((error) => {
    console.error("Failed to initialize guitar samples:", error);
  });
});
