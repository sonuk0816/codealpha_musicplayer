/* =========================================================
   NIGHTWAVE PLAYER — script.js
   Vanilla JS + HTML5 Audio API. No dependencies.
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     1. TRACK DATA
     Playlist of at least four tracks. Audio files are royalty-
     free demo tracks (SoundHelix); artwork comes from Unsplash.
     --------------------------------------------------------- */
  const TRACKS = [
    {
      title: "Midnight Drift",
      artist: "Nova Ray",
      src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80&auto=format&fit=crop",
    },
    {
      title: "Electric Bloom",
      artist: "Kaia Vance",
      src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80&auto=format&fit=crop",
    },
    {
      title: "Glass Horizon",
      artist: "Rune Atlas",
      src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      cover: "https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=600&q=80&auto=format&fit=crop",
    },
    {
      title: "Static Bloom",
      artist: "Halo District",
      src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      cover: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=80&auto=format&fit=crop",
    },
    {
      title: "Afterglow City",
      artist: "Nova Ray",
      src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      cover: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&q=80&auto=format&fit=crop",
    },
  ];

  /* ---------------------------------------------------------
     2. DOM REFERENCES
     --------------------------------------------------------- */
  const audio = document.getElementById("audio");

  const albumArt = document.getElementById("albumArt");
  const disc = document.getElementById("disc");
  const trackTitleEl = document.getElementById("trackTitle");
  const trackArtistEl = document.getElementById("trackArtist");

  const seekBar = document.getElementById("seekBar");
  const currentTimeEl = document.getElementById("currentTime");
  const durationTimeEl = document.getElementById("durationTime");

  const playBtn = document.getElementById("playBtn");
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const repeatBtn = document.getElementById("repeatBtn");

  const volumeBar = document.getElementById("volumeBar");
  const muteBtn = document.getElementById("muteBtn");
  const volIcon = document.getElementById("volIcon");
  const muteIcon = document.getElementById("muteIcon");

  const playlistToggle = document.getElementById("playlistToggle");
  const playlistPanel = document.getElementById("playlistPanel");
  const playlistList = document.getElementById("playlistList");
  const playlistCount = document.getElementById("playlistCount");

  /* ---------------------------------------------------------
     3. STATE
     --------------------------------------------------------- */
  let currentIndex = 0;
  let isPlaying = false;
  let isShuffle = false;
  let isRepeat = false;
  let isSeeking = false; // true while the user drags the seek handle
  let lastVolume = 0.8; // remembered volume for the mute toggle

  /* ---------------------------------------------------------
     4. HELPERS
     --------------------------------------------------------- */

  // Formats seconds as mm:ss, guarding against NaN/Infinity
  // before metadata has loaded.
  function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Keeps a range input's filled-in track in sync with its value,
  // via the shared --progress custom property used in style.css.
  function paintRange(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const pct = ((input.value - min) / (max - min)) * 100;
    input.style.setProperty("--progress", `${pct}%`);
  }

  /* ---------------------------------------------------------
     5. PLAYLIST RENDERING
     --------------------------------------------------------- */
  function renderPlaylist() {
    playlistList.innerHTML = "";

    TRACKS.forEach((track, index) => {
      const li = document.createElement("li");
      li.className = "playlist__item";
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(index));
      li.setAttribute("aria-selected", index === currentIndex ? "true" : "false");
      if (index === currentIndex) li.classList.add("is-active");

      li.innerHTML = `
        <img class="playlist__thumb" src="${track.cover}" alt="" />
        <div class="playlist__info">
          <div class="playlist__song">${track.title}</div>
          <div class="playlist__by">${track.artist}</div>
        </div>
        <span class="playlist__eq" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      `;

      li.addEventListener("click", () => {
        loadTrack(index, { autoplay: true });
      });

      playlistList.appendChild(li);
    });

    playlistCount.textContent = `${TRACKS.length} track${TRACKS.length !== 1 ? "s" : ""}`;
  }

  // Only toggles the active-row highlight/equalizer; avoids a full
  // re-render (and the flash that comes with it) on every track change.
  function updatePlaylistActiveState() {
    const items = playlistList.querySelectorAll(".playlist__item");
    items.forEach((item) => {
      const index = Number(item.getAttribute("data-index"));
      const active = index === currentIndex;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  /* ---------------------------------------------------------
     6. TRACK LOADING & TRANSPORT
     --------------------------------------------------------- */
  function loadTrack(index, { autoplay = false } = {}) {
    currentIndex = (index + TRACKS.length) % TRACKS.length;
    const track = TRACKS[currentIndex];

    audio.src = track.src;
    albumArt.src = track.cover;
    albumArt.alt = `Album art for ${track.title} by ${track.artist}`;
    trackTitleEl.textContent = track.title;
    trackArtistEl.textContent = track.artist;

    // Reset progress UI immediately; timeupdate/loadedmetadata refine it.
    seekBar.value = 0;
    paintRange(seekBar);
    currentTimeEl.textContent = "00:00";
    durationTimeEl.textContent = "00:00";

    updatePlaylistActiveState();

    if (autoplay) {
      playAudio();
    } else {
      setPlayingState(false);
    }
  }

  function playAudio() {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setPlayingState(true))
        .catch(() => setPlayingState(false)); // autoplay may be blocked until user interacts
    }
  }

  function pauseAudio() {
    audio.pause();
    setPlayingState(false);
  }

  function togglePlay() {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    playIcon.style.display = playing ? "none" : "block";
    pauseIcon.style.display = playing ? "block" : "none";
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    disc.classList.toggle("is-spinning", playing);
  }

  // Picks the next index, honoring shuffle mode.
  function getNextIndex() {
    if (isShuffle && TRACKS.length > 1) {
      let random;
      do {
        random = Math.floor(Math.random() * TRACKS.length);
      } while (random === currentIndex);
      return random;
    }
    return currentIndex + 1;
  }

  function getPrevIndex() {
    if (isShuffle && TRACKS.length > 1) {
      let random;
      do {
        random = Math.floor(Math.random() * TRACKS.length);
      } while (random === currentIndex);
      return random;
    }
    return currentIndex - 1;
  }

  function playNext() {
    loadTrack(getNextIndex(), { autoplay: true });
  }

  function playPrev() {
    // If more than 3s into the track, "previous" restarts the current
    // track first (standard player UX) instead of always skipping back.
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    loadTrack(getPrevIndex(), { autoplay: true });
  }

  /* ---------------------------------------------------------
     7. EVENT BINDINGS — transport
     --------------------------------------------------------- */
  playBtn.addEventListener("click", togglePlay);
  nextBtn.addEventListener("click", playNext);
  prevBtn.addEventListener("click", playPrev);

  shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("is-active", isShuffle);
    shuffleBtn.setAttribute("aria-pressed", String(isShuffle));
  });

  repeatBtn.addEventListener("click", () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle("is-active", isRepeat);
    repeatBtn.setAttribute("aria-pressed", String(isRepeat));
  });

  /* ---------------------------------------------------------
     8. EVENT BINDINGS — progress / seeking
     --------------------------------------------------------- */
  audio.addEventListener("loadedmetadata", () => {
    seekBar.max = audio.duration || 0;
    durationTimeEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (isSeeking) return; // don't fight the user while they're dragging
    seekBar.value = audio.currentTime;
    paintRange(seekBar);
    currentTimeEl.textContent = formatTime(audio.currentTime);
  });

  // Live-update the displayed time while dragging, without
  // moving playback until the user releases the handle.
  seekBar.addEventListener("input", () => {
    isSeeking = true;
    paintRange(seekBar);
    currentTimeEl.textContent = formatTime(Number(seekBar.value));
  });

  seekBar.addEventListener("change", () => {
    audio.currentTime = Number(seekBar.value);
    isSeeking = false;
  });

  /* ---------------------------------------------------------
     9. EVENT BINDINGS — volume
     --------------------------------------------------------- */
  audio.volume = Number(volumeBar.value) / 100;
  paintRange(volumeBar);

  volumeBar.addEventListener("input", () => {
    const vol = Number(volumeBar.value) / 100;
    audio.volume = vol;
    audio.muted = false;
    paintRange(volumeBar);
    updateVolumeIcon(vol);
    if (vol > 0) lastVolume = vol;
  });

  muteBtn.addEventListener("click", () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume || 0.8;
      volumeBar.value = Math.round(audio.volume * 100);
    } else {
      lastVolume = audio.volume;
      audio.muted = true;
      volumeBar.value = 0;
    }
    paintRange(volumeBar);
    updateVolumeIcon(audio.muted ? 0 : audio.volume);
  });

  function updateVolumeIcon(vol) {
    const muted = vol === 0;
    volIcon.style.display = muted ? "none" : "block";
    muteIcon.style.display = muted ? "block" : "none";
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
  }

  /* ---------------------------------------------------------
     10. AUTOPLAY ON TRACK END
     --------------------------------------------------------- */
  audio.addEventListener("ended", () => {
    if (isRepeat) {
      audio.currentTime = 0;
      playAudio();
    } else {
      playNext();
    }
  });

  /* ---------------------------------------------------------
     11. PLAYLIST PANEL TOGGLE
     --------------------------------------------------------- */
  playlistToggle.addEventListener("click", () => {
    const isOpen = playlistPanel.classList.toggle("is-open");
    playlistToggle.setAttribute("aria-expanded", String(isOpen));
  });

  /* ---------------------------------------------------------
     12. INIT
     --------------------------------------------------------- */
  renderPlaylist();
  loadTrack(0, { autoplay: false });
  updateVolumeIcon(audio.volume);
})();