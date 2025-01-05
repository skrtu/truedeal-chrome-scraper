document.addEventListener("DOMContentLoaded", () => {
  const copyButton = document.getElementById("copyButton");
  const exportButton = document.getElementById("exportButton");
  const statusDiv = document.getElementById("status");
  const favicon = document.getElementById("favicon_img");
  const dataPreview = document.getElementById("dataPreview");
  let scrapedData = null;

  chrome.tabs.query({ active: true }, (tabs) => {
    favicon.setAttribute("src", tabs[0].favIconUrl);
  });

  // Function to create a pretty preview card for a key-value pair
  const createPreviewCard = (key, value) => {
    const card = document.createElement("div");
    card.className = "preview-card";
    card.style.cssText = `
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin: 8px;
      flex: 1 1 calc(50% - 16px);
      min-width: 200px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;

    // Add hover effect
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-2px)";
      card.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
    });

    const keyElement = document.createElement("div");
    keyElement.className = "key";
    keyElement.style.cssText = `
      font-size: 12px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      font-weight: 600;
    `;
    keyElement.textContent = key;

    const valueElement = document.createElement("div");
    valueElement.className = "value";
    valueElement.style.cssText = `
      font-size: 14px;
      color: #212529;
      word-break: break-word;
      font-weight: 500;
    `;
    valueElement.textContent = value || "N/A";

    card.appendChild(keyElement);
    card.appendChild(valueElement);
    return card;
  };

  // Function to display preview of the first 5 items
  const displayDataPreview = (data) => {
    dataPreview.innerHTML = ""; // Clear existing content

    // Create container for preview cards
    const previewContainer = document.createElement("div");
    previewContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
      max-height: 400px;
      overflow-y: auto;
      padding-right: 8px;
    `;

    // Add custom scrollbar styles
    previewContainer.addEventListener("mouseenter", () => {
      previewContainer.style.cssText += `
        scrollbar-width: thin;
        scrollbar-color: #6c757d #f8f9fa;
      `;
    });

    // Get the first 5 entries
    const entries = Object.entries(data);
    const previewEntries = entries.slice(0, 5);

    // Create a preview card for each entry
    previewEntries.forEach(([key, value]) => {
      const card = createPreviewCard(key, value);
      previewContainer.appendChild(card);
    });

    // Add "more items" indicator if there are more than 5 items
    if (entries.length > 5) {
      const moreItems = document.createElement("div");
      moreItems.style.cssText = `
        width: 100%;
        text-align: center;
        padding: 12px;
        color: #6c757d;
        font-size: 13px;
        font-style: italic;
      `;
      moreItems.textContent = `+ ${entries.length - 5} more items`;
      previewContainer.appendChild(moreItems);
    }

    dataPreview.appendChild(previewContainer);
  };

  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCRAPED_DATA") {
      scrapedData = message.data;
      displayDataPreview(scrapedData);
    }
  });

  // Copy button click handler
  copyButton.addEventListener("click", () => {
    if (scrapedData) {
      const tableText = [
        Object.keys(scrapedData).join("\t"),
        Object.values(scrapedData).join("\t"),
      ].join("\n");

      navigator.clipboard
        .writeText(tableText)
        .then(() => {
          statusDiv.className = "mt-4 p-3 bg-success text-white rounded";
          statusDiv.textContent = "Copied to Clipboard";

          // Add fade out effect for status message
          setTimeout(() => {
            statusDiv.style.transition = "opacity 0.5s ease-out";
            statusDiv.style.opacity = "0";
            setTimeout(() => {
              statusDiv.textContent = "";
              statusDiv.style.opacity = "1";
            }, 500);
          }, 2000);
        })
        .catch((err) => {
          statusDiv.className = "mt-4 p-3 bg-danger text-white rounded";
          statusDiv.textContent = err;
        });
    } else {
      statusDiv.className = "mt-4 p-3 bg-warning text-white rounded";
      statusDiv.textContent = "No data available to copy!";
    }
  });

  // Export button click handler
  exportButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.runtime.sendMessage(
        { type: "EXPORTSHEETS", url: tabs[0].url },
        (response) => {
          statusDiv.className = "mt-4 p-3 bg-primary text-white rounded";
          statusDiv.textContent = "Exporting Table...";

          if (response.success) {
            statusDiv.className = "mt-4 p-3 bg-success text-white rounded";
            statusDiv.textContent = response.message;
          } else {
            statusDiv.className = "mt-4 p-3 bg-danger text-white rounded";
            statusDiv.textContent = response.message;
          }
        }
      );
    });
  });

  // Request the content script to scrape data
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage({ type: "SCRAPE_DATA_POPUP", tab: {url: tabs[0].url, tab:{id: tabs[0].id }} });
  });
});
