/**
 * File ↔ PNG
 * Packs any file into a PNG by storing bytes in the RGB channels of pixels.
 * Format:
 *   Magic (6 bytes): "F2PNG1"
 *   Name length (2 bytes, uint16 BE)
 *   Filename (UTF-8)
 *   Data length (4 bytes, uint32 BE)
 *   File data
 * Remaining pixels are filled with noise so the image looks less empty.
 */

(function () {
  "use strict";

  const MAGIC = new TextEncoder().encode("F2PNG1");
  const BYTES_PER_PIXEL = 3; // R, G, B (alpha fixed to 255)

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);

  const tabEncode = $("#tab-encode");
  const tabDecode = $("#tab-decode");
  const panelEncode = $("#panel-encode");
  const panelDecode = $("#panel-decode");

  const encodeDrop = $("#encode-drop");
  const encodeFileInput = $("#encode-file");
  const btnPickFile = $("#btn-pick-file");
  const encodeInfo = $("#encode-info");
  const encodeFilename = $("#encode-filename");
  const encodeFilesize = $("#encode-filesize");
  const btnClearEncode = $("#btn-clear-encode");
  const btnEncode = $("#btn-encode");
  const encodeResult = $("#encode-result");
  const encodePreview = $("#encode-preview");
  const encodePngSize = $("#encode-png-size");
  const encodeDims = $("#encode-dims");
  const btnDownloadPng = $("#btn-download-png");
  const btnPreviewFs = $("#btn-preview-fs");
  const btnFullscreenEncode = $("#btn-fullscreen-encode");

  const decodeDrop = $("#decode-drop");
  const decodeFileInput = $("#decode-file");
  const btnPickPng = $("#btn-pick-png");
  const btnCamera = $("#btn-camera");
  const cameraView = $("#camera-view");
  const cameraVideo = $("#camera-video");
  const cameraCanvas = $("#camera-canvas");
  const btnCapture = $("#btn-capture");
  const btnCloseCamera = $("#btn-close-camera");
  const decodeInfo = $("#decode-info");
  const decodeFilename = $("#decode-filename");
  const decodeFilesize = $("#decode-filesize");
  const btnClearDecode = $("#btn-clear-decode");
  const btnDecode = $("#btn-decode");
  const decodeResult = $("#decode-result");
  const extractedName = $("#extracted-name");
  const extractedSize = $("#extracted-size");
  const extractedType = $("#extracted-type");
  const btnDownloadFile = $("#btn-download-file");
  const decodePreviewWrap = $("#decode-preview-wrap");
  const decodePreview = $("#decode-preview");
  const btnFullscreenDecode = $("#btn-fullscreen-decode");

  const statusEl = $("#status");
  const fsOverlay = $("#fs-overlay");
  const fsImg = $("#fs-img");
  const btnFsClose = $("#btn-fs-close");

  // ---------- State ----------
  let encodeFile = null;
  let encodeBlobUrl = null;
  let decodeFileObj = null;
  let extractedBlobUrl = null;
  let cameraStream = null;

  // ---------- Helpers ----------
  function setStatus(msg, type = "info") {
    statusEl.textContent = msg || "";
    statusEl.className = "status " + (type || "");
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function revoke(url) {
    if (url) URL.revokeObjectURL(url);
  }

  // ---------- Tabs ----------
  function switchMode(mode) {
    const isEncode = mode === "encode";
    tabEncode.classList.toggle("active", isEncode);
    tabDecode.classList.toggle("active", !isEncode);
    panelEncode.classList.toggle("active", isEncode);
    panelDecode.classList.toggle("active", !isEncode);
    setStatus("");
    stopCamera();
  }

  tabEncode.addEventListener("click", () => switchMode("encode"));
  tabDecode.addEventListener("click", () => switchMode("decode"));

  // ---------- Encode: file pick / drop ----------
  function setEncodeFile(file) {
    if (!file) return;
    encodeFile = file;
    encodeFilename.textContent = file.name;
    encodeFilesize.textContent = formatBytes(file.size);
    encodeInfo.classList.remove("hidden");
    btnEncode.disabled = false;
    encodeResult.classList.add("hidden");
    revoke(encodeBlobUrl);
    encodeBlobUrl = null;
    setStatus("");
  }

  btnPickFile.addEventListener("click", (e) => {
    e.stopPropagation();
    encodeFileInput.click();
  });
  encodeDrop.addEventListener("click", () => encodeFileInput.click());
  encodeFileInput.addEventListener("change", () => {
    if (encodeFileInput.files[0]) setEncodeFile(encodeFileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    encodeDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      encodeDrop.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    encodeDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      encodeDrop.classList.remove("dragover");
    });
  });
  encodeDrop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) setEncodeFile(f);
  });

  btnClearEncode.addEventListener("click", () => {
    encodeFile = null;
    encodeFileInput.value = "";
    encodeInfo.classList.add("hidden");
    btnEncode.disabled = true;
    encodeResult.classList.add("hidden");
    revoke(encodeBlobUrl);
    encodeBlobUrl = null;
    setStatus("");
  });

  // ---------- Encode core ----------
  function buildPayload(file, arrayBuffer) {
    const nameBytes = new TextEncoder().encode(file.name);
    if (nameBytes.length > 65535) throw new Error("Filename too long");

    const data = new Uint8Array(arrayBuffer);
    const totalLen =
      MAGIC.length + 2 + nameBytes.length + 4 + data.length;

    const buf = new Uint8Array(totalLen);
    let offset = 0;

    buf.set(MAGIC, offset);
    offset += MAGIC.length;

    buf[offset++] = (nameBytes.length >> 8) & 0xff;
    buf[offset++] = nameBytes.length & 0xff;

    buf.set(nameBytes, offset);
    offset += nameBytes.length;

    const len = data.length;
    buf[offset++] = (len >>> 24) & 0xff;
    buf[offset++] = (len >>> 16) & 0xff;
    buf[offset++] = (len >>> 8) & 0xff;
    buf[offset++] = len & 0xff;

    buf.set(data, offset);
    return buf;
  }

  function payloadToImageData(payload) {
    const neededPixels = Math.ceil(payload.length / BYTES_PER_PIXEL);
    let width = Math.ceil(Math.sqrt(neededPixels));
    width = Math.max(4, Math.ceil(width / 4) * 4);
    let height = Math.ceil(neededPixels / width);
    height = Math.max(4, height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const px = imageData.data;

    let pi = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (pi < payload.length) {
        px[i]     = payload[pi++];
        px[i + 1] = pi < payload.length ? payload[pi++] : 0;
        px[i + 2] = pi < payload.length ? payload[pi++] : 0;
        px[i + 3] = 255;
      } else {
        px[i]     = 20 + Math.floor(Math.random() * 40);
        px[i + 1] = 20 + Math.floor(Math.random() * 40);
        px[i + 2] = 30 + Math.floor(Math.random() * 50);
        px[i + 3] = 255;
      }
    }
    return { imageData, width, height, canvas, ctx };
  }

  async function encode() {
    if (!encodeFile) return;
    setStatus("Reading file…", "info");
    btnEncode.disabled = true;

    try {
      const buffer = await encodeFile.arrayBuffer();
      setStatus("Packing into PNG…", "info");

      const payload = buildPayload(encodeFile, buffer);
      const { imageData, width, height, canvas, ctx } = payloadToImageData(payload);
      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
      });

      revoke(encodeBlobUrl);
      encodeBlobUrl = URL.createObjectURL(blob);

      encodePreview.src = encodeBlobUrl;
      encodePngSize.textContent = formatBytes(blob.size);
      encodeDims.textContent = width + " × " + height;
      btnDownloadPng.href = encodeBlobUrl;
      btnDownloadPng.download = (encodeFile.name || "file") + ".png";

      encodeResult.classList.remove("hidden");
      setStatus("Done! PNG created.", "success");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + (err.message || err), "error");
    } finally {
      btnEncode.disabled = false;
    }
  }

  btnEncode.addEventListener("click", encode);

  // ---------- Decode: file pick / drop ----------
  function setDecodeSource(fileOrBlob, nameHint) {
    decodeFileObj = fileOrBlob;
    const name = nameHint || (fileOrBlob.name || "image.png");
    decodeFilename.textContent = name;
    decodeFilesize.textContent = formatBytes(fileOrBlob.size || 0);
    decodeInfo.classList.remove("hidden");
    btnDecode.disabled = false;
    decodeResult.classList.add("hidden");
    decodePreviewWrap.classList.add("hidden");
    revoke(extractedBlobUrl);
    extractedBlobUrl = null;
    setStatus("");

    const url = URL.createObjectURL(fileOrBlob);
    decodePreview.src = url;
    decodePreview.onload = () => URL.revokeObjectURL(url);
    decodePreviewWrap.classList.remove("hidden");
  }

  btnPickPng.addEventListener("click", (e) => {
    e.stopPropagation();
    decodeFileInput.click();
  });
  decodeDrop.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    decodeFileInput.click();
  });
  decodeFileInput.addEventListener("change", () => {
    if (decodeFileInput.files[0]) setDecodeSource(decodeFileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    decodeDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      decodeDrop.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    decodeDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      decodeDrop.classList.remove("dragover");
    });
  });
  decodeDrop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) setDecodeSource(f);
  });

  btnClearDecode.addEventListener("click", () => {
    decodeFileObj = null;
    decodeFileInput.value = "";
    decodeInfo.classList.add("hidden");
    btnDecode.disabled = true;
    decodeResult.classList.add("hidden");
    decodePreviewWrap.classList.add("hidden");
    revoke(extractedBlobUrl);
    extractedBlobUrl = null;
    setStatus("");
  });

  // ---------- Camera ----------
  async function startCamera() {
    try {
      stopCamera();
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraVideo.srcObject = cameraStream;
      cameraView.classList.remove("hidden");
      decodeDrop.classList.add("hidden");
      setStatus("Point at a PNG and capture", "info");
    } catch (err) {
      console.error(err);
      setStatus("Camera error: " + (err.message || "permission denied"), "error");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraView.classList.add("hidden");
    decodeDrop.classList.remove("hidden");
  }

  btnCamera.addEventListener("click", (e) => {
    e.stopPropagation();
    startCamera();
  });
  btnCloseCamera.addEventListener("click", stopCamera);

  btnCapture.addEventListener("click", () => {
    if (!cameraStream) return;
    const video = cameraVideo;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setStatus("Camera not ready yet", "error");
      return;
    }
    cameraCanvas.width = w;
    cameraCanvas.height = h;
    const ctx = cameraCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    cameraCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("Capture failed", "error");
        return;
      }
      stopCamera();
      setDecodeSource(blob, "camera-capture.png");
      setTimeout(() => decodeFromBlob(blob), 100);
    }, "image/png");
  });

  // ---------- Decode core ----------
  function readPayloadFromImageData(imageData) {
    const px = imageData.data;
    const bytes = [];
    for (let i = 0; i < px.length; i += 4) {
      bytes.push(px[i], px[i + 1], px[i + 2]);
    }
    return new Uint8Array(bytes);
  }

  function parsePayload(bytes) {
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC[i]) {
        throw new Error("Not a valid File↔PNG image (missing magic header)");
      }
    }
    let offset = MAGIC.length;

    const nameLen = (bytes[offset] << 8) | bytes[offset + 1];
    offset += 2;
    if (nameLen > 2048 || offset + nameLen > bytes.length) {
      throw new Error("Invalid filename length");
    }

    const nameBytes = bytes.slice(offset, offset + nameLen);
    const filename = new TextDecoder().decode(nameBytes);
    offset += nameLen;

    if (offset + 4 > bytes.length) throw new Error("Truncated header");
    const dataLen =
      ((bytes[offset] << 24) >>> 0) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    offset += 4;

    if (offset + dataLen > bytes.length) {
      throw new Error("Data length exceeds available pixels");
    }

    const data = bytes.slice(offset, offset + dataLen);
    return { filename, data };
  }

  async function loadImageDataFromBlob(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  async function decodeFromBlob(blob) {
    setStatus("Scanning image…", "info");
    btnDecode.disabled = true;

    try {
      const imageData = await loadImageDataFromBlob(blob);
      const raw = readPayloadFromImageData(imageData);
      const { filename, data } = parsePayload(raw);

      const outBlob = new Blob([data], { type: "application/octet-stream" });
      revoke(extractedBlobUrl);
      extractedBlobUrl = URL.createObjectURL(outBlob);

      extractedName.textContent = filename;
      extractedSize.textContent = formatBytes(data.length);
      extractedType.textContent = guessMime(filename) || "application/octet-stream";

      btnDownloadFile.href = extractedBlobUrl;
      btnDownloadFile.download = filename || "extracted.bin";

      decodeResult.classList.remove("hidden");
      setStatus("File extracted successfully!", "success");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + (err.message || err), "error");
      decodeResult.classList.add("hidden");
    } finally {
      btnDecode.disabled = false;
    }
  }

  function guessMime(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    const map = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
      webp: "image/webp", pdf: "application/pdf", txt: "text/plain",
      json: "application/json", zip: "application/zip", mp3: "audio/mpeg",
      mp4: "video/mp4", webm: "video/webm", html: "text/html", css: "text/css",
      js: "text/javascript", svg: "image/svg+xml",
    };
    return map[ext] || null;
  }

  btnDecode.addEventListener("click", () => {
    if (!decodeFileObj) return;
    decodeFromBlob(decodeFileObj);
  });

  // ---------- Fullscreen ----------
  function openFullscreen(src) {
    if (!src) return;
    fsImg.src = src;
    fsOverlay.classList.remove("hidden");
  }

  btnPreviewFs.addEventListener("click", () => openFullscreen(encodePreview.src));
  btnFullscreenEncode.addEventListener("click", () => openFullscreen(encodePreview.src));
  btnFullscreenDecode.addEventListener("click", () => openFullscreen(decodePreview.src));
  btnFsClose.addEventListener("click", () => {
    fsOverlay.classList.add("hidden");
    fsImg.src = "";
  });
  fsOverlay.addEventListener("click", (e) => {
    if (e.target === fsOverlay) {
      fsOverlay.classList.add("hidden");
      fsImg.src = "";
    }
  });

  // ---------- Init ----------
  setStatus("Ready. Choose a mode above.");
})();
