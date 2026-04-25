import { createCreateModeStateCodec } from "./create_mode_state.js";

const RUNTIME_MAP_DB_NAME = "train-editmode-runtime-map";
const RUNTIME_MAP_STORE_NAME = "runtimeMaps";
const RUNTIME_MAP_RECORD_KEY = "public-selected-map";
const EDITOR_SLOT_META_STORAGE_KEY = "mouse_demo_editor_slots_v1";
const EDITOR_ZIP_DB_NAME = "mouse-demo-editor-slot-zips";
const EDITOR_ZIP_STORE_NAME = "slotZips";
const EDITOR_THUMBNAIL_DB_NAME = "mouse-demo-editor-slot-thumbnails";
const EDITOR_THUMBNAIL_STORE_NAME = "slotThumbnails";
const SUPABASE_EDITOR_BUCKET = "world-files";
const SUPABASE_STRUCTURE_FILE_NAME = "st_world_data.zip";
const PUBLIC_WORLD_PAGE_SIZE = 6;
const QUOTA_GROUP_STRUCTURE = "structure_download";
const PUBLIC_LIBRARY_ASSET_VALUES = new Set(["st", "ct", "tr"]);
const DEFAULT_EDITOR_SLOT_LIMIT = 3;
const RUNTIME_FILE_PREFIXES = {
  st: "構造物",
  ct: "マップ",
  tr: "車両",
};

function getEditorSlotNumber(slotId) {
  const normalized = String(slotId || "").trim();
  const match = normalized.match(/slot-(\d+)/i);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  return value;
}

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

function openEditorSlotZipDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(EDITOR_ZIP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EDITOR_ZIP_STORE_NAME)) {
        db.createObjectStore(EDITOR_ZIP_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function saveEditorSlotZipRecord(slotId, record) {
  const db = await openEditorSlotZipDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_ZIP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(EDITOR_ZIP_STORE_NAME);
    store.put(record, slotId);
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

async function readEditorSlotZipRecord(slotId) {
  const db = await openEditorSlotZipDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_ZIP_STORE_NAME, "readonly");
    const store = transaction.objectStore(EDITOR_ZIP_STORE_NAME);
    const request = store.get(slotId);
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

async function saveEditorSlotRuntimeRecord(slotId, record) {
  const normalizedFiles = record?.files && typeof record.files === "object"
    ? {
      st: record.files.st || null,
      ct: record.files.ct || null,
      tr: Array.isArray(record.files.tr) ? record.files.tr.filter(Boolean) : [],
    }
    : { st: null, ct: null, tr: [] };
  const nextRecord = {
    version: 2,
    savedAt: record?.savedAt || new Date().toISOString(),
    files: normalizedFiles,
    meta: record?.meta && typeof record.meta === "object" ? { ...record.meta } : {},
  };
  await saveEditorSlotZipRecord(slotId, nextRecord);
  return nextRecord;
}

function openEditorSlotThumbnailDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(EDITOR_THUMBNAIL_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EDITOR_THUMBNAIL_STORE_NAME)) {
        db.createObjectStore(EDITOR_THUMBNAIL_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function readEditorSlotThumbnailRecord(slotId) {
  const db = await openEditorSlotThumbnailDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_THUMBNAIL_STORE_NAME, "readonly");
    const store = transaction.objectStore(EDITOR_THUMBNAIL_STORE_NAME);
    const request = store.get(slotId);
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
  let fallbackMapDataAvailable = false;
  let featuresGuideActive = false;
  let guideReturnScrollY = 0;
  let featuresWasHiddenBeforeGuide = false;

  const scrollButtons = document.querySelectorAll("[data-scroll-target]");
  const mapCards = document.querySelectorAll(".map-card[data-map-key]");
  const mapModal = document.getElementById("map-modal");
  const mapModalTitle = document.getElementById("map-modal-title");
  const mapModalMeta = document.getElementById("map-modal-meta");
  const mapModalDesc = document.getElementById("map-modal-desc");
  const mapModalThumbnail = document.getElementById("map-modal-thumbnail");
  const mapModalThumbnailEmpty = document.getElementById("map-modal-thumbnail-empty");
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
  const structureWorldIdInput = document.getElementById("structure-world-id-input");
  const loadStructureWorldBtn = document.getElementById("load-structure-world-btn");
  const localMapFileInput = document.getElementById("local-map-file-input");
  const localMapSelectBtn = document.getElementById("local-map-select-btn");
  const localMapStartBtn = document.getElementById("local-map-start-btn");
  const localMapComment = document.getElementById("local-map-comment");
  const publicStructureQuotaValue = document.getElementById("public-structure-quota-value");
  const publicStructureQuotaNote = document.getElementById("public-structure-quota-note");
  const publicStructureQuotaPanel = document.getElementById("public-structure-quota-panel");
  const editStructureQuotaValue = document.getElementById("edit-structure-quota-value");
  const editStructureQuotaNote = document.getElementById("edit-structure-quota-note");
  const editStructureQuotaPanel = document.getElementById("edit-structure-quota-panel");
  const publicSharedQuotaPanel = document.getElementById("public-shared-quota-panel");
  const viewerAuthLocked = document.getElementById("viewer-auth-locked");
  const viewerArea = document.getElementById("viewer-area");
  const modelLibrarySection = document.getElementById("model-library");
  const modelLibraryBody = document.getElementById("model-library-body");
  const publicLibraryAssetButtons = Array.from(document.querySelectorAll("[data-library-asset]"));
  const editorAuthLocked = document.getElementById("editor-auth-locked");
  const editLab = document.getElementById("edit-lab");
  const publicMapGrid = document.getElementById("public-map-grid");
  const publicMapStatus = document.getElementById("public-map-status");
  const publicMapPagination = document.getElementById("public-map-pagination");
  const viewerMetaValue = document.getElementById("viewer-meta-value");
  const editGrid = document.getElementById("edit-grid");
  const detailTitle = document.getElementById("detail-title");
  const detailTitleEditBtn = document.getElementById("detail-title-edit-btn");
  const detailTitleInput = document.getElementById("detail-title-input");
  const detailDesc = document.getElementById("detail-desc");
  const editSaveNote = document.getElementById("edit-save-note");
  const saveSlotZipBtn = document.getElementById("save-slot-zip-btn");
  const resumeWorldBtn = document.getElementById("resume-world-btn");
  const slotZipFileInput = document.getElementById("slot-zip-file-input");
  const publishWorldBtn = document.getElementById("publish-world-btn");
  const slotZipName = document.getElementById("slot-zip-name");
  const slotCityName = document.getElementById("slot-city-name");
  const slotTrainName = document.getElementById("slot-train-name");
  const slotZipSavedAt = document.getElementById("slot-zip-saved-at");
  const slotThumbnailPreview = document.getElementById("slot-thumbnail-preview");
  const slotThumbnailEmpty = document.getElementById("slot-thumbnail-empty");

  const startLinks = [heroStartLink, mapModalStartBtn, editDetailStartLink].filter(Boolean);
  const isPublicPage = Boolean(viewerArea && publicMapGrid);
  const isEditorPage = Boolean(editLab && editGrid);
  let editorSlotsState = [];
  let activeEditorSlotId = "slot-01";
  let editorSlotLimit = DEFAULT_EDITOR_SLOT_LIMIT;
  const editorSlotThumbnailState = new Map();
  let isEditingEditorSlotTitle = false;
  let publicViewerPage = 1;
  let publicViewerTotalPages = 1;
  let publicViewerSelectedWorld = null;
  let currentPublicLibraryAsset = "st";

  function createEditorSlotTemplate(slotNumber) {
    const numericSlot = Number.isFinite(slotNumber) ? Math.max(1, Math.floor(slotNumber)) : 1;
    const padded = String(numericSlot).padStart(2, "0");
    return {
      slotId: `slot-${padded}`,
      label: `SLOT ${padded}`,
      title: `WORLD_${numericSlot}`,
      status: "private",
    };
  }

  function normalizeEditorSlotLimit(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_EDITOR_SLOT_LIMIT;
    }
    return Math.min(99, Math.max(1, parsed));
  }

  function createDefaultEditorSlots(limit = DEFAULT_EDITOR_SLOT_LIMIT) {
    return Array.from({ length: normalizeEditorSlotLimit(limit) }, (_, index) => {
      const slot = createEditorSlotTemplate(index + 1);
      return {
        ...slot,
      fileName: "",
      fileSize: 0,
      cityFileName: "",
      trainFileCount: 0,
      savedAt: "",
      worldId: "",
      originId: "self",
      uploadedPath: "",
      uploadedAt: "",
      thumbnailCapturedAt: "",
      remoteWorldId: "",
      remoteOriginId: "",
      remoteTitle: "",
      remoteStatus: "",
      remoteThumbnailPath: "",
      remoteThumbnailUrl: "",
      remoteUpdatedAt: "",
      };
    });
  }

  function getDefaultEditorSlotTitle(slotId) {
    const slotNumber = getEditorSlotNumber(slotId);
    return createEditorSlotTemplate(slotNumber || 1).title;
  }

  async function fetchEditorSlotLimit() {
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    const session = await supabaseBridge?.getSession?.();
    const userId = String(session?.user?.id || "").trim();
    if (!supabaseClient || !userId) {
      return DEFAULT_EDITOR_SLOT_LIMIT;
    }
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("editor_slot_limit")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[editor] failed to load editor_slot_limit", error);
      return DEFAULT_EDITOR_SLOT_LIMIT;
    }
    return normalizeEditorSlotLimit(data?.editor_slot_limit);
  }

  function loadEditorSlotsMeta(limit = editorSlotLimit) {
    try {
      const raw = window.localStorage.getItem(EDITOR_SLOT_META_STORAGE_KEY);
      if (!raw) {
        return createDefaultEditorSlots(limit);
      }
      const parsed = JSON.parse(raw);
      const slotMap = new Map(
        Array.isArray(parsed)
          ? parsed
            .filter((slot) => slot && typeof slot === "object")
            .map((slot) => [String(slot.slotId || ""), slot])
          : []
      );
      return createDefaultEditorSlots(limit).map((slot) => {
        const saved = slotMap.get(slot.slotId) || {};
        return {
          ...slot,
          title: typeof saved.title === "string" && saved.title.trim() ? saved.title : slot.title,
          status: typeof saved.status === "string" && saved.status.trim() ? saved.status : slot.status,
          fileName: "",
          fileSize: 0,
          cityFileName: typeof saved.cityFileName === "string" ? saved.cityFileName : "",
          trainFileCount: Number(saved.trainFileCount) || 0,
          savedAt: typeof saved.savedAt === "string" ? saved.savedAt : "",
          worldId: typeof saved.worldId === "string" ? saved.worldId : "",
          originId: "self",
          uploadedPath: typeof saved.uploadedPath === "string" ? saved.uploadedPath : "",
          uploadedAt: typeof saved.uploadedAt === "string" ? saved.uploadedAt : "",
          thumbnailCapturedAt: typeof saved.thumbnailCapturedAt === "string" ? saved.thumbnailCapturedAt : "",
          remoteWorldId: "",
          remoteOriginId: "",
          remoteTitle: "",
          remoteStatus: "",
          remoteThumbnailPath: "",
          remoteThumbnailUrl: "",
          remoteUpdatedAt: "",
        };
      });
    } catch (_error) {
      return createDefaultEditorSlots(limit);
    }
  }

  function persistEditorSlotsMeta() {
    window.localStorage.setItem(
      EDITOR_SLOT_META_STORAGE_KEY,
      JSON.stringify(editorSlotsState.map((slot) => ({
        slotId: slot.slotId,
        title: slot.title,
        status: slot.status,
        cityFileName: slot.cityFileName,
        trainFileCount: slot.trainFileCount,
        savedAt: slot.savedAt,
        worldId: slot.worldId,
        uploadedPath: slot.uploadedPath,
        uploadedAt: slot.uploadedAt,
        thumbnailCapturedAt: slot.thumbnailCapturedAt,
      })))
    );
  }

  function getEditorSlotById(slotId) {
    return editorSlotsState.find((slot) => slot.slotId === slotId) || null;
  }

  function buildActiveEditorSlotRuntimeMeta(slot, overrides = {}) {
    return {
      slotId: String(overrides.slotId || slot?.slotId || "").trim(),
      worldId: String(overrides.worldId || slot?.worldId || "").trim(),
      originId: String(overrides.originId || slot?.originId || "self").trim() || "self",
      title: String(overrides.title || slot?.title || "").trim(),
      thumbnailPath: String(overrides.thumbnailPath || slot?.remoteThumbnailPath || "").trim(),
    };
  }

  async function syncActiveEditorSlotRuntimeFilesToLoader() {
    if (!isEditorPage) {
      return;
    }
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      return;
    }
    const rawSlotRecord = await readEditorSlotZipRecord(activeSlot.slotId).catch(() => null);
    const slotRecord = normalizeEditorSlotRuntimeRecord(rawSlotRecord);
    runtimeFiles = {
      st: slotRecord.st || null,
      ct: slotRecord.ct || null,
      tr: Array.isArray(slotRecord.tr) ? slotRecord.tr : [],
    };
    activeSlot.fileName = String(slotRecord.st?.name || "").trim();
    activeSlot.fileSize = Number(slotRecord.st?.size) || 0;
    activeSlot.cityFileName = String(slotRecord.ct?.name || "").trim();
    activeSlot.trainFileCount = Array.isArray(slotRecord.tr) ? slotRecord.tr.length : 0;
    activeSlot.savedAt = typeof rawSlotRecord?.savedAt === "string" ? rawSlotRecord.savedAt : String(activeSlot.savedAt || "");
    if (structureWorldIdInput) {
      structureWorldIdInput.value = activeSlot.originId && activeSlot.originId !== "self" ? activeSlot.originId : "";
    }
    renderEditorSlots();
    updateLocalMapSummary();
  }

  function getEditorSlotDisplayTitle(slot) {
    return String(slot?.title || slot?.remoteTitle || "").trim() || "Untitled World";
  }

  function getEditorSlotDisplayStatus(slot) {
    return String(slot?.remoteStatus || slot?.status || "private").trim() || "private";
  }

  function getEditorSlotThumbnailData(slot) {
    const localRecord = editorSlotThumbnailState.get(String(slot?.slotId || "").trim()) || null;
    const localDataUrl = String(localRecord?.dataUrl || "").trim();
    if (localDataUrl) {
      return { src: localDataUrl, isRemote: false };
    }
    const remoteUrl = String(slot?.remoteThumbnailUrl || "").trim();
    if (remoteUrl) {
      return { src: remoteUrl, isRemote: true };
    }
    return { src: "", isRemote: false };
  }

  function hasAvailableThumbnail(slot) {
    const slotId = String(slot?.slotId || "").trim();
    return Boolean(editorSlotThumbnailState.get(slotId)?.blob)
      || Boolean(slot?.thumbnailCapturedAt)
      || Boolean(String(slot?.remoteThumbnailPath || "").trim())
      || Boolean(String(slot?.remoteThumbnailUrl || "").trim());
  }

  function formatSavedAt(value) {
    if (!value) {
      return "未保存";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function triggerBrowserDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setEditSaveNote(message, type = "info") {
    if (!editSaveNote) {
      return;
    }
    editSaveNote.textContent = message;
    editSaveNote.dataset.type = type;
  }

  async function refreshEditorSlotThumbnails() {
    if (!isEditorPage) {
      return;
    }
    const results = await Promise.all(
      editorSlotsState.map(async (slot) => {
        const record = await readEditorSlotThumbnailRecord(slot.slotId).catch(() => null);
        return [slot.slotId, record];
      })
    );
    editorSlotThumbnailState.clear();
    results.forEach(([slotId, record]) => {
      if (record) {
        editorSlotThumbnailState.set(slotId, record);
      }
    });
    renderEditorSlots();
  }

  async function fetchAndBindOwnWorldSummaries() {
    if (!isEditorPage) {
      return;
    }
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      return;
    }
    const session = await supabaseBridge.getSession();
    const userId = String(session?.user?.id || "").trim();
    if (!userId) {
      editorSlotsState.forEach((slot) => {
        slot.remoteWorldId = "";
        slot.remoteOriginId = "";
        slot.remoteTitle = "";
        slot.remoteStatus = "";
        slot.remoteThumbnailPath = "";
        slot.remoteThumbnailUrl = "";
        slot.remoteUpdatedAt = "";
      });
      renderEditorSlots();
      return;
    }

    const { data, error } = await supabaseClient
      .from("worlds")
      .select("id, slot, origin_id, title, status, thumbnail_path, updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) {
      setEditSaveNote(`自分の投稿情報の取得に失敗しました: ${error.message || error}`, "error");
      return;
    }

    const remoteItems = Array.isArray(data)
      ? await Promise.all(data.map(async (record) => {
        const thumbnailPath = String(record?.thumbnail_path || "").trim();
        return {
          id: String(record?.id || "").trim(),
          slot: Number(record?.slot) || 0,
          originId: String(record?.origin_id || "").trim() || "self",
          title: String(record?.title || "").trim(),
          status: String(record?.status || "").trim(),
          updatedAt: String(record?.updated_at || "").trim(),
          thumbnailPath,
          thumbnailUrl: thumbnailPath ? await getSignedStorageUrl(thumbnailPath, 60 * 10) : "",
        };
      }))
      : [];

    const remoteBySlot = new Map(
      remoteItems
        .filter((item) => item && item.slot > 0)
        .map((item) => [item.slot, item])
    );

    let hasTitleUpdates = false;
    editorSlotsState.forEach((slot) => {
      const slotNumber = getEditorSlotNumber(slot.slotId);
      const remote = slotNumber ? (remoteBySlot.get(slotNumber) || null) : null;
      const defaultTitle = getDefaultEditorSlotTitle(slot.slotId);
      const currentTitle = String(slot.title || "").trim();
      const previousRemoteTitle = String(slot.remoteTitle || "").trim();
      slot.remoteWorldId = String(remote?.id || "").trim();
      slot.remoteOriginId = String(remote?.originId || "").trim() || "self";
      slot.remoteTitle = String(remote?.title || "").trim();
      slot.remoteStatus = String(remote?.status || "").trim();
      slot.remoteThumbnailPath = String(remote?.thumbnailPath || "").trim();
      slot.remoteThumbnailUrl = String(remote?.thumbnailUrl || "").trim();
      slot.remoteUpdatedAt = String(remote?.updatedAt || "").trim();
      if (slot.remoteTitle && (!currentTitle || currentTitle === defaultTitle || currentTitle === previousRemoteTitle)) {
        slot.title = slot.remoteTitle;
        hasTitleUpdates = true;
      }
    });
    if (hasTitleUpdates) {
      persistEditorSlotsMeta();
    }
    renderEditorSlots();
  }

  function syncPublishButtonState(slot) {
    if (!publishWorldBtn) {
      return;
    }
    const hasThumbnail = hasAvailableThumbnail(slot);
    const enabled = Boolean(slot?.fileName) && hasThumbnail;
    publishWorldBtn.disabled = !enabled;
    publishWorldBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function syncResumeWorldButtonState(slot) {
    if (!resumeWorldBtn) {
      return;
    }
    const hasRemoteWorld = Boolean(String(slot?.remoteWorldId || "").trim());
    resumeWorldBtn.hidden = !hasRemoteWorld;
    resumeWorldBtn.disabled = !hasRemoteWorld;
    resumeWorldBtn.setAttribute("aria-disabled", hasRemoteWorld ? "false" : "true");
  }

  function setEditorTitleEditingState(editing) {
    isEditingEditorSlotTitle = Boolean(editing && detailTitleInput && detailTitle);
    if (detailTitle) {
      detailTitle.hidden = isEditingEditorSlotTitle;
    }
    if (detailTitleInput) {
      detailTitleInput.hidden = !isEditingEditorSlotTitle;
    }
    if (detailTitleEditBtn) {
      detailTitleEditBtn.setAttribute("aria-pressed", isEditingEditorSlotTitle ? "true" : "false");
      detailTitleEditBtn.setAttribute("aria-label", isEditingEditorSlotTitle ? "タイトル編集を確定" : "タイトルを編集");
      detailTitleEditBtn.title = isEditingEditorSlotTitle ? "タイトル編集を確定" : "タイトルを編集";
    }
  }

  function startEditingActiveEditorSlotTitle() {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot || !detailTitleInput) {
      return;
    }
    detailTitleInput.value = String(activeSlot.title || activeSlot.remoteTitle || "").trim();
    setEditorTitleEditingState(true);
    window.setTimeout(() => {
      detailTitleInput.focus();
      detailTitleInput.select();
    }, 0);
  }

  function commitActiveEditorSlotTitle() {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot || !detailTitleInput) {
      setEditorTitleEditingState(false);
      renderEditorSlots();
      return;
    }
    const fallbackTitle = String(activeSlot.remoteTitle || "").trim() || getDefaultEditorSlotTitle(activeSlot.slotId);
    const nextTitle = String(detailTitleInput.value || "").trim() || fallbackTitle;
    const changed = nextTitle !== String(activeSlot.title || "").trim();
    activeSlot.title = nextTitle;
    setEditorTitleEditingState(false);
    if (changed) {
      persistEditorSlotsMeta();
      renderEditorSlots();
      setEditSaveNote(`${activeSlot.label} のタイトルを「${nextTitle}」に更新しました。`, "success");
      return;
    }
    renderEditorSlots();
  }

  function cancelActiveEditorSlotTitleEdit() {
    if (!isEditingEditorSlotTitle) {
      return;
    }
    setEditorTitleEditingState(false);
    renderEditorSlots();
  }

  function renderEditorSlotButtons() {
    if (!isEditorPage || !editGrid) {
      return;
    }
    editGrid.textContent = "";
    editorSlotsState.forEach((slot) => {
      const button = document.createElement("button");
      button.className = "edit-slot";
      button.type = "button";
      button.setAttribute("role", "listitem");
      button.dataset.slot = slot.slotId;

      const slotId = document.createElement("span");
      slotId.className = "slot-id";
      slotId.textContent = slot.label;

      const slotThumb = document.createElement("span");
      slotThumb.className = "slot-thumb";
      slotThumb.setAttribute("aria-hidden", "true");
      const thumbImg = document.createElement("img");
      thumbImg.setAttribute("data-slot-thumb-image", "");
      thumbImg.alt = "";
      thumbImg.hidden = true;
      slotThumb.append(thumbImg);

      const title = document.createElement("strong");
      title.setAttribute("data-slot-title", "");

      const status = document.createElement("span");
      status.className = "slot-private";

      button.append(slotId, slotThumb, title, status);
      editGrid.append(button);
    });
  }

  function renderEditorSlots() {
    if (!isEditorPage) {
      return;
    }
    renderEditorSlotButtons();
    const editSlots = Array.from(editGrid?.querySelectorAll(".edit-slot[data-slot]") || []);
    editSlots.forEach((button) => {
      const slot = getEditorSlotById(button.dataset.slot || "");
      if (!slot) {
        return;
      }
      const titleEl = button.querySelector("[data-slot-title]");
      const thumbImg = button.querySelector("[data-slot-thumb-image]");
      if (titleEl) {
        titleEl.textContent = getEditorSlotDisplayTitle(slot);
      }
      const thumbnailData = getEditorSlotThumbnailData(slot);
      if (thumbImg instanceof HTMLImageElement) {
        if (thumbnailData.src) {
          thumbImg.src = thumbnailData.src;
          thumbImg.hidden = false;
        } else {
          thumbImg.removeAttribute("src");
          thumbImg.hidden = true;
        }
      }
      button.classList.toggle("is-active", slot.slotId === activeEditorSlotId);
      button.classList.toggle("has-saved-zip", Boolean(slot.fileName));
      const statusEl = button.querySelector(".slot-private");
      if (statusEl) {
        const slotStatusText = slot.remoteWorldId
          ? getEditorSlotDisplayStatus(slot)
          : slot.uploadedAt
          ? "private / uploaded"
          : slot.thumbnailCapturedAt
            ? "private / thumbnail-ready"
          : slot.fileName
            ? "private / saved"
            : slot.status;
        statusEl.textContent = slotStatusText;
        statusEl.classList.toggle("is-published", /published/i.test(String(slotStatusText || "")));
      }
    });

    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      return;
    }
    if (detailTitle) {
      detailTitle.textContent = `${activeSlot.label} / ${getEditorSlotDisplayTitle(activeSlot)}`;
    }
    if (detailTitleInput && !isEditingEditorSlotTitle) {
      detailTitleInput.value = getEditorSlotDisplayTitle(activeSlot);
    }
    if (detailDesc) {
      const statusLabel = getEditorSlotDisplayStatus(activeSlot);
      const detailStatusClass = /published/i.test(String(statusLabel || "")) ? "detail-private is-published" : "detail-private";
      const localTitle = String(activeSlot.title || "").trim();
      const remoteTitle = String(activeSlot.remoteTitle || "").trim();
      const titleInfo = activeSlot.remoteWorldId
        ? remoteTitle && remoteTitle !== localTitle
          ? `<br>公開中タイトル: ${remoteTitle}<br>次回公開タイトル: ${getEditorSlotDisplayTitle(activeSlot)}`
          : `<br>投稿タイトル: ${getEditorSlotDisplayTitle(activeSlot)}`
        : "";
      const remoteInfo = activeSlot.remoteWorldId
        ? `${titleInfo}<br>公開情報: ${statusLabel}${activeSlot.remoteUpdatedAt ? `<br>最終更新: ${formatSavedAt(activeSlot.remoteUpdatedAt)}` : ""}`
        : "";
      detailDesc.innerHTML = activeSlot.fileName
        ? `公開前の編集ワールドです。現在の状態: <span class="${detailStatusClass}">${statusLabel}</span>${remoteInfo}<br>構造物: ${activeSlot.fileName}${activeSlot.cityFileName ? `<br>都市: ${activeSlot.cityFileName}` : `<br>都市: 未保存`}<br>車両: ${activeSlot.trainFileCount > 0 ? `${activeSlot.trainFileCount}件` : "未保存"}${activeSlot.thumbnailCapturedAt ? `<br>サムネ設定: ${formatSavedAt(activeSlot.thumbnailCapturedAt)}` : String(activeSlot.remoteThumbnailPath || "").trim() ? `<br>サムネ設定: Supabase 保存済み` : `<br>サムネ設定: 未設定`}${activeSlot.uploadedAt ? `<br>Supabase 保存先: ${activeSlot.uploadedPath}` : ""}`
        : activeSlot.remoteWorldId
          ? `自分の投稿情報を読み込みました。現在の状態: <span class="${detailStatusClass}">${statusLabel}</span>${remoteInfo}<br>このスロットに構造物データはまだ取り込まれていません。`
          : `公開前の編集ワールドです。現在の状態: <span class="${detailStatusClass}">${statusLabel}</span><br>このスロットにはまだ構造物データが取り込まれていません。`;
    }
    if (slotZipName) {
      slotZipName.textContent = activeSlot.fileName || "未保存";
      slotZipName.classList.toggle("meta-value-empty", !activeSlot.fileName);
    }
    if (slotCityName) {
      slotCityName.textContent = activeSlot.cityFileName || "未保存";
      slotCityName.classList.toggle("meta-value-empty", !activeSlot.cityFileName);
    }
    if (slotTrainName) {
      slotTrainName.textContent = activeSlot.trainFileCount > 0 ? `${activeSlot.trainFileCount}件` : "未保存";
      slotTrainName.classList.toggle("meta-value-empty", activeSlot.trainFileCount < 1);
    }
    if (slotZipSavedAt) {
      slotZipSavedAt.textContent = formatSavedAt(activeSlot.savedAt);
      slotZipSavedAt.classList.toggle("meta-value-empty", !activeSlot.savedAt);
    }
    const activeThumbnailData = getEditorSlotThumbnailData(activeSlot);
    if (slotThumbnailPreview instanceof HTMLImageElement) {
      if (activeThumbnailData.src) {
        slotThumbnailPreview.src = activeThumbnailData.src;
        slotThumbnailPreview.hidden = false;
      } else {
        slotThumbnailPreview.removeAttribute("src");
        slotThumbnailPreview.hidden = true;
      }
    }
    if (slotThumbnailEmpty) {
      slotThumbnailEmpty.hidden = Boolean(activeThumbnailData.src);
    }
    syncPublishButtonState(activeSlot);
    syncResumeWorldButtonState(activeSlot);
  }

  function normalizeEditorSlotRuntimeRecord(record) {
    if (record?.files && typeof record.files === "object") {
      return {
        st: record.files.st || null,
        ct: record.files.ct || null,
        tr: Array.isArray(record.files.tr) ? record.files.tr.filter(Boolean) : [],
        meta: record?.meta && typeof record.meta === "object" ? { ...record.meta } : {},
      };
    }
    if (record?.buffer && record?.name) {
      return {
        st: {
          name: record.name,
          type: record.type || "application/zip",
          size: Number(record.size) || 0,
          savedAt: record.savedAt || new Date().toISOString(),
          buffer: record.buffer,
        },
        ct: null,
        tr: [],
        meta: {},
      };
    }
    return { st: null, ct: null, tr: [], meta: {} };
  }

  function validateSlotStructureFile(file) {
    const name = String(file?.name || "").trim();
    const lowerName = name.toLowerCase();
    if (!lowerName.endsWith(".zip") || !lowerName.startsWith("st_")) {
      throw new Error("構造物データには先頭が st_ の zip ファイルを指定してください。");
    }
    if ((Number(file?.size) || 0) <= 0) {
      throw new Error("空の zip ファイルは保存できません。");
    }
  }

  async function saveRuntimeFilesToActiveEditorSlot(files) {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      throw new Error("保存先スロットが見つかりません。");
    }
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (selectedFiles.length < 1) {
      throw new Error("保存するファイルが選択されていません。");
    }

    const nextFiles = { st: null, ct: null, tr: [] };
    const invalidNames = [];

    for (const file of selectedFiles) {
      const kind = classifyRuntimeFile(file?.name || "");
      if (!kind) {
        invalidNames.push(file?.name || "unknown");
        continue;
      }
      if (kind === "st") {
        validateSlotStructureFile(file);
      }
      if (kind === "ct") {
        await validateCtRuntimeFile(file);
      }
      const buffer = await file.arrayBuffer();
      const entry = {
        name: file.name || "selected file",
        type: file.type || "",
        size: Number(file.size) || 0,
        lastModified: Number(file.lastModified) || Date.now(),
        savedAt: Date.now(),
        buffer,
      };
      if (kind === "tr") {
        nextFiles.tr.push(entry);
      } else {
        nextFiles[kind] = entry;
      }
    }

    if (!nextFiles.st) {
      const suffix = invalidNames.length > 0 ? ` 無効ファイル: ${invalidNames.join(", ")}` : "";
      throw new Error(`構造物データ st_*.zip が必要です。${suffix}`.trim());
    }

    const savedAt = new Date().toISOString();
    await saveEditorSlotZipRecord(activeSlot.slotId, {
      savedAt,
      files: nextFiles,
    });
    activeSlot.fileName = nextFiles.st.name;
    activeSlot.fileSize = Number(nextFiles.st.size) || 0;
    activeSlot.cityFileName = nextFiles.ct?.name || "";
    activeSlot.trainFileCount = Array.isArray(nextFiles.tr) ? nextFiles.tr.length : 0;
    activeSlot.savedAt = savedAt;
    persistEditorSlotsMeta();
    renderEditorSlots();
    const saveSummary = [
      `構造物: ${nextFiles.st.name}`,
      nextFiles.ct?.name ? `都市: ${nextFiles.ct.name}` : "都市: なし",
      nextFiles.tr?.length ? `車両: ${nextFiles.tr.length}件` : "車両: なし",
    ];
    setEditSaveNote(`${activeSlot.label} に保存しました。${saveSummary.join(" / ")}`, "success");
  }

  async function openThumbnailCaptureWorldForActiveSlot(event) {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      if (event) {
        event.preventDefault();
      }
      setEditSaveNote("対象スロットが見つかりません。", "error");
      return;
    }
    let slotRecord = normalizeEditorSlotRuntimeRecord(await readEditorSlotZipRecord(activeSlot.slotId).catch(() => null));
    if (!slotRecord?.st?.buffer && String(activeSlot.remoteWorldId || "").trim()) {
      await loadStructureWorldFromSupabaseById(activeSlot.remoteWorldId, {
        syncDraft: false,
        originMode: "preserve",
        reserveUsageType: "thumbnail_resume",
      });
      slotRecord = normalizeEditorSlotRuntimeRecord(await readEditorSlotZipRecord(activeSlot.slotId).catch(() => null));
    }
    if (!slotRecord?.st?.buffer) {
      if (event) {
        event.preventDefault();
      }
      setEditSaveNote("保存済み構造物データが見つかりません。先に構造物を読み込んでください。", "error");
      return;
    }

    await saveRuntimeMapRecord({
      version: 2,
      savedAt: Date.now(),
      files: {
        st: slotRecord.st,
        ct: slotRecord.ct || null,
        tr: Array.isArray(slotRecord.tr) ? slotRecord.tr : [],
      },
      meta: buildActiveEditorSlotRuntimeMeta(activeSlot, slotRecord.meta || {}),
    });

    const nextUrl = `./public_local_load.html?runtime_map=edit_upload&thumbnail_mode=1&slot=${encodeURIComponent(activeSlot.slotId)}`;
    if (event?.currentTarget instanceof HTMLAnchorElement) {
      event.currentTarget.href = nextUrl;
    }
    window.location.href = nextUrl;
  }

  async function updateWorldMetadataForActiveSlot({
    thumbnailPath,
    publish = false,
  }) {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      throw new Error("Supabase 認証の初期化が完了していません。");
    }

    const session = await supabaseBridge.getSession();
    const userId = String(session?.user?.id || "").trim();
    if (!userId) {
      throw new Error("ログイン状態を確認できませんでした。");
    }

    const description = `${activeSlot.label} uploaded from editor-lab`;
    const slotNumber = getEditorSlotNumber(activeSlot.slotId);
    if (!slotNumber) {
      throw new Error("保存先スロット番号を特定できませんでした。");
    }
    if (!String(activeSlot.worldId || "").trim()) {
      throw new Error("先にワールド保存を実行してください。");
    }
    const metadataArgs = {
      p_world_id: activeSlot.worldId,
      p_title: activeSlot.title,
      p_description: description,
      p_status: "draft",
      p_thumbnail_path: thumbnailPath,
      p_thumbnail_bytes: 0,
      p_origin_id: String(activeSlot.originId || "self").trim() || "self",
      p_slot: slotNumber,
    };
    const { data: worldData, error: rpcError } = await supabaseClient.rpc("update_world_metadata", metadataArgs);

    if (rpcError) {
      persistEditorSlotsMeta();
      renderEditorSlots();
      throw new Error(rpcError.message || "ワールド情報の保存に失敗しました。");
    }

    const nextWorldId = String(worldData?.id || activeSlot.worldId || "").trim();
    if (!nextWorldId) {
      throw new Error("保存したワールドIDを取得できませんでした。");
    }

    let finalWorldId = nextWorldId;
    if (publish) {
      const { data: publishedWorld, error: publishError } = await supabaseClient.rpc("publish_world", {
        p_world_id: nextWorldId,
      });
      if (publishError) {
        throw new Error(publishError.message || "ワールドの公開に失敗しました。");
      }
      finalWorldId = String(publishedWorld?.id || nextWorldId).trim();
    }

    activeSlot.uploadedAt = new Date().toISOString();
    activeSlot.worldId = finalWorldId;
    persistEditorSlotsMeta();
    renderEditorSlots();
    return finalWorldId;
  }

  async function saveActiveEditorSlotToSupabase({ publish = false } = {}) {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      throw new Error("保存先スロットが見つかりません。");
    }
    const slotRecord = normalizeEditorSlotRuntimeRecord(await readEditorSlotZipRecord(activeSlot.slotId));
    const zipRecord = slotRecord.st;
    if (!zipRecord?.buffer) {
      throw new Error("保存済み構造物データが見つかりません。ワールド編集画面で先にワールド保存してください。");
    }
    activeSlot.fileName = String(zipRecord.name || SUPABASE_STRUCTURE_FILE_NAME).trim() || SUPABASE_STRUCTURE_FILE_NAME;
    activeSlot.fileSize = Number(zipRecord.size) || 0;
    activeSlot.originId = String(activeSlot.originId || "").trim() || "self";
    const thumbnailRecord = editorSlotThumbnailState.get(activeSlot.slotId) || await readEditorSlotThumbnailRecord(activeSlot.slotId);
    const existingThumbnailPath = String(activeSlot.remoteThumbnailPath || "").trim();
    const hasLocalThumbnailBlob = Boolean(thumbnailRecord?.blob);
    if (publish && !hasLocalThumbnailBlob && !existingThumbnailPath) {
      throw new Error("先にサムネを撮影して保存してください。");
    }

    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      throw new Error("Supabase 認証の初期化が完了していません。");
    }
    const session = await supabaseBridge.getSession();
    const userId = String(session?.user?.id || "").trim();
    if (!userId) {
      throw new Error("ログイン状態を確認できませんでした。");
    }
    if (!String(activeSlot.worldId || "").trim()) {
      throw new Error("先にワールド保存を実行してください。");
    }

    const thumbnailPath = hasLocalThumbnailBlob
      ? `worlds/${userId}/${activeSlot.slotId}/thumbnail.webp`
      : existingThumbnailPath;
    const thumbnailBlob = hasLocalThumbnailBlob
      ? (thumbnailRecord.blob instanceof Blob
        ? thumbnailRecord.blob
        : new Blob([thumbnailRecord.blob], { type: thumbnailRecord.mimeType || "image/webp" }))
      : null;

    if (thumbnailBlob) {
      const { error: thumbnailUploadError } = await supabaseClient.storage
        .from(SUPABASE_EDITOR_BUCKET)
        .upload(thumbnailPath, thumbnailBlob, {
          upsert: true,
          contentType: thumbnailRecord.mimeType || "image/webp",
        });
      if (thumbnailUploadError) {
        throw new Error(thumbnailUploadError.message || "サムネイルのアップロードに失敗しました。");
      }
    }

    const finalWorldId = await updateWorldMetadataForActiveSlot({
      thumbnailPath,
      publish,
    });

    const nextMeta = buildActiveEditorSlotRuntimeMeta(activeSlot, { worldId: finalWorldId });
    await saveEditorSlotRuntimeRecord(activeSlot.slotId, {
      savedAt: slotRecord.savedAt || new Date().toISOString(),
      files: {
        st: slotRecord.st,
        ct: slotRecord.ct || null,
        tr: Array.isArray(slotRecord.tr) ? slotRecord.tr : [],
      },
      meta: nextMeta,
    });

    setEditSaveNote(
      publish
        ? `${activeSlot.label} を公開しました。`
        : `${activeSlot.label} の構造物データを Supabase に保存しました。`,
      "success",
    );
  }

  async function downloadActiveEditorSlotToLocal() {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      throw new Error("保存先スロットが見つかりません。");
    }
    const rawSlotRecord = await readEditorSlotZipRecord(activeSlot.slotId).catch(() => null);
    const slotRecord = normalizeEditorSlotRuntimeRecord(rawSlotRecord);
    const zipRecord = slotRecord.st;
    if (!zipRecord?.buffer) {
      throw new Error("保存済みワールドデータが見つかりません。ワールド編集画面で先にワールド保存してください。");
    }
    const fileName = String(zipRecord.name || SUPABASE_STRUCTURE_FILE_NAME).trim() || SUPABASE_STRUCTURE_FILE_NAME;
    const blob = new Blob([zipRecord.buffer], {
      type: zipRecord.type || "application/zip",
    });
    triggerBrowserDownload(blob, fileName);
    activeSlot.fileName = fileName;
    activeSlot.fileSize = Number(zipRecord.size) || blob.size;
    activeSlot.savedAt = typeof rawSlotRecord?.savedAt === "string" ? rawSlotRecord.savedAt : String(activeSlot.savedAt || "");
    renderEditorSlots();
    setEditSaveNote(`${activeSlot.label} のワールドデータをPCへ保存しました。`, "success");
  }

  async function loadStructureWorldFromSupabaseById(worldIdInput, options = {}) {
    const { syncDraft = true, originMode = "source", reserveUsageType = "" } = options || {};
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      throw new Error("保存先スロットが見つかりません。");
    }
    const worldId = String(worldIdInput || "").trim();
    if (!worldId) {
      throw new Error("構造物ワールドIDを入力してください。");
    }
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      throw new Error("Supabase 接続が初期化されていません。");
    }
    const { data: worldRecord, error: worldError } = await supabaseClient
      .from("worlds")
      .select("id, owner_id, origin_id, title, description, world_zip_path, world_zip_bytes, thumbnail_path")
      .eq("id", worldId)
      .maybeSingle();
    if (worldError) {
      throw new Error(worldError.message || "構造物ワールドの取得に失敗しました。");
    }
    if (!worldRecord?.world_zip_path) {
      throw new Error("指定した構造物ワールドが見つかりません。");
    }
    if (reserveUsageType) {
      const { error: reserveError } = await supabaseClient.rpc("reserve_world_download", {
        p_world_id: worldId,
        p_usage_type: reserveUsageType,
      });
      if (reserveError) {
        throw new Error(reserveError.message || "構造物読み込み容量の確認に失敗しました。");
      }
    }
    const { data: signed, error: signedError } = await supabaseClient.storage
      .from(SUPABASE_EDITOR_BUCKET)
      .createSignedUrl(String(worldRecord.world_zip_path), 60);
    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message || "構造物データのダウンロードURL取得に失敗しました。");
    }
    const response = await fetch(signed.signedUrl);
    if (!response.ok) {
      throw new Error(`構造物データの取得に失敗しました: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const sourceFileName = String(worldRecord.world_zip_path).split("/").filter(Boolean).pop() || "st_world_data.zip";
    const slotRecord = normalizeEditorSlotRuntimeRecord(await readEditorSlotZipRecord(activeSlot.slotId).catch(() => null));
    const savedAt = new Date().toISOString();
    const nextFiles = {
      st: {
        name: sourceFileName,
        type: "application/zip",
        size: buffer.byteLength,
        lastModified: Date.now(),
        savedAt: Date.now(),
        buffer,
      },
      ct: slotRecord.ct || null,
      tr: Array.isArray(slotRecord.tr) ? slotRecord.tr : [],
    };
    activeSlot.fileName = nextFiles.st.name;
    activeSlot.fileSize = Number(nextFiles.st.size) || 0;
    activeSlot.savedAt = savedAt;
    const restoredOriginId = originMode === "preserve"
      ? (String(worldRecord.origin_id || "").trim() || "self")
      : worldId;
    activeSlot.originId = restoredOriginId;
    if (originMode === "preserve") {
      activeSlot.worldId = worldId;
    }
    activeSlot.remoteThumbnailPath = String(worldRecord.thumbnail_path || "").trim();
    const nextMeta = buildActiveEditorSlotRuntimeMeta(activeSlot, {
      originId: restoredOriginId,
      worldId: originMode === "preserve" ? worldId : activeSlot.worldId,
    });
    await saveEditorSlotRuntimeRecord(activeSlot.slotId, {
      savedAt,
      files: nextFiles,
      meta: nextMeta,
    });
    await syncActiveEditorSlotRuntimeFilesToLoader();
    persistEditorSlotsMeta();
    renderEditorSlots();
    setEditSaveNote(`${activeSlot.label} に構造物データを読み込みました。`, "success");
  }

  async function resumeRemoteWorldEditingForActiveSlot() {
    const activeSlot = getEditorSlotById(activeEditorSlotId);
    if (!activeSlot) {
      throw new Error("対象スロットが見つかりません。");
    }
    const remoteWorldId = String(activeSlot.remoteWorldId || "").trim();
    if (!remoteWorldId) {
      throw new Error("再開できる投稿情報が見つかりません。");
    }
    await loadStructureWorldFromSupabaseById(remoteWorldId, {
      syncDraft: false,
      originMode: "preserve",
      reserveUsageType: "resume",
    });
    await persistRuntimeFiles();
    const nextUrl = `./public_local_load.html?runtime_map=edit_upload&slot=${encodeURIComponent(activeSlot.slotId)}`;
    window.location.href = nextUrl;
  }

  function getPublicViewerPageFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const page = Number.parseInt(params.get("page") || "1", 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
  }

  function getPublicLibraryAssetFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const asset = String(params.get("asset") || "st").trim().toLowerCase();
    return PUBLIC_LIBRARY_ASSET_VALUES.has(asset) ? asset : "st";
  }

  function getNormalizedPathname() {
    const pathname = window.location.pathname || "/";
    return pathname.replace(/^\/+/, "/");
  }

  function setPublicViewerPageInUrl(page) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(page));
    const nextQuery = params.toString();
    const nextUrl = `${getNormalizedPathname()}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function setPublicLibraryStateInUrl(asset, page = 1) {
    const params = new URLSearchParams(window.location.search);
    params.set("asset", asset);
    params.set("page", String(page));
    const nextQuery = params.toString();
    const nextUrl = `${getNormalizedPathname()}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function syncPublicLibraryButtons() {
    publicLibraryAssetButtons.forEach((button) => {
      const asset = String(button.dataset.libraryAsset || "").trim();
      const active = asset === currentPublicLibraryAsset;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function syncPublicQuotaPanels() {
    if (publicStructureQuotaPanel) {
      publicStructureQuotaPanel.classList.toggle("is-active", currentPublicLibraryAsset === "st");
    }
    if (publicSharedQuotaPanel) {
      publicSharedQuotaPanel.classList.toggle("is-active", currentPublicLibraryAsset === "ct" || currentPublicLibraryAsset === "tr");
    }
  }

  function syncPublicLibrarySectionVisibility() {
    const showingStructure = currentPublicLibraryAsset === "st";
    if (viewerAuthLocked) {
      viewerAuthLocked.hidden = !showingStructure;
    }
    if (viewerArea) {
      viewerArea.hidden = !showingStructure;
    }
    if (modelLibrarySection) {
      modelLibrarySection.hidden = false;
    }
    if (modelLibraryBody) {
      modelLibraryBody.hidden = showingStructure;
    }
    syncPublicLibraryButtons();
    syncPublicQuotaPanels();
  }

  function setPublicViewerStatus(message) {
    if (publicMapStatus) {
      publicMapStatus.textContent = message;
    }
  }

  function setPublicViewerVisibility({ signedIn }) {
    if (!isPublicPage) {
      return;
    }
    const showingStructure = currentPublicLibraryAsset === "st";
    if (viewerAuthLocked) {
      viewerAuthLocked.hidden = !showingStructure || signedIn;
    }
    if (viewerArea) {
      viewerArea.hidden = !showingStructure || !signedIn;
    }
    if (modelLibrarySection) {
      modelLibrarySection.hidden = false;
    }
    if (modelLibraryBody) {
      modelLibraryBody.hidden = showingStructure;
    }
  }

  function setEditorLabVisibility({ signedIn }) {
    if (!isEditorPage) {
      return;
    }
    if (editorAuthLocked) {
      editorAuthLocked.hidden = signedIn;
    }
    if (editLab) {
      editLab.hidden = false;
    }
  }

  function openPublicMapModalFromRecord(record) {
    if (!record) {
      return;
    }
    publicViewerSelectedWorld = record;
    if (mapModalTitle) {
      mapModalTitle.textContent = record.title;
    }
    if (mapModalMeta) {
      mapModalMeta.textContent = record.tags || "published";
    }
    if (mapModalDesc) {
      mapModalDesc.textContent = record.description || "公開済みワールドです。";
    }
    if (mapModalThumbnail instanceof HTMLImageElement) {
      if (record.thumbnailUrl) {
        mapModalThumbnail.src = record.thumbnailUrl;
        mapModalThumbnail.hidden = false;
      } else {
        mapModalThumbnail.removeAttribute("src");
        mapModalThumbnail.hidden = true;
      }
    }
    if (mapModalThumbnailEmpty) {
      mapModalThumbnailEmpty.hidden = Boolean(record.thumbnailUrl);
    }
    if (mapModalStartBtn) {
      mapModalStartBtn.setAttribute("href", "#");
      mapModalStartBtn.setAttribute("aria-disabled", "true");
      mapModalStartBtn.classList.add("is-disabled");
    }
    openMapModal();
  }

  async function downloadSelectedPublicWorld() {
    const record = publicViewerSelectedWorld;
    if (!record?.worldZipPath) {
      throw new Error("ダウンロード対象のワールドデータが見つかりません。");
    }
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      throw new Error("Supabase 接続が初期化されていません。");
    }

    const { data: reserveData, error: reserveError } = await supabaseClient.rpc("reserve_world_download", {
      p_world_id: record.id,
      p_usage_type: "download",
    });
    if (reserveError) {
      throw new Error(reserveError.message || "構造物ダウンロード容量の確認に失敗しました。");
    }

    const reserved = Array.isArray(reserveData) ? reserveData[0] : reserveData;
    const reservedPath = String(reserved?.world_zip_path || record.worldZipPath || "").trim();
    if (!reservedPath) {
      throw new Error("ダウンロード対象のワールドパスが見つかりません。");
    }

    const { data, error } = await supabaseClient.storage
      .from(SUPABASE_EDITOR_BUCKET)
      .createSignedUrl(reservedPath, 60);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "ダウンロードURLの発行に失敗しました。");
    }

    await loadPublicStructureQuotaStatus();
    await incrementPublicWorldDownloadCount(record.id);

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = record.fileName || SUPABASE_STRUCTURE_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function getSignedStorageUrl(path, expiresInSeconds = 60) {
    const normalizedPath = String(path || "").trim();
    if (!normalizedPath) {
      return "";
    }
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      return "";
    }
    const { data, error } = await supabaseClient.storage
      .from(SUPABASE_EDITOR_BUCKET)
      .createSignedUrl(normalizedPath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      return "";
    }
    return data.signedUrl;
  }

  async function incrementPublicWorldDownloadCount(worldId) {
    const normalizedWorldId = String(worldId || "").trim();
    if (!normalizedWorldId) {
      return;
    }
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      return;
    }
    const { data, error } = await supabaseClient.rpc("increment_world_download_count", {
      p_world_id: normalizedWorldId,
    });
    if (error) {
      console.warn("[public] download count increment failed", error);
      return;
    }
    const nextCount = Number(data?.download_count);
    if (!Number.isFinite(nextCount)) {
      return;
    }
    if (publicViewerSelectedWorld?.id === normalizedWorldId) {
      publicViewerSelectedWorld.downloadCount = nextCount;
      publicViewerSelectedWorld.tags = buildPublicWorldTags({
        publishedAtLabel: publicViewerSelectedWorld.publishedAtLabel,
        downloadCount: nextCount,
      });
    }
  }

  function formatQuotaBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function loadPublicStructureQuotaStatus() {
    const quotaTargets = [
      { valueEl: publicStructureQuotaValue, noteEl: publicStructureQuotaNote },
      { valueEl: editStructureQuotaValue, noteEl: editStructureQuotaNote },
    ].filter(({ valueEl, noteEl }) => valueEl && noteEl);
    if (quotaTargets.length < 1) {
      return;
    }
    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    const session = await supabaseBridge?.getSession?.();
    if (!supabaseClient || !session?.user) {
      quotaTargets.forEach(({ valueEl, noteEl }) => {
        valueEl.innerHTML = `-- <span>/ 400 KB</span>`;
        noteEl.textContent = "ログインすると構造物ダウンロードの残量を表示します。";
      });
      return;
    }

    const [
      { data: policyData, error: policyError },
      { data: logData, error: logError },
    ] = await Promise.all([
      supabaseClient
        .from("download_quota_policies")
        .select("daily_limit_bytes")
        .eq("quota_group", QUOTA_GROUP_STRUCTURE)
        .maybeSingle(),
      supabaseClient
        .from("downloaded_bytes_log")
        .select("structure_downloaded_bytes")
        .eq("user_id", session.user.id)
        .maybeSingle(),
    ]);

    if (policyError || logError) {
      quotaTargets.forEach(({ noteEl }) => {
        noteEl.textContent = "残量の取得に失敗しました。";
      });
      return;
    }

    const limit = Number(policyData?.daily_limit_bytes) || 409600;
    const used = Number(logData?.structure_downloaded_bytes) || 0;
    const remaining = Math.max(0, limit - used);
    quotaTargets.forEach(({ valueEl, noteEl }) => {
      valueEl.innerHTML = `${formatQuotaBytes(remaining)} <span>/ ${formatQuotaBytes(limit)}</span>`;
      noteEl.textContent = `今週の使用量 ${formatQuotaBytes(used)} / 残り ${formatQuotaBytes(remaining)}`;
    });
  }

  function buildPublicWorldTags({ publishedAtLabel, downloadCount }) {
    const tags = ["published"];
    if (publishedAtLabel) {
      tags.push(publishedAtLabel);
    }
    if (Number.isFinite(downloadCount)) {
      tags.push(`DL ${downloadCount}`);
    }
    return tags.join(" ・ ");
  }

  function renderPublicViewerPagination() {
    if (!publicMapPagination) {
      return;
    }
    publicMapPagination.innerHTML = "";
    if (publicViewerTotalPages <= 1) {
      return;
    }

    const buttons = [];
    buttons.push({ label: "前へ", page: Math.max(1, publicViewerPage - 1), disabled: publicViewerPage <= 1 });
    for (let page = 1; page <= publicViewerTotalPages; page += 1) {
      buttons.push({ label: String(page), page, active: page === publicViewerPage, disabled: false });
    }
    buttons.push({
      label: "次へ",
      page: Math.min(publicViewerTotalPages, publicViewerPage + 1),
      disabled: publicViewerPage >= publicViewerTotalPages,
    });

    buttons.forEach((config) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = config.label;
      if (config.active) {
        button.classList.add("is-active");
      }
      button.disabled = Boolean(config.disabled);
      button.addEventListener("click", () => {
        if (config.disabled || config.page === publicViewerPage) {
          return;
        }
        publicViewerPage = config.page;
        setPublicViewerPageInUrl(publicViewerPage);
        void fetchAndRenderPublicWorlds();
      });
      publicMapPagination.appendChild(button);
    });
  }

  function renderPublicViewerCards(items) {
    if (!publicMapGrid) {
      return;
    }
    publicMapGrid.innerHTML = "";

    items.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = `map-card map-${String.fromCharCode(97 + (index % 5))}`;
      article.setAttribute("role", "button");
      article.setAttribute("tabindex", "0");
      article.setAttribute("aria-label", item.title);

      const preview = document.createElement("div");
      preview.className = "map-preview";
      if (item.thumbnailUrl) {
        const image = document.createElement("img");
        image.src = item.thumbnailUrl;
        image.alt = `${item.title} のサムネイル`;
        preview.appendChild(image);
      }

      const overlay = document.createElement("div");
      overlay.className = "viewer-overlay";
      overlay.innerHTML = `
        <p class="overlay-head">${item.title}</p>
        <p class="overlay-sub">${item.description || "公開済みワールド"}</p>
      `;
      preview.appendChild(overlay);

      const meta = document.createElement("div");
      meta.className = "map-meta";
      meta.innerHTML = `
        <p class="map-title">${item.title}</p>
        <p class="map-tags">${item.tags}</p>
      `;

      article.appendChild(preview);
      article.appendChild(meta);
      article.addEventListener("click", () => openPublicMapModalFromRecord(item));
      article.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPublicMapModalFromRecord(item);
        }
      });
      publicMapGrid.appendChild(article);
    });
  }

  async function fetchAndRenderPublicWorlds() {
    if (!isPublicPage) {
      return;
    }

    const supabaseBridge = window.mouseDemoSupabase;
    const supabaseClient = supabaseBridge?.client || null;
    if (!supabaseClient) {
      setPublicViewerVisibility({ signedIn: false });
      return;
    }

    const session = await supabaseBridge.getSession();
    const signedIn = Boolean(session?.user);
    setPublicViewerVisibility({ signedIn });
    if (currentPublicLibraryAsset !== "st") {
      return;
    }
    if (!signedIn) {
      if (publicMapGrid) {
        publicMapGrid.innerHTML = "";
      }
      if (publicMapPagination) {
        publicMapPagination.innerHTML = "";
      }
      if (viewerMetaValue) {
        viewerMetaValue.textContent = "ログインすると公開済みワールド一覧を表示します";
      }
      setPublicViewerStatus("ログイン後に公開ワールドを取得します。");
      return;
    }

    setPublicViewerStatus("公開ワールドを読み込み中です...");
    const from = (publicViewerPage - 1) * PUBLIC_WORLD_PAGE_SIZE;
    const to = from + PUBLIC_WORLD_PAGE_SIZE - 1;

    let worldsQuery = await supabaseClient
      .from("worlds")
      .select("id, title, description, published_at, world_zip_path, thumbnail_path, download_count", { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (worldsQuery.error && /download_count/i.test(String(worldsQuery.error.message || ""))) {
      worldsQuery = await supabaseClient
        .from("worlds")
        .select("id, title, description, published_at, world_zip_path, thumbnail_path", { count: "exact" })
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(from, to);
    }

    const { data, error, count } = worldsQuery;

    if (error) {
      if (publicMapGrid) {
        publicMapGrid.innerHTML = "";
      }
      if (publicMapPagination) {
        publicMapPagination.innerHTML = "";
      }
      setPublicViewerStatus(`公開ワールドの取得に失敗しました: ${error.message || error}`);
      return;
    }

    const totalCount = Number(count) || 0;
    publicViewerTotalPages = Math.max(1, Math.ceil(totalCount / PUBLIC_WORLD_PAGE_SIZE));
    if (publicViewerPage > publicViewerTotalPages) {
      publicViewerPage = publicViewerTotalPages;
      setPublicViewerPageInUrl(publicViewerPage);
    }

    const items = Array.isArray(data)
      ? await Promise.all(data.map(async (record) => {
        const publishedAt = record?.published_at ? formatSavedAt(record.published_at) : "日時未設定";
        const thumbnailPath = String(record?.thumbnail_path || "").trim();
        const thumbnailUrl = thumbnailPath
          ? await getSignedStorageUrl(thumbnailPath, 60 * 10)
          : "";
        return {
          id: String(record?.id || "").trim(),
          title: String(record?.title || "Untitled World").trim(),
          description: String(record?.description || "").trim(),
          worldZipPath: String(record?.world_zip_path || "").trim(),
          thumbnailPath,
          thumbnailUrl,
          publishedAtLabel: publishedAt,
          downloadCount: Number(record?.download_count),
          fileName: String(record?.world_zip_path || "").split("/").filter(Boolean).pop() || SUPABASE_STRUCTURE_FILE_NAME,
          tags: buildPublicWorldTags({
            publishedAtLabel: publishedAt,
            downloadCount: Number(record?.download_count),
          }),
        };
      }))
      : [];

    renderPublicViewerCards(items);
    renderPublicViewerPagination();

    if (viewerMetaValue) {
      viewerMetaValue.textContent = `${totalCount}件の公開ワールド / ${PUBLIC_WORLD_PAGE_SIZE}件ずつ表示`;
    }
    if (items.length < 1) {
      setPublicViewerStatus("公開済みワールドはまだありません。");
      return;
    }
    setPublicViewerStatus(`${totalCount}件中 ${from + 1} - ${Math.min(totalCount, from + items.length)}件を表示しています。`);
  }

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
      const rawTr = record.files.tr;
      return {
        st: record.files.st || null,
        ct: record.files.ct || null,
        tr: Array.isArray(rawTr) ? rawTr.filter(Boolean) : (rawTr ? [rawTr] : []),
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
        tr: [],
      };
    }
    return {
      st: null,
      ct: null,
      tr: [],
    };
  }

  function getRuntimeFileName(kind) {
    if (kind === "tr") {
      const list = Array.isArray(runtimeFiles?.tr) ? runtimeFiles.tr : [];
      const names = list.map((file) => String(file?.name || "").trim()).filter(Boolean);
      if (names.length < 1) { return ""; }
      if (names.length === 1) { return names[0]; }
      return `${names[0]} ほか${names.length - 1}件`;
    }
    return String(runtimeFiles?.[kind]?.name || "").trim();
  }

  function getMissingRuntimeKinds() {
    return Object.keys(RUNTIME_FILE_PREFIXES).filter((kind) => !runtimeFiles[kind]);
  }

  function hasCityRuntimeFile() {
    const cityFile = runtimeFiles?.ct;
    const name = String(cityFile?.name || "").trim().toLowerCase();
    return /^ct/i.test(name) && /\.(glb|gltf)$/i.test(name);
  }

  function getStartValidationMessage() {
    const loadedKinds = Object.keys(RUNTIME_FILE_PREFIXES).filter((kind) => Boolean(runtimeFiles[kind]));
    if (loadedKinds.length > 0) {
      if (!hasCityRuntimeFile()) {
        return "表示には都市データ `ct_*.glb` が必要です。";
      }
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
    const activeSlot = isEditorPage ? getEditorSlotById(activeEditorSlotId) : null;
    return {
      version: 2,
      savedAt: Date.now(),
      files: runtimeFiles,
      meta: activeSlot ? buildActiveEditorSlotRuntimeMeta(activeSlot) : {},
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
    const activeSlot = isEditorPage ? getEditorSlotById(activeEditorSlotId) : null;

    for (const file of fileList) {
      const kind = classifyRuntimeFile(file?.name || "");
      if (!kind) {
        rejectedNames.push(file?.name || "unknown");
        continue;
      }

      if (isEditorPage && kind === "st") {
        rejectedNames.push(file?.name || "unknown");
        continue;
      }

      if (kind === "ct") {
        await validateCtRuntimeFile(file);
      }

      const buffer = await file.arrayBuffer();
      const nextEntry = {
        name: file.name || "selected file",
        type: file.type || "",
        size: Number(file.size) || 0,
        lastModified: Number(file.lastModified) || Date.now(),
        savedAt: Date.now(),
        buffer,
      };
      if (kind === "tr") {
        const current = Array.isArray(runtimeFiles.tr) ? runtimeFiles.tr : [];
        runtimeFiles.tr = [...current, nextEntry];
      } else {
        runtimeFiles[kind] = nextEntry;
      }
      acceptedKinds.push(kind);
    }

    if (acceptedKinds.length < 1) {
      const detail = rejectedNames.length > 0
        ? `無効ファイル: ${rejectedNames.join(", ")}`
        : "有効なファイルがありません。";
      throw new Error(`${detail}。先頭が st / ct / tr のファイル名を使用してください。`);
    }

    if (isEditorPage && activeSlot) {
      const slotRecord = normalizeEditorSlotRuntimeRecord(await readEditorSlotZipRecord(activeSlot.slotId).catch(() => null));
      const nextFiles = {
        st: slotRecord.st || null,
        ct: runtimeFiles.ct || slotRecord.ct || null,
        tr: (Array.isArray(runtimeFiles.tr) && runtimeFiles.tr.length > 0) ? runtimeFiles.tr : (Array.isArray(slotRecord.tr) ? slotRecord.tr : []),
      };
      const savedAt = new Date().toISOString();
      await saveEditorSlotRuntimeRecord(activeSlot.slotId, {
        savedAt,
        files: nextFiles,
        meta: buildActiveEditorSlotRuntimeMeta(activeSlot),
      });
      activeSlot.cityFileName = nextFiles.ct?.name || "";
      activeSlot.trainFileCount = Array.isArray(nextFiles.tr) ? nextFiles.tr.length : 0;
      activeSlot.savedAt = savedAt;
      persistEditorSlotsMeta();
      await syncActiveEditorSlotRuntimeFilesToLoader();
      renderEditorSlots();
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
        tr: [],
      };
      updateLocalMapSummary();
    }
  }

  async function detectFallbackMapData() {
    try {
      const response = await fetch("../map_data/manifest.json", { cache: "no-store" });
      if (!response.ok) {
        fallbackMapDataAvailable = false;
        updateLocalMapSummary();
        return false;
      }
      const manifest = await response.json();
      const manifestFiles = Array.isArray(manifest?.files) ? manifest.files : [];
      fallbackMapDataAvailable = manifestFiles.some((entry) => {
        const name = String(entry?.name || "").trim();
        const kind = String(entry?.kind || "").trim();
        return Boolean(name) && (kind === "st" || kind === "ct" || kind === "tr");
      });
      updateLocalMapSummary();
      if (fallbackMapDataAvailable && !runtimeFiles.st && !runtimeFiles.ct && !runtimeFiles.tr) {
        setLocalMapComment("未選択時は map_data から自動ロードします。", "success");
      }
      return fallbackMapDataAvailable;
    } catch (_error) {
      fallbackMapDataAvailable = false;
      updateLocalMapSummary();
      return false;
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
    await persistRuntimeFiles();
    link.href = RUNTIME_MAP_VIEWER_URL;
  }

  async function handleLocalMapStartButtonClick() {
    const validationMessage = getStartValidationMessage();
    if (validationMessage) {
      setLocalMapComment(validationMessage, "error");
      return;
    }
    setLocalMapComment("", "info", false);
    await persistRuntimeFiles();
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
  restoreCachedRuntimeMap().finally(() => {
    detectFallbackMapData();
  });
  void loadPublicStructureQuotaStatus();
  if (isPublicPage) {
    currentPublicLibraryAsset = getPublicLibraryAssetFromUrl();
    publicViewerPage = getPublicViewerPageFromUrl();
    setPublicLibraryStateInUrl(currentPublicLibraryAsset, publicViewerPage);
    syncPublicLibrarySectionVisibility();
    setPublicViewerVisibility({ signedIn: false });
    setPublicViewerStatus("ログイン後に公開ワールドを取得します。");
  }
  if (isEditorPage) {
    setEditorLabVisibility({ signedIn: false });
    void initializeEditorSlots().then(() => {
      void refreshEditorSlotThumbnails();
      void fetchAndBindOwnWorldSummaries();
      void syncActiveEditorSlotRuntimeFilesToLoader();
    });
    setEditSaveNote("ローカルの構造物・都市・車両データを読み込んで編集を開始できます。", "info");
    void loadPublicStructureQuotaStatus();
  }
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

  window.addEventListener("mouse-demo-auth-change", (event) => {
    const session = event?.detail?.session || null;
    if (isPublicPage) {
      void fetchAndRenderPublicWorlds();
      void loadPublicStructureQuotaStatus();
    }
    if (isEditorPage) {
      setEditorLabVisibility({ signedIn: Boolean(session?.user) });
      void initializeEditorSlots().then(() => {
        void refreshEditorSlotThumbnails();
        void fetchAndBindOwnWorldSummaries();
        void syncActiveEditorSlotRuntimeFilesToLoader();
      });
      void loadPublicStructureQuotaStatus();
    }
  });

  if (publicLibraryAssetButtons.length > 0) {
    publicLibraryAssetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextAsset = String(button.dataset.libraryAsset || "").trim().toLowerCase();
        if (!PUBLIC_LIBRARY_ASSET_VALUES.has(nextAsset) || nextAsset === currentPublicLibraryAsset) {
          return;
        }
        currentPublicLibraryAsset = nextAsset;
        publicViewerPage = 1;
        setPublicLibraryStateInUrl(currentPublicLibraryAsset, publicViewerPage);
        syncPublicLibrarySectionVisibility();
        if (nextAsset === "st") {
          void fetchAndRenderPublicWorlds();
        }
        window.dispatchEvent(new CustomEvent("mouse-demo-public-asset-change", {
          detail: {
            asset: currentPublicLibraryAsset,
            page: publicViewerPage,
          },
        }));
      });
    });
  }

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
  if (featuresSection && !featuresGuideActive) {
    activateFeaturesGuide();
  }

  if (localMapSelectBtn && localMapFileInput) {
    localMapSelectBtn.addEventListener("click", () => {
      localMapFileInput.click();
    });
  }
  if (loadStructureWorldBtn) {
    loadStructureWorldBtn.addEventListener("click", async () => {
      setEditSaveNote("構造物ワールドを取得中です...", "info");
      try {
        await loadStructureWorldFromSupabaseById(structureWorldIdInput?.value || "");
      } catch (error) {
        setEditSaveNote(`構造物の取得に失敗しました: ${error?.message || error}`, "error");
      }
    });
  }

  async function initializeEditorSlots() {
    if (!isEditorPage) {
      return;
    }
    editorSlotLimit = await fetchEditorSlotLimit();
    editorSlotsState = loadEditorSlotsMeta(editorSlotLimit);
    const requestedSlotId = String(new URLSearchParams(window.location.search).get("slot") || "").trim();
    if (requestedSlotId && getEditorSlotById(requestedSlotId)) {
      activeEditorSlotId = requestedSlotId;
    } else if (!getEditorSlotById(activeEditorSlotId)) {
      activeEditorSlotId = editorSlotsState[0]?.slotId || "slot-01";
    }
    renderEditorSlots();
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

  if (editGrid) {
    editGrid.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest(".edit-slot[data-slot]") : null;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const slotId = String(button.dataset.slot || "").trim();
      if (!slotId || slotId === activeEditorSlotId) {
        return;
      }
      cancelActiveEditorSlotTitleEdit();
      activeEditorSlotId = slotId;
      renderEditorSlots();
      void syncActiveEditorSlotRuntimeFilesToLoader();
      setEditSaveNote(`${button.querySelector(".slot-id")?.textContent || "選択中の枠"} を選択しました。`, "info");
    });
  }

  if (saveSlotZipBtn) {
    saveSlotZipBtn.addEventListener("click", async () => {
      setEditSaveNote("PCへ保存するワールドデータを準備中です...", "info");
      try {
        await downloadActiveEditorSlotToLocal();
      } catch (error) {
        setEditSaveNote(`保存に失敗しました: ${error?.message || error}`, "error");
      }
    });
  }

  if (resumeWorldBtn) {
    resumeWorldBtn.addEventListener("click", async () => {
      setEditSaveNote("投稿データを読み込み、編集を再開します...", "info");
      try {
        await resumeRemoteWorldEditingForActiveSlot();
      } catch (error) {
        setEditSaveNote(`編集再開に失敗しました: ${error?.message || error}`, "error");
      }
    });
  }

  if (publishWorldBtn) {
    publishWorldBtn.addEventListener("click", async () => {
      setEditSaveNote("Supabase に保存中です...", "info");
      try {
        await saveActiveEditorSlotToSupabase({ publish: true });
      } catch (error) {
        setEditSaveNote(`Supabase 保存に失敗しました: ${error?.message || error}`, "error");
      }
    });
  }

  if (detailTitleEditBtn) {
    detailTitleEditBtn.addEventListener("click", () => {
      if (isEditingEditorSlotTitle) {
        commitActiveEditorSlotTitle();
        return;
      }
      startEditingActiveEditorSlotTitle();
    });
  }

  if (detailTitleInput) {
    detailTitleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitActiveEditorSlotTitle();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelActiveEditorSlotTitleEdit();
      }
    });
    detailTitleInput.addEventListener("blur", () => {
      if (!isEditingEditorSlotTitle) {
        return;
      }
      commitActiveEditorSlotTitle();
    });
  }

  if (editDetailStartLink && isEditorPage) {
    editDetailStartLink.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await openThumbnailCaptureWorldForActiveSlot(event);
      } catch (error) {
        setEditSaveNote(`サムネ撮影用ワールドの起動に失敗しました: ${error?.message || error}`, "error");
      }
    });
  }

  startLinks.forEach((link) => {
    if (link === editDetailStartLink && isEditorPage) {
      return;
    }
    link.addEventListener("click", handleStartNavigation);
  });

  if (mapModalDownloadBtn) {
    mapModalDownloadBtn.addEventListener("click", async () => {
      try {
        await downloadSelectedPublicWorld();
        closeMapModal();
      } catch (error) {
        setPublicViewerStatus(`ダウンロードに失敗しました: ${error?.message || error}`);
      }
    });
  }

  if (isPublicPage) {
    void fetchAndRenderPublicWorlds();
  }
})();
