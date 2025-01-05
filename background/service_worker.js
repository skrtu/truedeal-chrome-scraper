let scraped_data = null;

class GoogleSheetsAPI {
  static async authenticate() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Authentication failed:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(token);
      });
    });
  }

  static async removeCachedAuthToken(token) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, resolve);
    });
  }

  static async createSheet(token, siteName) {
    const url = "https://sheets.googleapis.com/v4/spreadsheets";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        properties: {
          title: `${siteName} Scraped Data - ${new Date().toLocaleDateString()}`,
        },
      }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        await this.removeCachedAuthToken(token);
        throw new Error("Authentication token expired. Please try again.");
      }
      throw new Error(data.error?.message || "Failed to create Google Sheet");
    }
    return data.spreadsheetId;
  }

  static async appendData(sheetId, token, data) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        values: [Object.keys(data), Object.values(data)],
      }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        await this.removeCachedAuthToken(token);
        throw new Error("Authentication token expired. Please try again.");
      }
      throw new Error(result.error?.message || "Failed to append data");
    }
    
    console.log("Data appended successfully");
    await this.removeDuplicates(sheetId, token);
  }

  static async removeDuplicates(sheetId, token) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requests: [{
          deleteDuplicates: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              startColumnIndex: 0,
            }
          }
        }]
      })
    });

    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        await this.removeCachedAuthToken(token);
        throw new Error("Authentication token expired. Please try again.");
      }
      throw new Error(result.error?.message || "Failed to remove duplicates");
    }
    console.log("Duplicates removed successfully");
  }
}

class SiteManager {
  constructor(supportedSites) {
    this.supportedSites = supportedSites;
  }

  extractMainDomain(url) {
    url = url.replace(/^https?:\/\//, "");
    const parts = url.split("/");
    const domainParts = parts[0].split(".");
    return domainParts.length > 2 ? domainParts.slice(-2).join(".") : parts[0];
  }

  getSiteName(url) {
    for (const pattern of Object.keys(this.supportedSites)) {
      if (this.extractMainDomain(url) === this.extractMainDomain(pattern)) {
        return this.extractMainDomain(pattern);
      }
    }
    return 'Unknown Site';
  }

  checkMatchingSite(url) {
    console.log("Checking matching site for", url);
    for (const [pattern, selectors] of Object.entries(this.supportedSites)) {
      if (url.includes(pattern)) {
        return selectors;
      }
    }
    return null;
  }
}

class TabManager {
  static async focusOrCreateSheetTab(sheetUrl) {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const existingTab = tabs.find(tab => tab.url?.includes(sheetUrl));
        if (existingTab) {
          chrome.tabs.update(existingTab.id, { active: true }, () => {
            chrome.windows.update(existingTab.windowId, { focused: true });
            resolve(existingTab);
          });
        } else {
          chrome.tabs.create({ url: sheetUrl, active: true }, resolve);
        }
      });
    });
  }
}

// Initialize the service worker
try {
  // Import selector rules
  self.importScripts("selector_rules.js");
  self.importScripts("property_schema.js");
  console.log("Service worker is running");

  const supportedSites = {
    "web.bcpa.net": bcpaSchema,
    "www.miamidade.gov":miamidadeSchema,
    "paopropertysearch.coj.net": paopropterySchema,
    "collierappraiser.com":collierSchema
    
  };

  const siteManager = new SiteManager(supportedSites);

  async function handleScrapeRequest(sender, sendResponse) {
    const matchingSite = siteManager.checkMatchingSite(sender.url);
    if (!matchingSite) {
      sendResponse({ error: "Site not supported for scraping." });
      return;
    }
    console.log(matchingSite)
    chrome.tabs.sendMessage(
      sender.tab.id,
      { type: "SCRAPE_PAGE", schema: matchingSite },
      (response) => {
        if (response?.data) {
          console.log("Scraped Data:", response.data);
          scraped_data = response.data;
          sendResponse({ success: true, data: response.data });
        } else {
          sendResponse({ error: "Failed to scrape data" });
        }
      }
    );
    return true;
  }

  async function handleExportRequest(request, sendResponse) {
    try {
      const token = await GoogleSheetsAPI.authenticate();
      const siteName = siteManager.getSiteName(request.url);
      const storageKey = `sheetId_${siteName}`;

      chrome.storage.local.get([storageKey], async (result) => {
        try {
          let sheetId = result[storageKey];
          let isNewSheet = false;

          if (!sheetId) {
            console.log("Creating new Google Sheet for", siteName);
            sheetId = await GoogleSheetsAPI.createSheet(token, siteName);
            isNewSheet = true;
            chrome.storage.local.set({ [storageKey]: sheetId });
          }

          await GoogleSheetsAPI.appendData(sheetId, token, scraped_data);
          const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
          await TabManager.focusOrCreateSheetTab(sheetUrl);

          sendResponse({
            success: true,
            message: `Data ${isNewSheet ? 'exported to new' : 'appended to existing'} Google Sheet for ${siteName}`
          });
        } catch (error) {
          console.error("Export error:", error);
          sendResponse({ success: false, message: error.message });
        }
      });
    } catch (error) {
      console.error("Authentication failed:", error);
      sendResponse({ success: false, message: error.message });
    }
    return true;
  }



async function handleScrapeAndExport(sender, request, sendResponse) {
  const matchingSite = siteManager.checkMatchingSite(sender.url);
  if (!matchingSite) {
    sendResponse({ error: "Site not supported for scraping." });
    return true;
  }

  // First scrape the data
  chrome.tabs.sendMessage(
    sender.tab.id,
    { type: "SCRAPE_PAGE", schema: matchingSite },
    async (scrapeResponse) => {
      if (scrapeResponse?.data) {
        console.log("Scraped Data:", scrapeResponse.data);
        scraped_data = scrapeResponse.data;
        
        // Then perform the export
        try {
          const token = await GoogleSheetsAPI.authenticate();
          const siteName = siteManager.getSiteName(request.url);
          const storageKey = `sheetId_${siteName}`;

          chrome.storage.local.get([storageKey], async (result) => {
            try {
              let sheetId = result[storageKey];
              let isNewSheet = false;

              if (!sheetId) {
                console.log("Creating new Google Sheet for", siteName);
                sheetId = await GoogleSheetsAPI.createSheet(token, siteName);
                isNewSheet = true;
                chrome.storage.local.set({ [storageKey]: sheetId });
              }

              await GoogleSheetsAPI.appendData(sheetId, token, scraped_data);
              const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
              await TabManager.focusOrCreateSheetTab(sheetUrl);

              sendResponse({
                success: true,
                message: `Data ${isNewSheet ? 'exported to new' : 'appended to existing'} Google Sheet for ${siteName}`
              });
            } catch (error) {
              console.error("Export error:", error);
              sendResponse({ success: false, message: error.message });
            }
          });
        } catch (error) {
          console.error("Authentication failed:", error);
          sendResponse({ success: false, message: error.message });
        }
      } else {
        sendResponse({ error: "Failed to scrape data" });
      }
    }
  );
  return true;
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "SCRAPE_DATA":
      return handleScrapeRequest(sender, sendResponse);
      case "SCRAPE_DATA_POPUP":
      return handleScrapeRequest(request.tab, sendResponse);
    
    case "EXPORTSHEETS":
      // Direct export using existing scraped data
      return handleExportRequest(request, sendResponse);
    
    case "EXPORT_SHEETS_DOM":
      // Scrape first, then export
      return handleScrapeAndExport(sender, request, sendResponse);
    
    case "INJECT_BUTTONS":
      const isAllowed = !!siteManager.checkMatchingSite(sender.url);
      const selectors = siteManager.checkMatchingSite(sender.url)
      sendResponse({ allowed: isAllowed, schema:selectors });
      return false;
  }
});



} catch (error) {
  console.error("Service Worker Error:", error);
}