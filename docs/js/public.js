import { createCreateModeStateCodec } from "./create_mode_state.js";

const RUNTIME_MAP_DB_NAME = "train-editmode-runtime-map";
const RUNTIME_MAP_STORE_NAME = "runtimeMaps";
const RUNTIME_MAP_RECORD_KEY = "public-selected-map";
const RUNTIME_FILE_PREFIXES = {
  st: "構造物",
  ct: "マップ",
  tr: "車両",
};

async function loadMsgpackCodec() {
  const candidates = [
    "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/+esm",
    "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/dist.esm/index.js",
    "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.0.0/dist.esm/index.mjs",
  ];
  for (const url of candidates) {
    try {
      const mod = await import(url);
      if (typeof mod?.encode === "function" && typeof mod?.decode === "function") {
        return { encode: mod.encode, decode: mod.decode };
      }
    } catch (_error) {
      // Try the next candidate.
    }
  }
  throw new Error("msgpack codec の読み込みに失敗しました。");
}

function openRuntimeMapDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(RUNTIME_MAP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNTIME_MAP_STORE_NAME)) {
        db.createObjectStore(RUNTIME_MAP_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function saveRuntimeMapRecord(record) {
  const db = await openRuntimeMapDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RUNTIME_MAP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RUNTIME_MAP_STORE_NAME);
    store.put(record, RUNTIME_MAP_RECORD_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB write failed"));
    };
  });
}

async function readRuntimeMapRecord() {
  const db = await openRuntimeMapDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RUNTIME_MAP_STORE_NAME, "readonly");
    const store = transaction.objectStore(RUNTIME_MAP_STORE_NAME);
    const request = store.get(RUNTIME_MAP_RECORD_KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("IndexedDB read failed"));
    };
  });
}

async function deleteRuntimeMapRecord() {
  const db = await openRuntimeMapDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RUNTIME_MAP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RUNTIME_MAP_STORE_NAME);
    store.delete(RUNTIME_MAP_RECORD_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB delete failed"));
    };
  });
}

(() => {
  const runtimeRole = String(document.body?.dataset?.authRole || "").trim().toLowerCase();
  const runtimeMapMode = runtimeRole === "editor" ? "edit_upload" : "public_upload";
  const RUNTIME_MAP_VIEWER_URL = `./public_local_load.html?runtime_map=${runtimeMapMode}`;
  let readMapDataFilePromise = null;
  let runtimeFiles = {
    st: null,
    ct: null,
    tr: null,
  };
  let featuresGuideActive = false;
  let guideReturnScrollY = 0;
  let featuresWasHiddenBeforeGuide = false;

  const scrollButtons = document.querySelectorAll("[data-scroll-target]");
  const mapCards = document.querySelectorAll(".map-card[data-map-key]");
  const mapModal = document.getElementById("map-modal");
  const mapModalTitle = document.getElementById("map-modal-title");
  const mapModalDesc = document.getElementById("map-modal-desc");
  const mapModalStartBtn = document.getElementById("map-modal-start-btn");
  const mapModalClose = document.getElementById("map-modal-close");
  const mapModalDownloadBtn = document.getElementById("map-modal-download-btn");
  const modalCloseTargets = document.querySelectorAll("[data-modal-close]");
  const showFeaturesBtn = document.getElementById("show-features-btn");
  const floatingFeaturesBtn = document.getElementById("floating-features-btn");
  const featuresSection = document.getElementById("features");
  const heroStartLink = document.getElementById("hero-start-link");
  const editDetailStartLink = document.getElementById("edit-detail-start-world-btn");
  const statusBoard = document.querySelector(".status-board");

  const localStructureFileValue = document.getElementById("local-structure-file-value");
  const localMapFileValue = document.getElementById("local-map-file-value");
  const localTrainFileValue = document.getElementById("local-train-file-value");
  const localMapFileInput = document.getElementById("local-map-file-input");
  const localMapSelectBtn = document.getElementById("local-map-select-btn");
  const localMapStartBtn = document.getElementById("local-map-start-btn");
  const localMapComment = document.getElementById("local-map-comment");

  const startLinks = [heroStartLink, mapModalStartBtn, editDetailStartLink].filter(Boolean);

  function setLocalMapComment(message, type = "info", visible = true) {
    if (!localMapComment) {
      return;
    }
    localMapComment.textContent = message;
    localMapComment.dataset.type = type;
    localMapComment.hidden = !visible || !message;
  }

  function classifyRuntimeFile(fileName) {
    const lowerName = String(fileName || "").trim().toLowerCase();
    if (lowerName.startsWith("st")) { return "st"; }
    if (lowerName.startsWith("ct")) { return "ct"; }
    if (lowerName.startsWith("tr")) { return "tr"; }
    if (lowerName.endsWith(".zip")) { return "st"; }
    return "";
  }

  function normalizeRuntimeFiles(record) {
    if (record?.files && typeof record.files === "object") {
      return {
        st: record.files.st || null,
        ct: record.files.ct || null,
        tr: record.files.tr || null,
      };
    }
    if (record?.buffer && record?.name) {
      return {
        st: null,
        ct: {
          name: record.name,
          type: record.type || "",
          size: Number(record.size) || 0,
          lastModified: Number(record.lastModified) || Date.now(),
          savedAt: Number(record.savedAt) || Date.now(),
          buffer: record.buffer,
        },
        tr: null,
      };
    }
    return {
      st: null,
      ct: null,
      tr: null,
    };
  }

  function getRuntimeFileName(kind) {
    return String(runtimeFiles?.[kind]?.name || "").trim();
  }

  function getMissingRuntimeKinds() {
    return Object.keys(RUNTIME_FILE_PREFIXES).filter((kind) => !runtimeFiles[kind]);
  }

  function getStartValidationMessage() {
    const loadedKinds = Object.keys(RUNTIME_FILE_PREFIXES).filter((kind) => Boolean(runtimeFiles[kind]));
    if (loadedKinds.length > 0) {
      return "";
    }
    return "先頭が st / ct / tr のファイルを1つ以上読み込んでください。";
  }

  function updateRuntimeFileLabels() {
    if (localStructureFileValue) {
      localStructureFileValue.textContent = getRuntimeFileName("st") || "未読込";
    }
    if (localMapFileValue) {
      localMapFileValue.textContent = getRuntimeFileName("ct") || "未読込";
    }
    if (localTrainFileValue) {
      localTrainFileValue.textContent = getRuntimeFileName("tr") || "未読込";
    }
  }

  function setStartButtonsState(enabled) {
    startLinks.forEach((link) => {
      if (!(link instanceof HTMLElement)) {
        return;
      }
      link.classList.toggle("is-disabled", !enabled);
      if (enabled) {
        link.removeAttribute("aria-disabled");
        link.setAttribute("href", RUNTIME_MAP_VIEWER_URL);
      } else {
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("href", RUNTIME_MAP_VIEWER_URL);
      }
    });
    if (localMapStartBtn) {
      localMapStartBtn.classList.toggle("is-disabled", !enabled);
      localMapStartBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
    }
  }

  function updateLocalMapSummary() {
    updateRuntimeFileLabels();
    setStartButtonsState(!getStartValidationMessage());
  }

  function buildRuntimeRecord() {
    return {
      version: 2,
      savedAt: Date.now(),
      files: runtimeFiles,
    };
  }

  async function persistRuntimeFiles() {
    await saveRuntimeMapRecord(buildRuntimeRecord());
  }

  async function ensureMapDataReader() {
    if (!readMapDataFilePromise) {
      readMapDataFilePromise = loadMsgpackCodec().then(({ encode, decode }) => {
        const codec = createCreateModeStateCodec({ encode, decode });
        return codec.readMapDataFile;
      });
    }
    return readMapDataFilePromise;
  }

  async function validateCtRuntimeFile(file) {
    const lowerName = String(file?.name || "").trim().toLowerCase();
    if (lowerName.endsWith(".glb")) {
      return;
    }
    const readMapDataFile = await ensureMapDataReader();
    await readMapDataFile(file);
  }

  async function cacheSelectedRuntimeFiles(fileList) {
    const acceptedKinds = [];
    const rejectedNames = [];

    for (const file of fileList) {
      const kind = classifyRuntimeFile(file?.name || "");
      if (!kind) {
        rejectedNames.push(file?.name || "unknown");
        continue;
      }

      if (kind === "ct") {
        await validateCtRuntimeFile(file);
      }

      const buffer = await file.arrayBuffer();
      runtimeFiles[kind] = {
        name: file.name || "selected file",
        type: file.type || "",
        size: Number(file.size) || 0,
        lastModified: Number(file.lastModified) || Date.now(),
        savedAt: Date.now(),
        buffer,
      };
      acceptedKinds.push(kind);
    }

    if (acceptedKinds.length < 1) {
      const detail = rejectedNames.length > 0
        ? `無効ファイル: ${rejectedNames.join(", ")}`
        : "有効なファイルがありません。";
      throw new Error(`${detail}。先頭が st / ct / tr のファイル名を使用してください。`);
    }

    await persistRuntimeFiles();
    updateLocalMapSummary();

    const updatedLabels = Array.from(new Set(acceptedKinds)).map((kind) => RUNTIME_FILE_PREFIXES[kind]).join(" / ");
    if (rejectedNames.length > 0) {
      setLocalMapComment(`${updatedLabels} を更新しました。無効ファイル: ${rejectedNames.join(", ")}`, "error");
      return;
    }
    setLocalMapComment(`${updatedLabels} を読み込みました。`, "success");
  }

  async function restoreCachedRuntimeMap() {
    try {
      const record = await readRuntimeMapRecord();
      runtimeFiles = normalizeRuntimeFiles(record);
      updateLocalMapSummary();
      setLocalMapComment("", "info", false);
    } catch (_error) {
      runtimeFiles = {
        st: null,
        ct: null,
        tr: null,
      };
      updateLocalMapSummary();
    }
  }

  function setActiveMapCard(card) {
    if (!card) {
      return;
    }
    mapCards.forEach((item) => {
      item.classList.toggle("is-active", item === card);
    });
    if (mapModalTitle) {
      mapModalTitle.textContent = card.dataset.mapTitle || "";
    }
    if (mapModalDesc) {
      mapModalDesc.textContent = card.dataset.mapDesc || "";
    }
  }

  function openMapModal() {
    if (!mapModal) {
      return;
    }
    mapModal.classList.add("is-open");
    mapModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMapModal() {
    if (!mapModal) {
      return;
    }
    mapModal.classList.remove("is-open");
    mapModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function handleStartNavigation(event) {
    const link = event.currentTarget;
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    const validationMessage = getStartValidationMessage();
    if (validationMessage) {
      event.preventDefault();
      closeMapModal();
      setLocalMapComment(validationMessage, "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    link.href = RUNTIME_MAP_VIEWER_URL;
  }

  function handleLocalMapStartButtonClick() {
    const validationMessage = getStartValidationMessage();
    if (validationMessage) {
      setLocalMapComment(validationMessage, "error");
      return;
    }
    setLocalMapComment("", "info", false);
    window.location.href = RUNTIME_MAP_VIEWER_URL;
  }

  function syncFloatingFeaturesButton() {
    if (!showFeaturesBtn || !floatingFeaturesBtn) {
      return;
    }
    const triggerTop = showFeaturesBtn.getBoundingClientRect().bottom;
    floatingFeaturesBtn.classList.toggle("is-visible", triggerTop < 24);
  }

  function syncFeaturesGuideButtonLabel() {
    const nextLabel = featuresGuideActive ? "閲覧方法を閉じる" : "公開ワールドの閲覧方法";
    if (showFeaturesBtn) {
      showFeaturesBtn.textContent = nextLabel;
    }
    if (floatingFeaturesBtn) {
      floatingFeaturesBtn.textContent = nextLabel;
    }
  }

  function setFeaturesGuideHighlight(enabled) {
    if (statusBoard) {
      statusBoard.classList.toggle("features-guide-active", enabled);
    }
    if (featuresSection) {
      featuresSection.classList.toggle("features-guide-active", enabled);
      const cards = featuresSection.querySelectorAll(".feature-card");
      cards.forEach((card) => {
        card.classList.toggle("features-guide-active", enabled);
      });
    }
  }

  function activateFeaturesGuide() {
    if (!featuresSection || !statusBoard) {
      return;
    }
    guideReturnScrollY = window.scrollY || window.pageYOffset || 0;
    featuresWasHiddenBeforeGuide = featuresSection.hidden || featuresSection.classList.contains("is-collapsed");
    featuresSection.hidden = false;
    featuresSection.classList.remove("is-collapsed");
    featuresGuideActive = true;
    setFeaturesGuideHighlight(true);
    syncFeaturesGuideButtonLabel();
    setLocalMapComment("", "info", false);
    statusBoard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deactivateFeaturesGuide() {
    if (!featuresSection) {
      return;
    }
    featuresGuideActive = false;
    setFeaturesGuideHighlight(false);
    if (featuresWasHiddenBeforeGuide) {
      featuresSection.classList.add("is-collapsed");
      featuresSection.hidden = true;
    }
    syncFeaturesGuideButtonLabel();
    window.scrollTo({ top: guideReturnScrollY, behavior: "smooth" });
  }

  function toggleFeaturesGuide() {
    if (featuresGuideActive) {
      deactivateFeaturesGuide();
      return;
    }
    activateFeaturesGuide();
  }

  updateLocalMapSummary();
  setLocalMapComment("", "info", false);
  restoreCachedRuntimeMap();
  syncFeaturesGuideButtonLabel();

  scrollButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selector = button.getAttribute("data-scroll-target");
      if (!selector) {
        return;
      }
      const target = document.querySelector(selector);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  mapCards.forEach((card) => {
    card.addEventListener("click", () => {
      setActiveMapCard(card);
      openMapModal();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActiveMapCard(card);
        openMapModal();
      }
    });
  });

  if (mapModalClose) {
    mapModalClose.addEventListener("click", closeMapModal);
  }
  modalCloseTargets.forEach((target) => {
    target.addEventListener("click", closeMapModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMapModal();
    }
  });

  if (mapCards.length > 0) {
    const preselected = document.querySelector(".map-card.is-active[data-map-key]");
    setActiveMapCard(preselected || mapCards[0]);
  }

  if (showFeaturesBtn) {
    showFeaturesBtn.addEventListener("click", toggleFeaturesGuide);
  }
  if (floatingFeaturesBtn) {
    floatingFeaturesBtn.addEventListener("click", toggleFeaturesGuide);
  }
  if (floatingFeaturesBtn && showFeaturesBtn) {
    syncFloatingFeaturesButton();
    window.addEventListener("scroll", syncFloatingFeaturesButton, { passive: true });
    window.addEventListener("resize", syncFloatingFeaturesButton);
  }

  if (localMapSelectBtn && localMapFileInput) {
    localMapSelectBtn.addEventListener("click", () => {
      localMapFileInput.click();
    });
  }
  if (localMapStartBtn) {
    localMapStartBtn.addEventListener("click", handleLocalMapStartButtonClick);
  }
  if (localMapFileInput) {
    localMapFileInput.addEventListener("change", async (event) => {
      const files = Array.from(event.target?.files || []);
      if (files.length < 1) {
        return;
      }
      setLocalMapComment(`読み込み中: ${files.map((file) => file.name).join(", ")}`, "info");
      try {
        await cacheSelectedRuntimeFiles(files);
      } catch (error) {
        updateLocalMapSummary();
        setLocalMapComment(`読込に失敗しました: ${error?.message || error}`, "error");
      }
    });
  }

  startLinks.forEach((link) => {
    link.addEventListener("click", handleStartNavigation);
  });

  if (mapModalDownloadBtn) {
    mapModalDownloadBtn.addEventListener("click", () => {
      setLocalMapComment("ダウンロード機能はまだ未実装です。手元のファイルを読み込んで表示を開始してください。", "info");
      closeMapModal();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
