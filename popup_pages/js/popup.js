// Cache DOM elements and initialize variables at the start
const ELEMENTS = {
  copyButton: null,
  exportButton: null,
  statusDiv: null,
  favicon: null,
  dataPreview: null
};

let scrapedData = null;
const STATUS_TIMEOUT = 2000;
const PREVIEW_LIMIT = 5;

// Initialize DOM elements once document is loaded
const initializeElements = () => {
  ELEMENTS.copyButton = document.getElementById("copyButton");
  ELEMENTS.exportButton = document.getElementById("exportButton");
  ELEMENTS.statusDiv = document.getElementById("status");
  ELEMENTS.favicon = document.getElementById("favicon_img");
  ELEMENTS.dataPreview = document.getElementById("dataPreview");
};

// Optimize status updates with pre-defined styles
const STATUS_STYLES = {
  success: "mt-4 p-3 bg-success text-white rounded",
  error: "mt-4 p-3 bg-danger text-white rounded",
  warning: "mt-4 p-3 bg-warning text-white rounded",
  info: "mt-4 p-3 bg-primary text-white rounded"
};

const updateStatus = (message, type = 'info', autoHide = true) => {
  ELEMENTS.statusDiv.className = STATUS_STYLES[type];
  ELEMENTS.statusDiv.textContent = message;

  if (autoHide) {
    setTimeout(() => {
      ELEMENTS.statusDiv.style.opacity = "0";
      setTimeout(() => {
        ELEMENTS.statusDiv.textContent = "";
        ELEMENTS.statusDiv.style.opacity = "1";
      }, 500);
    }, STATUS_TIMEOUT);
  }
};

// Optimize preview card creation with template strings and minimal DOM operations
const createPreviewCard = (key, value) => {
  const card = document.createElement("div");
  card.className = "preview-card";
  card.innerHTML = `
    <div class="key" style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600">
      ${key}
    </div>
    <div class="value" style="font-size:14px;color:#212529;word-break:break-word;font-weight:500">
      ${value || "N/A"}
    </div>
  `;
  
  // Use CSS transforms for better performance
  card.style.cssText = `
    background:#f8f9fa;
    border-radius:8px;
    padding:12px;
    margin:8px;
    flex:1 1 calc(50% - 16px);
    min-width:200px;
    box-shadow:0 2px 4px rgba(0,0,0,0.05);
    transform:translateY(0);
    transition:transform 0.2s ease,box-shadow 0.2s ease;
  `;

  return card;
};

// Optimize data preview with DocumentFragment
const displayDataPreview = (data) => {
  const fragment = document.createDocumentFragment();
  const previewContainer = document.createElement("div");
  
  previewContainer.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:16px;
    max-height:400px;
    overflow-y:auto;
    padding-right:8px;
    scrollbar-width:thin;
    scrollbar-color:#6c757d #f8f9fa;
  `;

  const entries = Object.entries(data);
  entries.slice(0, PREVIEW_LIMIT).forEach(([key, value]) => {
    previewContainer.appendChild(createPreviewCard(key, value));
  });

  if (entries.length > PREVIEW_LIMIT) {
    previewContainer.insertAdjacentHTML(
      'beforeend',
      `<div style="width:100%;text-align:center;padding:12px;color:#6c757d;font-size:13px;font-style:italic">
        + ${entries.length - PREVIEW_LIMIT} more items
      </div>`
    );
  }

  fragment.appendChild(previewContainer);
  ELEMENTS.dataPreview.innerHTML = "";
  ELEMENTS.dataPreview.appendChild(fragment);
};

// Optimize clipboard operations
const copyToClipboard = async (data) => {
  if (!data) {
    updateStatus("No data available to copy!", "warning");
    return;
  }

  try {
    const tableText = `${Object.keys(data).join("\t")}\n${Object.values(data).join("\t")}`;
    await navigator.clipboard.writeText(tableText);
    updateStatus("Copied to Clipboard", "success");
  } catch (err) {
    updateStatus(err.message, "error");
  }
};

// Main initialization
document.addEventListener("DOMContentLoaded", () => {
  initializeElements();

  // Set up message listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SCRAPED_DATA") {
      scrapedData = message.data;
      displayDataPreview(scrapedData);
    }
  });

  // Set favicon
  chrome.tabs.query({ active: true }, ([tab]) => {
    if (tab?.favIconUrl) {
      ELEMENTS.favicon.src = tab.favIconUrl;
    }
  });

  // Event listeners
  ELEMENTS.copyButton.addEventListener("click", () => copyToClipboard(scrapedData));
  
  ELEMENTS.exportButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.runtime.sendMessage(
        { type: "EXPORTSHEETS", url: tab.url },
        (response) => {
          updateStatus(
            response.message,
            response.success ? "success" : "error",
            !response.success
          );
        }
      );
    });
  });

  // Initial data scrape request
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.runtime.sendMessage({
      type: "SCRAPE_DATA_POPUP",
      tab: { url: tab.url, tab: { id: tab.id } }
    });
  });
});