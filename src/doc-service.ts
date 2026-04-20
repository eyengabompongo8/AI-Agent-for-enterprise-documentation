// Global fetch is available in Node.js 18+

export class DocService {
  private indexUrl = "https://docs.monei.com/llms.txt";
  private keyToUrlMap: Map<string, string> = new Map();
  private urlToKeyMap: Map<string, string> = new Map();
  private nextId = 1;
  private rawIndex: string = "";

  /**
   * Initializes the service by fetching the index.
   */
  async initialize() {
    const response = await fetch(this.indexUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch index: ${response.statusText}`);
    }
    this.rawIndex = await response.text();
  }

  /**
   * Processes text by replacing markdown links with "Title [Key]" and registering the mapping.
   */
  private processText(text: string): string {
    // Regex to find all [Title](URL) patterns
    // Specifically target docs.monei.com links
    return text.replace(/\[([^\]]+)\]\((https:\/\/docs\.monei\.com\/[^)]+)\)/g, (match, title, url) => {
      let key = this.urlToKeyMap.get(url);
      if (!key) {
        key = `#ref${this.nextId++}`;
        this.urlToKeyMap.set(url, key);
        this.keyToUrlMap.set(key, url);
      }
      return `${title} [${key}]`;
    });
  }

  /**
   * Returns the index with all markdown links replaced by "Title [Key]".
   */
  getCleanIndex(): string {
    return this.processText(this.rawIndex);
  }

  async _getCleanPage(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      return `Error: Failed to fetch page at ${url}: ${response.statusText}`;
    }

    const content = await response.text();
    return this.processText(content);
  }

  /**
   * Fetches a specific page by its key, processes it, and returns the content.
   */
  async getCleanPage(key: string): Promise<string> {
    const url = this.keyToUrlMap.get(key);
    if (!url) {
      return `Error: Documentation page for key "${key}" not found. Please refer to the index for available keys.`;
    }

    return this._getCleanPage(url);
  }

  /**
   * Lists all currently registered document keys.
   */
  getAvailableKeys(): string[] {
    return Array.from(this.keyToUrlMap.keys());
  }
}

