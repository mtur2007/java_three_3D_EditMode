import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qhduggmhxwrtsiubhvww.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZHVnZ21oeHdydHNpdWJodnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODU4NjYsImV4cCI6MjA4OTY2MTg2Nn0.3nnFOShw18BiFYtupRpra8rpVNXDZvqnB5A00lmcGRo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.mouseDemoSupabase = {
  client: supabase,
  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  },
};

function getDisplayName(user) {
  const meta = user?.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata
    : {};
  const rawName = String(meta.display_name || meta.displayName || "").trim();
  if (rawName) {
    return rawName;
  }
  const email = String(user?.email || "").trim();
  return email ? email.split("@")[0] || "user" : "user";
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
  const authSignupBtn = document.getElementById("auth-signup-btn");
  const editAuthNote = document.getElementById("edit-auth-note");
  const protectedTargets = Array.from(document.querySelectorAll("[data-auth-protected]"));
  const isEditorPage = String(document.body?.dataset?.authRole || "").trim().toLowerCase() === "editor";

  if (!authChip || !authToggleBtn || !authModal || !authForm || !authEmail || !authPassword) {
    return;
  }

  let session = null;
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
    const signedIn = Boolean(session?.user);
    protectedTargets.forEach((target) => {
      target.classList.toggle("is-disabled", !signedIn);
      target.setAttribute("aria-disabled", signedIn ? "false" : "true");
    });
  }

  function updateAuthUi() {
    const signedIn = Boolean(session?.user);
    const user = session?.user || null;
    authChip.textContent = signedIn
      ? `SIGNED IN / ${getDisplayName(user)}`
      : "GUEST MODE";
    authChip.dataset.state = signedIn ? "signed-in" : "guest";
    authToggleBtn.textContent = signedIn ? "ログアウト" : "ログイン";
    if (editAuthNote) {
      editAuthNote.textContent = signedIn ? "" : "";
    }
    updateProtectedTargets();
  }

  document.addEventListener("click", (event) => {
    if (session?.user || !(event.target instanceof Element)) {
      return;
    }
    const protectedTarget = event.target.closest("[data-auth-protected]");
    if (!protectedTarget) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openAuthModal("この操作にはログインが必要です。");
  }, true);

  function notifyAuthState() {
    window.dispatchEvent(new CustomEvent("mouse-demo-auth-change", {
      detail: {
        session,
      },
    }));
  }

  async function refreshSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[auth] failed to restore session", error);
      session = null;
      updateAuthUi();
      notifyAuthState();
      return;
    }
    session = data?.session || null;
    updateAuthUi();
    notifyAuthState();
  }

  authToggleBtn.addEventListener("click", async () => {
    if (session?.user) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthMessage(`ログアウトに失敗しました: ${error.message}`, "error");
        return;
      }
      session = null;
      updateAuthUi();
      notifyAuthState();
      return;
    }
    openAuthModal(isEditorPage ? "編集ページに入るにはログインしてください。" : "");
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(authEmail.value || "").trim();
    const password = String(authPassword.value || "").trim();
    if (!email || !password) {
      setAuthMessage("メールアドレスとパスワードを入力してください。", "error");
      return;
    }
    setAuthMessage("ログイン中です...", "info");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setAuthMessage(`ログインに失敗しました: ${error.message}`, "error");
      return;
    }
    session = data?.session || null;
    updateAuthUi();
    notifyAuthState();
    closeAuthModal();
  });

  if (authSignupBtn) {
    authSignupBtn.addEventListener("click", async () => {
      const email = String(authEmail.value || "").trim();
      const password = String(authPassword.value || "").trim();
      const displayName = String(authDisplayName?.value || "").trim();
      if (!email || !password) {
        setAuthMessage("新規登録にはメールアドレスとパスワードを入力してください。", "error");
        return;
      }
      setAuthMessage("アカウントを作成中です...", "info");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });
      if (error) {
        setAuthMessage(`新規登録に失敗しました: ${error.message}`, "error");
        return;
      }
      session = data?.session || null;
      updateAuthUi();
      notifyAuthState();
      if (session?.user) {
        closeAuthModal();
        return;
      }
      setAuthMessage("新規登録が完了しました。確認メールが届いた場合はメール内リンクから有効化してください。", "info");
    });
  }

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

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession || null;
    updateAuthUi();
    notifyAuthState();
  });

  refreshSession();
})();
