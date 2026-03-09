(() => {
  const tickerEl = document.getElementById("ticker-text");
  const scrollButtons = document.querySelectorAll("[data-scroll-target]");
  const editSlots = document.querySelectorAll(".edit-slot");
  const detailTitle = document.getElementById("detail-title");
  const detailDesc = document.getElementById("detail-desc");
  const startWorldBtn = document.getElementById("start-world-btn");
  const mapCards = document.querySelectorAll(".map-card[data-map-key]");
  const mapModal = document.getElementById("map-modal");
  const mapModalTitle = document.getElementById("map-modal-title");
  const mapModalDesc = document.getElementById("map-modal-desc");
  const mapModalStartBtn = document.getElementById("map-modal-start-btn");
  const mapModalClose = document.getElementById("map-modal-close");
  const modalCloseTargets = document.querySelectorAll("[data-modal-close]");
  const showFeaturesBtn = document.getElementById("show-features-btn");
  const featuresSection = document.getElementById("features");

  const tickerMessages = [
    "公開中のマップを一覧から選んで、各マップのプレビューを確認できます。",
    "1マップにつき1プレビューの構成で、見たいシーンを探しやすくしています。",
    "このページは公開ポータルのデザイン先行プロトタイプです。",
  ];
  let tickerIndex = 0;

  if (tickerEl) {
    setInterval(() => {
      tickerIndex = (tickerIndex + 1) % tickerMessages.length;
      tickerEl.textContent = tickerMessages[tickerIndex];
    }, 3200);
  }

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

  const slotMeta = {
    track: {
      title: "SLOT 01 / WORLD_1",
      desc: "公開前の編集ワールドです。現在の状態: private",
    },
    structure: {
      title: "SLOT 02 / WORLD_2",
      desc: "公開前の編集ワールドです。現在の状態: private",
    },
    scene: {
      title: "SLOT 03 / WORLD_3",
      desc: "公開前の編集ワールドです。現在の状態: private",
    },
  };

  function setActiveSlot(slotKey) {
    const meta = slotMeta[slotKey];
    if (!meta) {
      return;
    }
    editSlots.forEach((slot) => {
      const isActive = slot.dataset.slot === slotKey;
      slot.classList.toggle("is-active", isActive);
    });
    if (detailTitle) {
      detailTitle.textContent = meta.title;
    }
    if (detailDesc) {
      detailDesc.innerHTML = meta.desc.replace("private", '<span class="detail-private">private</span>');
    }
    if (startWorldBtn) {
      startWorldBtn.href = `./index.html?edit_slot=${encodeURIComponent(slotKey)}`;
    }
  }

  editSlots.forEach((slot) => {
    slot.addEventListener("click", () => {
      setActiveSlot(slot.dataset.slot);
    });
  });

  setActiveSlot("track");

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
    if (mapModalStartBtn) {
      mapModalStartBtn.href = card.dataset.mapHref || "./index.html";
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

  if (showFeaturesBtn && featuresSection) {
    showFeaturesBtn.addEventListener("click", () => {
      featuresSection.hidden = false;
      featuresSection.classList.remove("is-collapsed");
    });
  }
})();
