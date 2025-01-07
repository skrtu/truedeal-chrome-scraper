class TableParser {
  static TableTypes = {
    HORIZONTAL: "horizontal", // Key-value pairs (2 columns)
    VERTICAL: "vertical", // Headers in first row
    MATRIX: "matrix", // Headers in both first row and column
  };

  /**
   * @param {Document} document - The document object
   * @param {Object} config - Configuration object
   * @param {string} [config.tableSelector] - CSS selector for the table
   * @param {Array} [config.tableData] - Array of header/data to find table
   * @param {string} config.type - Type of table (horizontal, vertical, or matrix)
   */
  constructor(document, config) {
    this.document = document;
    this.type = config.type;
    this.table = null;
    this.config = config
    
    if (config.tableSelector) {
     
      this.table = this.document.querySelector(config.tableSelector);
      
    } else if (config.tableData) {
      this.table = this.findTableByData(config.tableData);
    }

  

    // Initialize header positions based on table type
    this.headerRow = this.type !== TableParser.TableTypes.HORIZONTAL ? 0 : null;
    this.headerColumn =
      this.type !== TableParser.TableTypes.VERTICAL ? 0 : null;
  }

  /**
   * Find table containing specific data
   */
  findTableByData(searchData) {
    // Get all tables in the document
    const tables = Array.from(this.document.getElementsByTagName("table"));

    // Function to check if table contains all search items
    const containsAllData = (table) => {
      const tableText = table.textContent.toLowerCase();
      return searchData.every((item) =>
        tableText.includes(item.toString().toLowerCase())
      );
    };

    // Function to get the nesting level of a table
    const getNestingLevel = (table) => {
      let level = 0;
      let parent = table.parentElement;
      while (parent) {
        if (parent.tagName === "TABLE") {
          level++;
        }
        parent = parent.parentElement;
      }
      return level;
    };

    // Filter tables that contain the search data
    const matchingTables = tables.filter(containsAllData);

    if (matchingTables.length === 0) {
      return null;
    }

    // Sort tables by nesting level (ascending)
    // If multiple tables have the same nesting level, maintain their original DOM order
    return matchingTables.sort((a, b) => {
      const levelA = getNestingLevel(a);
      const levelB = getNestingLevel(b);
      return levelA - levelB;
    })[0];
  }

  //Get by cell selector

  getbyCellSelector(cellSelector) {
    try {
      return this.document.querySelector(cellSelector);
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  getBySelectors() {
    try {
      const config = this.config;
  
      if (!config?.tableSelectors || typeof config.tableSelectors !== 'object') {
        throw new Error('tableSelectors configuration is required and must be an object');
      }
  
      const result = {};
  
      // Iterate through each selector in the configuration
      for (const [key, selector] of Object.entries(config.tableSelectors)) {
        try {
          const element = this.document.querySelector(selector);
          // If element is found, get its text content, otherwise store null
          result[key] = element ? this.getFirstElementText(element) : null;
        } catch (selectorError) {
          console.error(`Error processing selector '${key}':`, selectorError);
          result[key] = null;
        }
      }
  
      return result;
    } catch (error) {
      console.error('Error in getBySelectors:', error);
      return null;
    }
  }
  /**
   * Get cell value by coordinates
   */
  getByCell(row, col) {
    try {
      return this.table.rows[row].cells[col].textContent.trim();
    } catch (error) {
      console.error(`Error getting cell [${row},${col}]:`, error);
      return null;
    }
  }

  /**
   * Get cell value by header names
   */
  getByCellHeader(rowHeader, colHeader = null) {
    try {
      switch (this.type) {
        case TableParser.TableTypes.HORIZONTAL:
          const rowIndex = this.findIndexByText(rowHeader, true);
          return this.getByCell(rowIndex, 1);

        case TableParser.TableTypes.VERTICAL:
          const colIndex = this.findIndexByText(rowHeader, false);
          return this.getByCell(1, colIndex);

        case TableParser.TableTypes.MATRIX:
          if (!colHeader)
            throw new Error("Column header required for matrix table");
          const row = this.findIndexByText(rowHeader, true);
          const col = this.findIndexByText(colHeader, false);
          return this.getByCell(row, col);

        default:
          throw new Error("Invalid table type");
      }
    } catch (error) {
      console.error("Error getting cell by headers:", error);
      return null;
    }
  }

  /**
   * Get all data from a specific row
   */
  getRowData(identifier) {
    try {
      let rowIndex;
      if (typeof identifier === "number") {
        rowIndex = identifier;
      } else {
        rowIndex = this.findIndexByText(identifier, true);
      }

      const row = this.table.rows[rowIndex];
      if (!row) return null;

      const startCol = this.type === TableParser.TableTypes.MATRIX ? 1 : 0;
      return Array.from(row.cells)
        .slice(startCol)
        .map((cell) => cell.textContent.trim());
    } catch (error) {
      console.error("Error getting row data:", error);
      return null;
    }
  }

  /**
   * Get all data from a specific column
   */
  getColumnData(identifier) {
    try {
      let colIndex;
      if (typeof identifier === "number") {
        colIndex = identifier;
      } else {
        colIndex = this.findIndexByText(identifier, false);
      }

      const startRow = this.type === TableParser.TableTypes.VERTICAL ? 1 : 0;
      return Array.from(this.table.rows)
        .slice(startRow)
        .map((row) => row.cells[colIndex]?.textContent.trim() || "");
    } catch (error) {
      console.error("Error getting column data:", error);
      return null;
    }
  }


  /**
   * Get all table data as an array of objects
   */

  getAllData() {
    try {
      if (!this.table) {
        console.error('No table found');
        return null;
      }

      // Get ignore configuration with proper defaults
      const ignoreConfig = {
        values: this.config?.ignoreRows?.values || [],
        columns: this.config?.ignoreRows?.columns || [],
        caseSensitive: this.config?.ignoreRows?.caseSensitive || false,
        indices: this.config?.ignoreRows?.indices || []
      };

      console.log('Processing table:', {
        type: this.type,
        selector: this.config.tableSelector,
        ignoreConfig
      });

      const rows = Array.from(this.table.rows);
      console.log('Total rows before filtering:', rows.length);

      // Helper to check if row should be ignored by value
      const shouldIgnoreByValue = (row) => {
        if (!ignoreConfig.values.length || !ignoreConfig.columns.length) {
          return false;
        }

        return ignoreConfig.columns.some(colIndex => {
          if (!row.cells[colIndex]) return false;
          
          const cellText = this.getFirstElementText(row.cells[colIndex]);
          const normalizedCell = ignoreConfig.caseSensitive ? 
            cellText : 
            cellText.toLowerCase();

          return ignoreConfig.values.some(value => {
            const normalizedValue = ignoreConfig.caseSensitive ?
              String(value) :
              String(value).toLowerCase();
            
            const isMatch = normalizedCell === normalizedValue;
            if (isMatch) {
              console.log('Value match found:', {
                cell: cellText,
                value: value,
                colIndex
              });
            }
            return isMatch;
          });
        });
      };

      // Filter rows based on type-specific logic
      const filteredRows = rows.filter((row, index) => {
        // Check index-based filtering
        if (ignoreConfig.indices.includes(index)) {
          console.log('Filtered out by index:', index);
          return false;
        }

        // Check value-based filtering
        if (shouldIgnoreByValue(row)) {
          console.log('Filtered out by value:', this.getFirstElementText(row.cells[0]));
          return false;
        }

        return true;
      });

      console.log('Rows after filtering:', filteredRows.length);

      // Process filtered rows based on table type
      switch (this.type) {
        case TableParser.TableTypes.HORIZONTAL: {
          const result = {};
          for (const row of filteredRows) {
            if (row.cells.length >= 2) {
              const key = this.getFirstElementText(row.cells[0]);
              result[key] = this.getFirstElementText(row.cells[1]);
            }
          }
          console.log('Horizontal parse result:', result);
          return result;
        }

        case TableParser.TableTypes.VERTICAL: {
          if (filteredRows.length === 0) return {};
          
          const headers = Array.from(filteredRows[0].cells).map(cell => 
            this.getFirstElementText(cell)
          );
          
          const result = {};
          for (let i = 1; i < filteredRows.length; i++) {
            const row = filteredRows[i];
            headers.forEach((header, colIndex) => {
              const value = row.cells[colIndex] ? 
                this.getFirstElementText(row.cells[colIndex]) : 
                "N/A";
              result[`${header}_${i-1}`] = value;
            });
          }
          console.log('Vertical parse result:', result);
          return result;
        }

        case TableParser.TableTypes.MATRIX: {
          if (filteredRows.length <= 1) return {};
          
          const headers = Array.from(filteredRows[0].cells)
            .slice(1)
            .map(cell => this.getFirstElementText(cell));
          
          const result = {};
          for (let i = 1; i < filteredRows.length; i++) {
            const row = filteredRows[i];
            const rowHeader = this.getFirstElementText(row.cells[0]);
            
            headers.forEach((header, colIndex) => {
              const value = row.cells[colIndex + 1] ? 
                this.getFirstElementText(row.cells[colIndex + 1]) : 
                "N/A";
              result[`${rowHeader}_${header}`] = value;
            });
          }
          console.log('Matrix parse result:', result);
          return result;
        }

        default:
          throw new Error(`Invalid table type: ${this.type}`);
      }
    } catch (error) {
      console.error('Error in getAllData:', error);
      return null;
    }
  }
  

  // Helper method to get first element's text content from a cell
  getFirstElementText(cell) {
    if (!cell) return "";
    // Normalize whitespace and trim
    return (cell.textContent || "").replace(/\s+/g, ' ').trim();
  }
  
  /**
   * Find index by text content
   */
  findIndexByText(searchText, isRow = true) {
    searchText = searchText.toString().toLowerCase();

    if (isRow) {
      return Array.from(this.table.rows).findIndex(
        (row) => row.cells[0].textContent.trim().toLowerCase() === searchText
      );
    } else {
      const headerRow = this.table.rows[0];
      return Array.from(headerRow.cells).findIndex(
        (cell) => cell.textContent.trim().toLowerCase() === searchText
      );
    }
  }


  getFormData() {
    try {
      if (!this.config.formdata) {
        return null;
      }

      console.log('Getting form data with selectors:', this.config.formdata);
      
      const result = {};
      
      for (const [key, selector] of Object.entries(this.config.formdata)) {
        try {
          const element = this.document.querySelector(selector);
          if (element) {
            // Handle different input types
            if (element.tagName === 'SELECT') {
              result[key] = element.value;
            } else if (element.tagName === 'INPUT') {
              switch (element.type.toLowerCase()) {
                case 'checkbox':
                  result[key] = element.checked;
                  break;
                case 'radio':
                  const radioGroup = this.document.querySelector(`input[name="${element.name}"]:checked`);
                  result[key] = radioGroup ? radioGroup.value : null;
                  break;
                default:
                  result[key] = element.value;
              }
            } else {
              // For other elements, get text content
              result[key] = element.textContent.trim();
            }
          } else {
            console.warn(`Element not found for selector: ${selector}`);
            result[key] = null;
          }
        } catch (error) {
          console.error(`Error getting form data for ${key}:`, error);
          result[key] = null;
        }
      }

      console.log('Form data results:', result);
      return result;
    } catch (error) {
      console.error('Error in getFormData:', error);
      return null;
    }
  }

   miamidadeexceptions() {
    try {

        let doc = document
        let data = {
          propertyInfo: {},
          taxMatrix: {}
      };
        // Extract property information if present
        const propertySection = doc.querySelector('pa-propertyinformation');
        if (propertySection) {
            const rows = propertySection.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.trim();
                
                if (text.includes('Folio:')) {
                    data.propertyInfo.folio = text.split('Folio:')[1].trim();
                }
                if (text.includes('Property Address')) {
                    const addressDiv = row.querySelector('.property-add');
                    data.propertyInfo.propertyAddress = addressDiv ? addressDiv.textContent.trim() : '';
                }
                if (text.includes('Owner')) {
                    const ownerDiv = row.querySelector('.pa-font-size-11');
                    data.propertyInfo.owner = ownerDiv ? ownerDiv.textContent.trim() : '';
                }
                if (text.includes('Primary Land Use')) {
                    const useDiv = row.querySelector('.pt-0.pb-0');
                    data.propertyInfo.primaryLandUse = useDiv ? useDiv.textContent.trim() : '';
                }
            });
        }

        // Extract taxable value information in matrix format
        const taxSection = doc.querySelector('pa-taxablevalueinformation');
        if (taxSection) {
            // Get years from header
            const years = Array.from(taxSection.querySelectorAll('.header-row td span'))
                .map(span => span.textContent.trim())
                .filter(year => !isNaN(year));

            const authorities = ['COUNTY', 'SCHOOL BOARD', 'CITY', 'REGIONAL'];
            let currentAuthority = null;

            const rows = taxSection.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.trim();
                
                // Check if this is an authority header row
                authorities.forEach(authority => {
                    if (text === authority) {
                        currentAuthority = authority.toLowerCase().replace(' ', '_');
                    }
                });

                // Extract values if we have a current authority
                if (currentAuthority) {
                    if (text.includes('Exemption Value')) {
                        const values = Array.from(row.querySelectorAll('.text-end-mine span'))
                            .map(span => span.textContent.trim());
                        years.forEach((year, index) => {
                            data.taxMatrix[`${currentAuthority}_exemptionvalue_${year}`] = values[index];
                        });
                    }
                    if (text.includes('Taxable Value')) {
                        const values = Array.from(row.querySelectorAll('.text-end-mine span'))
                            .map(span => span.textContent.trim());
                        years.forEach((year, index) => {
                            data.taxMatrix[`${currentAuthority}_taxablevalue_${year}`] = values[index];
                        });
                    }
                }
            });
        }

        console.log('Extracted Data:', data);
        return {...data.propertyInfo,...data.taxMatrix} ;

    } catch (error) {
        console.error('Error extracting data:', error);
        return null;
    }
}
}

class SchemaTableProcessor {
  constructor(document) {
    this.document = document;
    this.parsers = new Map(); // Store parser instances for each schema key
  }

  /**
   * Process schema and scrape data according to configuration
   * @param {Object} schema - Schema configuration object
   * @returns {Object} - Scraped data organized by schema keys
   */
  async processSchema(schema) {
    let result = {}; // Changed to non-const since we'll be merging objects

    for (const [key, config] of Object.entries(schema)) {
      try {
        // Create parser instance for this table
        const parser = new TableParser(this.document, {
          tableData: config.tableData,
          tableSelector: config.tableSelector,
          type: this._convertTableType(config.tableType),
          tableSelectors:config.tableSelectors,
          constants: config.constants,
          ignoreRows:config.ignoreRows,
          formdata:config.formdata
         
        });
        if (config.constants) {
        result = {...config.constants ,...result }; // Spread operator to merge objects
        }
        // Store parser for potential reuse
        this.parsers.set(key, parser);

        // Get data based on specified function and merge into result
        const tableData = await this._executeScrapingFunction(parser, config);
        result = { ...result, ...tableData }; // Spread operator to merge objects
      } catch (error) {
        console.error(`Error processing ${key}:`, error);
      }
    }

    return result;
  }

  /**
   * Convert schema table type to TableParser type
   */
  _convertTableType(schemaType) {
    const typeMap = {
      horizontal: TableParser.TableTypes.HORIZONTAL,
      vertical: TableParser.TableTypes.VERTICAL,
      matrix: TableParser.TableTypes.MATRIX,
    };
    return typeMap[schemaType] || TableParser.TableTypes.VERTICAL;
  }

  /**
   * Execute specific scraping function based on schema configuration
   */
  _executeScrapingFunction(parser, config) {
    const {
      function: funcType = "getalldata",
      rowIdentifier,
      columnIdentifier,
      cellSelector,
    } = config;

    switch (funcType.toLowerCase()) {
      case "getalldata":
        return parser.getAllData();
      case "getbyselectors":
        return parser.getBySelectors();
      case "getrow":
        if (!rowIdentifier) {
          throw new Error("Row identifier required for getRow function");
        }
        return {
          rowData: parser.getRowData(rowIdentifier),
        };

      case "getcolumn":
        if (!columnIdentifier) {
          throw new Error("Column identifier required for getColumn function");
        }
        return {
          columnData: parser.getColumnData(columnIdentifier),
        };

      case "getcell":
        if (!rowIdentifier || !columnIdentifier) {
          throw new Error(
            "Row and column identifiers required for getCell function"
          );
        }
        return {
          cellValue: parser.getByCellHeader(rowIdentifier, columnIdentifier),
        };

      case "getcellSelector":
        if (!cellSelector) {
          throw new Error(
            "cell selector identifier required for getCell function"
          );
        }
        return {
          cellValue: parser.getbyCellSelector(cellSelector),
        };
      case "getformdata":
          if(!config.formdata){
            throw new Error(
              "cell selector identifier required for getCell function"
            )

           
            
          }
          return parser.getFormData()
      case "runmiamiexceptions":
        return parser.miamidadeexceptions()

      default:
        return parser.getAllData();
    }
  }

  /**
   * Validate schema configuration
   */
  validateSchema(schema) {
    const validTableTypes = ["horizontal", "vertical", "matrix"];
    const validFunctions = ["getalldata", "getrow", "getcolumn", "getcell"];

    for (const [key, config] of Object.entries(schema)) {
      // Check if we have either tableData or selector
      if (!config.tableData && !config.selector) {
        throw new Error(
          `Either tableData or selector must be provided for '${key}'`
        );
      }

      // Validate table type
      if (!validTableTypes.includes(config.tableType)) {
        throw new Error(
          `Invalid table type '${config.tableType}' in schema for '${key}'`
        );
      }

      // Validate function if provided
      if (
        config.function &&
        !validFunctions.includes(config.function.toLowerCase())
      ) {
        throw new Error(
          `Invalid function '${config.function}' in schema for '${key}'`
        );
      }

      // Validate required identifiers based on function
      if (config.function === "getrow" && !config.rowIdentifier) {
        throw new Error(
          `Row identifier required for getRow function in '${key}'`
        );
      }
      if (config.function === "getcolumn" && !config.columnIdentifier) {
        throw new Error(
          `Column identifier required for getColumn function in '${key}'`
        );
      }
      if (
        config.function === "getcell" &&
        (!config.rowIdentifier || !config.columnIdentifier)
      ) {
        throw new Error(
          `Row and column identifiers required for getCell function in '${key}'`
        );
      }
    }

    return true;
  }
}

function createFloatingButtons(schema) {
  const targetDocument = findMainContentFrameset();

  const host = targetDocument.createElement("div");
  host.id = "floating-buttons-host";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .button-container {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
      background: #ffffff7a;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .header-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid #eee;
      margin-bottom: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #333;
    }

    .header-toggle input[type="checkbox"] {
      cursor: pointer;
    }

    .header-toggle label {
      cursor: pointer;
      user-select: none;
    }

    button {
      padding: 12px;
      border-radius: 8px;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: transform 0.2s, background-color 0.2s;
    }

    button:hover {
      transform: scale(1.05);
    }

    .copy-button {
      background: #007bff;
    }

    .export-button {
      background: #007bff;
    }

    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 10000;
    }
  `;
  shadow.appendChild(style);

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "button-container";

  // Create header toggle
  const headerToggle = document.createElement("div");
  headerToggle.className = "header-toggle";
  
  const toggleCheckbox = document.createElement("input");
  toggleCheckbox.type = "checkbox";
  toggleCheckbox.id = "includeHeaders";
  toggleCheckbox.checked = true;

  const toggleLabel = document.createElement("label");
  toggleLabel.htmlFor = "includeHeaders";
  toggleLabel.textContent = "Include Headers";

  headerToggle.appendChild(toggleCheckbox);
  headerToggle.appendChild(toggleLabel);

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>Copy</span>
  `;

  const exportButton = document.createElement("button");
  exportButton.className = "export-button";
  exportButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v8"></path>
      <path d="m16 6-4 4-4-4"></path>
      <rect x="2" y="14" width="20" height="8" rx="2"></rect>
    </svg>
    <span>Export</span>
  `;

  const notification = document.createElement("div");
  notification.className = "notification";

  function showNotification(message, type) {
    const colors = {
      success: "#28a745",
      error: "#dc3545",
      info: "#007bff",
    };
    notification.style.backgroundColor = colors[type];
    notification.textContent = message;
    notification.style.opacity = "1";
    setTimeout(() => {
      notification.style.opacity = "0";
    }, 3000);
  }

  copyButton.addEventListener("click", async () => {
    const targetDoc = findMainContentFrame();
    const processor = new SchemaTableProcessor(targetDoc);

    try {
      const scrapedData = await processor.processSchema(schema);
      const flattenedData = flattenSchemaData(scrapedData);
      
      // Use header toggle to determine output format
      let tableText;
      if (toggleCheckbox.checked) {
        tableText = [
          Object.keys(flattenedData).join("\t"),
          Object.values(flattenedData).join("\t"),
        ].join("\n");
      } else {
        tableText = Object.values(flattenedData).join("\t");
      }

      await navigator.clipboard.writeText(tableText);
      showNotification("Copied to clipboard!", "success");
    } catch (err) {
      showNotification("Failed to copy!", "error");
      console.error(err);
    }
  });

  exportButton.addEventListener("click", async () => {
    showNotification("Exporting to Google Sheets...", "info");
    chrome.runtime.sendMessage(
      { type: "EXPORT_SHEETS_DOM", url: window.location.href },
      (response) => {
        if (response && response.success) {
          showNotification(response.message, "success");
        } else {
          showNotification(response.message || "Export failed!", "error");
        }
      }
    );
  });

  buttonContainer.appendChild(headerToggle);
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(exportButton);
  shadow.appendChild(buttonContainer);
  shadow.appendChild(notification);

  targetDocument.documentElement.appendChild(host);
}

//Send request for scraping data

chrome.runtime.sendMessage({ type: "SCRAPE_DATA" }, (response) => {});

// Modified message listener to handle schema-based scraping
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "SCRAPE_PAGE") {
    const schema = request.schema; // Now expecting schema instead of selectors
    const url = window.location.href;

    // Handle both framed and non-framed sites
    const targetDoc = findMainContentFrame();

    // Create processor instance and scrape data
    const processor = new SchemaTableProcessor(targetDoc);

    // Process schema and get results
    processor
      .processSchema(schema)
      .then((scrapedData) => {
        console.log("Scraped Data:", scrapedData);

        // Send data back to background script
        chrome.runtime.sendMessage({ type: "SCRAPED_DATA", data: scrapedData });
        sendResponse({ data: scrapedData });
      })
      .catch((error) => {
        console.error("Scraping error:", error);
        sendResponse({ error: error.message });
      });

    return true; // Required for async response
  }
});

function flattenSchemaData(data, prefix = "") {
  let flattened = {};

  for (const [key, value] of Object.entries(data)) {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flattened, flattenSchemaData(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

// Modified button injection message handler
chrome.runtime.sendMessage({ type: "INJECT_BUTTONS" }, (response) => {
  if (response.allowed === true) {
    const targetDoc = findMainContentFrameset();
    const existingHost = targetDoc.getElementById("floating-buttons-host");
    if (existingHost) {
      existingHost.remove();
    }
    createFloatingButtons(response.schema); // Now expecting schema instead of selectors
  }
});

// Helper function to find the main content frame
function findMainContentFrame() {
  const frames = Array.from(document.getElementsByTagName("frame"));
  const rbottomFrame = frames.find((frame) => frame.id === "rbottom");

  if (rbottomFrame) {
    return rbottomFrame.contentDocument || rbottomFrame.contentWindow.document;
  }

  return document;
}
function findMainContentFrameset() {
  const frames = Array.from(document.getElementsByTagName("frame"));
  const rbottomFrame = frames.find((frame) => frame.id === "masterFrameset");

  if (rbottomFrame) {
    return rbottomFrame.contentDocument || rbottomFrame.contentWindow.document;
  }
  return document;
}

//handle nested scraping

function handleNestedSelectors(doc, selectorObj, parentKey = "") {
  const scrapedData = {};

  Object.entries(selectorObj).forEach(([key, value]) => {
    const fullKey = parentKey ? `${parentKey}_${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recursively handle nested objects and merge the results into scrapedData
      Object.assign(scrapedData, handleNestedSelectors(doc, value, fullKey));
    } else {
      // For non-object selectors, directly scrape the data
      scrapedData[fullKey] = scrapeElement(doc, value, fullKey);
    }
  });

  return scrapedData;
}
