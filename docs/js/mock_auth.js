const DEMO_AUTH_STORAGE_KEY = "train-editmode-demo-auth";

function readDemoSession() {
  try {
    const raw = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const email = String(parsed.email || "").trim();
    const displayName = String(parsed.displayName || "").trim();
    if (!email) {
      return null;
    }
    return {
      email,
      displayName: displayName || email.split("@")[0] || "demo_user",
      loggedInAt: Number(parsed.loggedInAt) || Date.now(),
    };
  } catch (_error) {
    return null;
  }
}

function writeDemoSession(session) {
  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearDemoSession() {
  window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
}

(() => {
  const authChip = document.getElementById("auth-chip");
  const authToggleBtn = document.getElementById("auth-toggle-btn");
  const authModal = document.getElementById("auth-modal");
  const authModalClose = document.getElementById("auth-modal-close");
  const authForm = document.getElementById("auth-form");
  const authDisplayName = document.getElementById("auth-display-name");
  const authEmail = document.getElementById("auth-email");
  const authPassword = document.getElementById("auth-password");
  const authMessage = document.getElementById("auth-message");
  const editAuthNote = document.getElementById("edit-auth-note");
  const protectedTargets = Array.from(document.querySelectorAll("[data-auth-protected]"));
  const loginRequiredLinks = Array.from(document.querySelectorAll("[data-auth-requires-login]"));
  const isEditorPage = String(document.body?.dataset?.authRole || "").trim().toLowerCase() === "editor";

  if (!authChip || !authToggleBtn || !authModal || !authForm || !authEmail || !authPassword) {
    return;
  }

  let session = readDemoSession();
  let pendingHref = "";

  function setAuthMessage(message, type = "info", visible = true) {
    if (!authMessage) {
      return;
    }
    authMessage.textContent = message;
    authMessage.dataset.type = type;
    authMessage.hidden = !visible || !message;
  }

  function openAuthModal(message = "") {
    authModal.classList.add("is-open");
    authModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setAuthMessage(message, message ? "info" : "info", Boolean(message));
    window.setTimeout(() => {
      if (!String(authEmail.value || "").trim()) {
        authEmail.focus();
        return;
      }
      authPassword.focus();
    }, 0);
  }

  function closeAuthModal() {
    authModal.classList.remove("is-open");
    authModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    setAuthMessage("", "info", false);
  }

  function updateProtectedTargets() {
    const signedIn = Boolean(session);
    protectedTargets.forEach((target) => {
      target.classList.toggle("is-disabled", !signedIn);
      target.setAttribute("aria-disabled", signedIn ? "false" : "true");
    });
  }

  function updateAuthUi() {
    const signedIn = Boolean(session);
    authChip.textContent = signedIn
      ? `SIGNED IN / ${session.displayName}`
      : "GUEST MODE";
    authChip.dataset.state = signedIn ? "signed-in" : "guest";
    authToggleBtn.textContent = signedIn ? "ログアウト" : "ログイン";
    if (editAuthNote) {
      editAuthNote.textContent = "";
    }
    updateProtectedTargets();
  }

  loginRequiredLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (session) {
        return;
      }
      event.preventDefault();
      pendingHref = String(link.getAttribute("href") || "").trim();
      openAuthModal("編集ページへ進むにはデモログインしてください。");
    });
  });

  protectedTargets.forEach((target) => {
    if (target instanceof HTMLButtonElement) {
      target.addEventListener("click", (event) => {
        if (session) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        openAuthModal("この操作はデモログイン後に有効になります。");
      }, true);
      return;
    }
    target.addEventListener("click", (event) => {
      if (session) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      openAuthModal("この操作はデモログイン後に有効になります。");
    }, true);
  });

  authToggleBtn.addEventListener("click", () => {
    if (session) {
      clearDemoSession();
      session = null;
      updateAuthUi();
      return;
    }
    openAuthModal(isEditorPage ? "編集ページ用のデモログインです。" : "");
  });

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = String(authEmail.value || "").trim();
    const password = String(authPassword.value || "").trim();
    const rawDisplayName = String(authDisplayName?.value || "").trim();
    if (!email || !password) {
      setAuthMessage("メールアドレスとパスワードを入力してください。", "error");
      return;
    }
    session = {
      email,
      displayName: rawDisplayName || email.split("@")[0] || "demo_user",
      loggedInAt: Date.now(),
    };
    writeDemoSession(session);
    updateAuthUi();
    closeAuthModal();
    if (pendingHref) {
      const nextHref = pendingHref;
      pendingHref = "";
      window.location.href = nextHref;
    }
  });

  authModal.querySelectorAll("[data-auth-close]").forEach((element) => {
    element.addEventListener("click", closeAuthModal);
  });
  if (authModalClose) {
    authModalClose.addEventListener("click", closeAuthModal);
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && authModal.classList.contains("is-open")) {
      closeAuthModal();
    }
  });

  updateAuthUi();
})();
