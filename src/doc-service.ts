// Global fetch is available in Node.js 18+

export class DocService {
  private indexUrl = "https://docs.monei.com/llms.txt";
  private keyToUrlMap: Map<string, string> = new Map();
  private urlToKeyMap: Map<string, string> = new Map();
  private pageCache: Map<string, string> = new Map();
  private nextId = 1;
  private rawIndex: string = "";

  private ALLOWED_DOMAINS = [
    "docs.monei.com",
    "api.monei.com",
    "js.monei.com",
    "graphql.monei.com",
    "monei.com"
  ];

  /**
   * Validates if a URL's domain is in the whitelist.
   */
  private isDomainAllowed(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return this.ALLOWED_DOMAINS.some(domain => 
        parsedUrl.hostname === domain || parsedUrl.hostname.endsWith("." + domain)
      );
    } catch {
      return false;
    }
  }

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
    // Regex to find all [Title](URL) patterns.
    // Changed to support all https? links, including subdomains or external docs (like Spreedly/Channex),
    // and to safely ignore optional markdown titles (e.g., "Title") inside the parenthesis.
    return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"]+)(?:[\s"][^)]*)?\)/g, (match, title, url) => {
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
    if (this.pageCache.has(url)) {
      return this.pageCache.get(url)!;
    }

    if (!this.isDomainAllowed(url)) {
      return `Error: Security Block. The domain of the requested URL (${url}) is not in the allowed list for the MONEI Doc-Bot. To maintain security and focus, I can only fetch documentation from verified MONEI domains and partners.`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      return `Error: Failed to fetch page at ${url}: ${response.statusText}`;
    }

    const content = await response.text();
    const cleanContent = this.processText(content);
    this.pageCache.set(url, cleanContent);
    return cleanContent;
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
   * Returns the original URL for a given key. Useful for logging/observability.
   */
  getUrlByKey(key: string): string | undefined {
    return this.keyToUrlMap.get(key);
  }

  /**
   * Lists all currently registered document keys.
   */
  getAvailableKeys(): string[] {
    return Array.from(this.keyToUrlMap.keys());
  }

  /**
   * Replaces symbolic references (#ref123) with their original URLs in the provided text.
   */
  resolveReferences(text: string): string {
    // Regex to find #ref and following digits
    return text.replace(/#ref\d+/g, (key) => {
      return this.keyToUrlMap.get(key) || key;
    });
  }
}

