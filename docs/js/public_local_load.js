const bootPanel = document.querySelector(".boot-panel");

function showBootError(error) {
  if (bootPanel) {
    bootPanel.innerHTML = `
      <p class="boot-title">LOCAL RUNTIME VIEWER</p>
      <p class="boot-text">index.html の読込に失敗しました。</p>
      <p class="boot-text">${String(error?.message || error)}</p>
    `;
  }
  console.error("[public_local_load] index bootstrap failed", error);
}

async function bootIndexDocument() {
  const response = await fetch("./index.html", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`index.html fetch failed: ${response.status}`);
  }
  const html = await response.text();
  document.open();
  document.write(html);
  document.close();
}

bootIndexDocument().catch(showBootError);
