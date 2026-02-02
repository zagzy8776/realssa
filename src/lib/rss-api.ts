// Simple RSS fetcher that works in the browser
export const fetchRSSFeed = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    return text;
  } catch (error) {
    console.error(`Failed to fetch RSS feed ${url}:`, error);
    return null;
  }
};

// Parse RSS XML manually (simplified version for browser compatibility)
export const parseRSSXML = (xmlString: string) => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    const items = [];
    const itemNodes = xmlDoc.querySelectorAll("item, entry");
    
    itemNodes.forEach(node => {
      const title = node.querySelector("title")?.textContent || "";
      const link = node.querySelector("link")?.textContent || 
                   node.querySelector("link")?.getAttribute("href") || "";
      const description = node.querySelector("description")?.textContent || 
                         node.querySelector("summary")?.textContent || "";
      const pubDate = node.querySelector("pubDate")?.textContent || 
                     node.querySelector("published")?.textContent || "";
      const guid = node.querySelector("guid")?.textContent || link;
      const author = node.querySelector("author")?.textContent || 
                    node.querySelector("creator")?.textContent || "";
      const content = node.querySelector("content")?.textContent || description;
      
      if (title && link) {
        items.push({
          title,
          link,
          description,
          pubDate,
          guid,
          author,
          content
        });
      }
    });
    
    return {
      items,
      title: xmlDoc.querySelector("title")?.textContent || "RSS Feed"
    };
  } catch (error) {
    console.error("Failed to parse RSS XML:", error);
    return { items: [], title: "RSS Feed" };
  }
};

// Fetch multiple RSS feeds in parallel
export const fetchMultipleRSSFeeds = async (urls: string[]) => {
  const results = await Promise.allSettled(
    urls.map(url => fetchRSSFeed(url))
  );
  
  return results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => parseRSSXML((result as PromiseFulfilledResult<string>).value!));
};
