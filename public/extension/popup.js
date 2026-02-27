document.addEventListener("DOMContentLoaded", async () => {
  const setupSection = document.getElementById("setupSection");
  const saveSection = document.getElementById("saveSection");
  const saveBtn = document.getElementById("saveBtn");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const saveStatus = document.getElementById("saveStatus");
  const setupStatus = document.getElementById("setupStatus");
  const pageTitleEl = document.getElementById("pageTitle");
  const pageUrlEl = document.getElementById("pageUrl");

  // Load config
  const config = await chrome.storage.local.get(["apiUrl", "accessToken"]);

  if (config.apiUrl && config.accessToken) {
    showSaveView(config);
  } else {
    showSetupView();
  }

  function showSetupView() {
    setupSection.classList.add("active");
    saveSection.classList.remove("active");
    if (config.apiUrl) document.getElementById("apiUrl").value = config.apiUrl;
  }

  async function showSaveView(cfg) {
    setupSection.classList.remove("active");
    saveSection.classList.add("active");

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pageTitleEl.textContent = tab.title || "Untitled";
      pageUrlEl.textContent = tab.url || "";
    }
  }

  // Save config
  saveConfigBtn.addEventListener("click", async () => {
    const apiUrl = document.getElementById("apiUrl").value.trim();
    const accessToken = document.getElementById("accessToken").value.trim();

    if (!apiUrl || !accessToken) {
      setupStatus.className = "status error";
      setupStatus.textContent = "Both fields are required.";
      return;
    }

    // Test the connection
    try {
      saveConfigBtn.disabled = true;
      saveConfigBtn.textContent = "Testing...";

      const resp = await fetch(`${apiUrl}/functions/v1/save-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url: "https://test.example.com/__connection_test__" }),
      });

      if (resp.status === 401) {
        setupStatus.className = "status error";
        setupStatus.textContent = "Invalid token. Please check your access token.";
        return;
      }

      // Save config
      await chrome.storage.local.set({ apiUrl, accessToken });
      config.apiUrl = apiUrl;
      config.accessToken = accessToken;

      setupStatus.className = "status success";
      setupStatus.textContent = "Connected! Reopen the extension to start saving.";

      setTimeout(() => showSaveView(config), 1000);
    } catch (e) {
      setupStatus.className = "status error";
      setupStatus.textContent = "Connection failed: " + e.message;
    } finally {
      saveConfigBtn.disabled = false;
      saveConfigBtn.textContent = "Save Configuration";
    }
  });

  // Save link
  saveBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    saveStatus.className = "status";
    saveStatus.style.display = "none";

    try {
      const resp = await fetch(`${config.apiUrl}/functions/v1/save-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({ url: tab.url, title: tab.title || "" }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        saveStatus.className = "status error";
        saveStatus.textContent = data.error || "Failed to save";
      } else if (data.duplicate) {
        saveStatus.className = "status duplicate";
        saveStatus.textContent = "Already in your library!";
      } else {
        saveStatus.className = "status success";
        saveStatus.textContent = "Saved! AI analysis started.";
      }
    } catch (e) {
      saveStatus.className = "status error";
      saveStatus.textContent = "Network error: " + e.message;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save to Library";
    }
  });

  // Settings button
  settingsBtn.addEventListener("click", () => {
    showSetupView();
  });
});
