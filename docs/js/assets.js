const ASSET_BUCKET = "asset-files";
const QUOTA_GROUP_SHARED = "asset_shared";
const QUOTA_GROUP_STRUCTURE = "structure_download";
const ASSET_PAGE_SIZE = 6;

const sharedQuotaValue = document.getElementById("asset-shared-quota-value");
const sharedQuotaNote = document.getElementById("asset-shared-quota-note");
const libraryStatus = document.getElementById("asset-library-status");
const listMessage = document.getElementById("asset-list-message");
const assetGrid = document.getElementById("asset-grid");
const assetPagination = document.getElementById("asset-pagination");
const filterButtons = Array.from(document.querySelectorAll("[data-asset-filter]"));
const sortButtons = Array.from(document.querySelectorAll("[data-asset-sort]"));
const scrollCityBtn = document.getElementById("asset-scroll-city-btn");
const scrollTrainBtn = document.getElementById("asset-scroll-train-btn");
const assetDownloadBtn = document.getElementById("asset-download-btn");
const assetGuideBtn = document.getElementById("asset-guide-btn");
const detailTitle = document.getElementById("asset-detail-title");
const detailKind = document.getElementById("asset-detail-kind");
const detailDescription = document.getElementById("asset-detail-description");
const detailFormat = document.getElementById("asset-detail-format");
const detailSize = document.getElementById("asset-detail-size");
const detailCategory = document.getElementById("asset-detail-category");
const detailGuide = document.getElementById("asset-detail-guide");
const detailThumbnail = document.getElementById("asset-detail-thumbnail");
const detailThumbnailEmpty = document.getElementById("asset-detail-thumbnail-empty");

let assets = [];
let selectedAssetId = "";
let currentFilter = "all";
let currentSort = "newest";
let currentQuotaLimit = 0;
let currentQuotaUsed = 0;
let currentPage = 1;

function getAssetPageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = Number.parseInt(params.get("page") || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getAssetFilterFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const asset = String(params.get("asset") || "").trim().toLowerCase();
  if (asset === "ct" || asset === "tr") {
    return asset;
  }
  return "all";
}

function setAssetPageInUrl(page) {
  const params = new URLSearchParams(window.location.search);
  params.set("page", String(page));
  if (currentFilter === "ct" || currentFilter === "tr") {
    params.set("asset", currentFilter);
  }
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function getSupabaseClient() {
  return window.mouseDemoSupabase?.client || null;
}

async function getSession() {
  return await window.mouseDemoSupabase?.getSession?.() || null;
}

function setListMessage(message) {
  if (listMessage) {
    listMessage.textContent = message;
  }
}

function setLibraryStatus(message, isActive = true) {
  if (!libraryStatus) {
    return;
  }
  libraryStatus.textContent = message;
  libraryStatus.classList.toggle("on", isActive);
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildKindLabel(kind) {
  return kind === "tr" ? "列車モデル / tr" : "都市モデル / ct";
}

function buildKindBadge(kind) {
  return kind === "tr" ? "TRAIN" : "CITY";
}

function inferFileFormat(path) {
  const fileName = String(path || "").split("/").filter(Boolean).pop() || "";
  const ext = String(fileName.split(".").pop() || "").toUpperCase();
  return ext || "--";
}

function buildDetailGuide(asset) {
  return `1. ダウンロード  2. public.html または edit.html のローカル読込へ追加  3. ${asset.kind === "tr" ? "列車データ" : "都市データ"}として読み込む`;
}

async function createSignedUrl(path, expiresInSeconds = 60 * 10) {
  const supabase = getSupabaseClient();
  const normalizedPath = String(path || "").trim();
  if (!supabase || !normalizedPath) {
    return "";
  }
  try {
    const { data, error } = await supabase.storage
      .from(ASSET_BUCKET)
      .createSignedUrl(normalizedPath, expiresInSeconds);
    if (error) {
      console.warn("[assets] thumbnail signed url failed", normalizedPath, error);
      return "";
    }
    return String(data?.signedUrl || "");
  } catch (error) {
    console.warn("[assets] thumbnail signed url threw", normalizedPath, error);
    return "";
  }
}

async function loadQuotaStatus() {
  const supabase = getSupabaseClient();
  const session = await getSession();
  if (!supabase || !session?.user) {
    if (sharedQuotaValue) {
      sharedQuotaValue.innerHTML = `-- <span>/ 100 MB</span>`;
    }
    if (sharedQuotaNote) {
      sharedQuotaNote.textContent = "ログインすると今週の残量を表示します。";
    }
    return;
  }

  const [
    { data: sharedPolicyData, error: sharedPolicyError },
    { data: logData, error: logError },
  ] = await Promise.all([
    supabase
      .from("download_quota_policies")
      .select("quota_group, daily_limit_bytes")
      .eq("quota_group", QUOTA_GROUP_SHARED)
      .maybeSingle(),
    supabase
      .from("downloaded_bytes_log")
      .select("asset_downloaded_bytes")
      .eq("user_id", session.user.id)
      .maybeSingle(),
  ]);

  if (sharedPolicyError || logError) {
    if (sharedQuotaNote) {
      sharedQuotaNote.textContent = "残量の取得に失敗しました。";
    }
    return;
  }

  currentQuotaLimit = Number(sharedPolicyData?.daily_limit_bytes) || 0;
  currentQuotaUsed = Number(logData?.asset_downloaded_bytes) || 0;
  const remaining = Math.max(0, currentQuotaLimit - currentQuotaUsed);

  if (sharedQuotaValue) {
    sharedQuotaValue.innerHTML = `${formatBytes(remaining)} <span>/ ${formatBytes(currentQuotaLimit || 104857600)}</span>`;
  }
  if (sharedQuotaNote) {
    sharedQuotaNote.textContent = `今週の使用量 ${formatBytes(currentQuotaUsed)} / 残り ${formatBytes(remaining)}`;
  }
}

async function fetchAssets() {
  const supabase = getSupabaseClient();
  const session = await getSession();
  if (!supabase) {
    setListMessage("Supabase 接続の初期化待ちです。");
    return;
  }
  if (!session?.user) {
    assets = [];
    if (assetGrid) {
      assetGrid.innerHTML = "";
    }
    renderDetail(null);
    setListMessage("ログインするとモデル一覧とダウンロード機能を利用できます。");
    setLibraryStatus("SIGN IN", false);
    return;
  }

  setListMessage("モデル一覧を読み込み中です...");
  setLibraryStatus("SYNC", true);
  const { data, error } = await supabase
    .from("downloadable_assets")
    .select("id, kind, title, description, file_path, file_size_bytes, thumbnail_path, status, created_at")
    .in("kind", ["ct", "tr"])
    .eq("status", "published");

  if (error) {
    setListMessage(`モデル一覧の取得に失敗しました: ${error.message || error}`);
    setLibraryStatus("ERROR", false);
    return;
  }

  assets = (data || []).map((row) => ({
    id: String(row.id || "").trim(),
    kind: String(row.kind || "").trim(),
    title: String(row.title || "Untitled Asset").trim(),
    description: String(row.description || "").trim(),
    filePath: String(row.file_path || "").trim(),
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    thumbnailPath: String(row.thumbnail_path || "").trim(),
    thumbnailUrl: "",
    createdAt: String(row.created_at || "").trim(),
  }));

  if (!selectedAssetId && assets.length > 0) {
    selectedAssetId = assets[0].id;
  }
  setLibraryStatus("READY", true);
  renderAssets();
  void hydrateAssetThumbnails();
}

async function hydrateAssetThumbnails() {
  if (!assets.length) {
    return;
  }
  const updatedAssets = await Promise.all(assets.map(async (asset) => ({
    ...asset,
    thumbnailUrl: asset.thumbnailPath ? await createSignedUrl(asset.thumbnailPath) : "",
  })));
  assets = updatedAssets;
  renderAssets();
}

function applyFiltersAndSort() {
  let items = assets.slice();
  if (currentFilter !== "all") {
    items = items.filter((asset) => asset.kind === currentFilter);
  }
  if (currentSort === "size") {
    items.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
  } else {
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  return items;
}

function renderPagination(totalItems) {
  if (!assetPagination) {
    return;
  }
  assetPagination.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(totalItems / ASSET_PAGE_SIZE));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  if (totalPages <= 1) {
    return;
  }

  const buttons = [];
  buttons.push({ label: "前へ", page: Math.max(1, currentPage - 1), disabled: currentPage <= 1 });
  for (let page = 1; page <= totalPages; page += 1) {
    buttons.push({ label: String(page), page, active: page === currentPage, disabled: false });
  }
  buttons.push({ label: "次へ", page: Math.min(totalPages, currentPage + 1), disabled: currentPage >= totalPages });

  buttons.forEach((config) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = config.label;
    button.disabled = Boolean(config.disabled);
    if (config.active) {
      button.classList.add("is-active");
    }
      button.addEventListener("click", () => {
        if (config.disabled || config.page === currentPage) {
          return;
        }
        currentPage = config.page;
        setAssetPageInUrl(currentPage);
        renderAssets();
        assetGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    assetPagination.appendChild(button);
  });
}

function renderAssets() {
  if (!assetGrid) {
    return;
  }
  assetGrid.innerHTML = "";
  const allItems = applyFiltersAndSort();
  if (allItems.length < 1) {
    if (assetPagination) {
      assetPagination.innerHTML = "";
    }
    setListMessage("表示できるモデルがありません。");
    renderDetail(null);
    return;
  }

  if (!allItems.some((asset) => asset.id === selectedAssetId)) {
    selectedAssetId = allItems[0].id;
  }

  const totalPages = Math.max(1, Math.ceil(allItems.length / ASSET_PAGE_SIZE));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  const pageFrom = (currentPage - 1) * ASSET_PAGE_SIZE;
  const items = allItems.slice(pageFrom, pageFrom + ASSET_PAGE_SIZE);

  items.forEach((asset, index) => {
    const article = document.createElement("article");
    article.className = `asset-card ${asset.kind === "tr" ? "asset-card-train" : "asset-card-city"}`;
    article.setAttribute("role", "button");
    article.setAttribute("tabindex", "0");
    article.setAttribute("aria-label", asset.title);

    const preview = document.createElement("div");
    preview.className = "asset-card-preview";
    if (asset.kind === "tr") {
      preview.classList.add(index % 2 === 0 ? "asset-card-preview-train" : "asset-card-preview-train-alt");
    } else {
      if (index % 2 === 0) {
        preview.classList.add("asset-card-preview-alt");
      }
    }
    if (asset.thumbnailUrl) {
      const img = document.createElement("img");
      img.src = asset.thumbnailUrl;
      img.alt = `${asset.title} のサムネイル`;
      preview.appendChild(img);
    }
    const badge = document.createElement("div");
    badge.className = "asset-card-badge";
    badge.textContent = buildKindBadge(asset.kind);
    preview.appendChild(badge);

    const copy = document.createElement("div");
    copy.className = "asset-card-copy";
    copy.innerHTML = `
      <p class="asset-card-title">${asset.title}</p>
      <p class="asset-card-desc">${asset.description || "配布モデルです。"}</p>
      <div class="asset-card-meta">
        <span>${asset.kind}</span>
        <span>${formatBytes(asset.fileSizeBytes)}</span>
        <span>${inferFileFormat(asset.filePath)}</span>
      </div>
    `;

    article.append(preview, copy);
    article.classList.toggle("is-active", asset.id === selectedAssetId);
    article.addEventListener("click", () => {
      selectedAssetId = asset.id;
      renderAssets();
    });
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedAssetId = asset.id;
        renderAssets();
      }
    });
    assetGrid.appendChild(article);
  });

  const selected = allItems.find((asset) => asset.id === selectedAssetId) || allItems[0];
  renderDetail(selected);
  renderPagination(allItems.length);
  setListMessage(`${allItems.length}件中 ${pageFrom + 1} - ${Math.min(allItems.length, pageFrom + items.length)}件を表示しています。`);
}

function renderDetail(asset) {
  if (!asset) {
    if (detailTitle) {
      detailTitle.textContent = "モデルを選択してください";
    }
    return;
  }
  if (detailTitle) {
    detailTitle.textContent = asset.title;
  }
  if (detailKind) {
    detailKind.textContent = buildKindLabel(asset.kind);
  }
  if (detailDescription) {
    detailDescription.textContent = asset.description || "配布モデルです。";
  }
  if (detailFormat) {
    detailFormat.textContent = inferFileFormat(asset.filePath);
  }
  if (detailSize) {
    detailSize.textContent = formatBytes(asset.fileSizeBytes);
  }
  if (detailCategory) {
    detailCategory.textContent = "都市 / 車両 共用枠";
  }
  if (detailGuide) {
    detailGuide.textContent = buildDetailGuide(asset);
  }
  if (detailThumbnail instanceof HTMLImageElement) {
    if (asset.thumbnailUrl) {
      detailThumbnail.src = asset.thumbnailUrl;
      detailThumbnail.hidden = false;
    } else {
      detailThumbnail.removeAttribute("src");
      detailThumbnail.hidden = true;
    }
  }
  if (detailThumbnailEmpty) {
    detailThumbnailEmpty.hidden = Boolean(asset.thumbnailUrl);
  }
  if (assetDownloadBtn) {
    assetDownloadBtn.disabled = false;
    assetDownloadBtn.setAttribute("aria-disabled", "false");
  }
}

async function downloadSelectedAsset() {
  const asset = assets.find((item) => item.id === selectedAssetId) || null;
  if (!asset) {
    throw new Error("ダウンロード対象が選択されていません。");
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 接続が初期化されていません。");
  }
  const session = await getSession();
  if (!session?.user) {
    throw new Error("ログインしてください。");
  }

  const { data: reserveData, error: reserveError } = await supabase.rpc("reserve_asset_download", {
    p_asset_id: asset.id,
  });
  if (reserveError) {
    throw new Error(reserveError.message || "ダウンロード容量の確認に失敗しました。");
  }
  const reserved = Array.isArray(reserveData) ? reserveData[0] : reserveData;
  const path = String(reserved?.file_path || asset.filePath || "").trim();
  if (!path) {
    throw new Error("ダウンロード先のファイルパスが見つかりません。");
  }

  const signedUrl = await createSignedUrl(path, 60);
  if (!signedUrl) {
    throw new Error("ダウンロードURLの発行に失敗しました。");
  }

  const link = document.createElement("a");
  link.href = signedUrl;
  link.download = String(path.split("/").filter(Boolean).pop() || "asset.bin");
  document.body.appendChild(link);
  link.click();
  link.remove();

  currentQuotaUsed += asset.fileSizeBytes;
  await loadQuotaStatus();
  setListMessage(`${asset.title} のダウンロードを開始しました。`);
}

if (scrollCityBtn) {
  scrollCityBtn.addEventListener("click", () => {
    currentFilter = "ct";
    currentPage = 1;
    setAssetPageInUrl(currentPage);
    filterButtons.forEach((button) => {
      const active = String(button.dataset.assetFilter || "") === "ct";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderAssets();
    assetGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (scrollTrainBtn) {
  scrollTrainBtn.addEventListener("click", () => {
    currentFilter = "tr";
    currentPage = 1;
    setAssetPageInUrl(currentPage);
    filterButtons.forEach((button) => {
      const active = String(button.dataset.assetFilter || "") === "tr";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderAssets();
    assetGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = String(button.dataset.assetFilter || "all").trim();
    currentPage = 1;
    setAssetPageInUrl(currentPage);
    filterButtons.forEach((target) => {
      const active = target === button;
      target.classList.toggle("is-active", active);
      target.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderAssets();
  });
});

window.addEventListener("mouse-demo-public-asset-change", (event) => {
  const nextAsset = String(event?.detail?.asset || "").trim().toLowerCase();
  if (nextAsset !== "ct" && nextAsset !== "tr") {
    return;
  }
  currentFilter = nextAsset;
  currentPage = Number(event?.detail?.page) > 0 ? Number(event.detail.page) : 1;
  renderAssets();
});

sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentSort = String(button.dataset.assetSort || "newest").trim();
    currentPage = 1;
    sortButtons.forEach((target) => {
      target.classList.toggle("is-active", target === button);
    });
    renderAssets();
  });
});

if (assetDownloadBtn) {
  assetDownloadBtn.addEventListener("click", async () => {
    setListMessage("ダウンロード準備中です...");
    try {
      await downloadSelectedAsset();
    } catch (error) {
      setListMessage(`ダウンロードに失敗しました: ${error?.message || error}`);
    }
  });
}

if (assetGuideBtn) {
  assetGuideBtn.addEventListener("click", () => {
    document.querySelector(".features")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

window.addEventListener("mouse-demo-auth-change", async () => {
  await loadQuotaStatus();
  await fetchAssets();
});

currentFilter = getAssetFilterFromUrl();
currentPage = getAssetPageFromUrl();
await loadQuotaStatus();
await fetchAssets();
