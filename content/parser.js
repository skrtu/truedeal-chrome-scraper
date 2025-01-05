window.tableParser = (function(){
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
  
      if (config.tableSelector) {
        this.table = this.document.querySelector(config.tableSelector);
      } else if (config.tableData) {
        this.table = this.findTableByData(config.tableData);
      }
  
      if (!this.table) {
        throw new Error("Table not found");
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
      const tables = Array.from(this.document.getElementsByTagName("table"));
      return tables.find((table) => {
        const tableText = table.textContent.toLowerCase();
        return searchData.every((item) =>
          tableText.includes(item.toString().toLowerCase())
        );
      });
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
        switch (this.type) {
          case TableParser.TableTypes.HORIZONTAL:
            // For horizontal tables, directly map keys to values
            return Array.from(this.table.rows).reduce((obj, row) => {
              const key = row.cells[0].textContent.trim();
              obj[key] = row.cells[1].textContent.trim();
              return obj;
            }, {});
    
          case TableParser.TableTypes.VERTICAL:
            // For vertical tables, create object with first row as headers
            const headers = Array.from(this.table.rows[0].cells).map(cell => 
              cell.textContent.trim()
            );
            
            // Use first column value as key, combine remaining values
            return Array.from(this.table.rows).slice(1).reduce((obj, row) => {
              const key = row.cells[0].textContent.trim();
              headers.slice(1).forEach((header, index) => {
                obj[`${key}_${header}`] = row.cells[index + 1]?.textContent.trim() || "";
              });
              return obj;
            }, {});
    
          case TableParser.TableTypes.MATRIX:
            // For matrix tables, combine row header with column header as keys
            const colHeaders = Array.from(this.table.rows[0].cells)
              .slice(1)
              .map(cell => cell.textContent.trim());
            
            return Array.from(this.table.rows).slice(1).reduce((obj, row) => {
              const rowHeader = row.cells[0].textContent.trim();
              colHeaders.forEach((header, index) => {
                obj[`${rowHeader}_${header}`] = row.cells[index + 1]?.textContent.trim() || "";
              });
              return obj;
            }, {});
    
          default:
            throw new Error("Invalid table type");
        }
      } catch (error) {
        console.error("Error getting all data:", error);
        return null;
      }
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
  }
})

  

  
  