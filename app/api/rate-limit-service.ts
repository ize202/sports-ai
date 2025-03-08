const DAILY_QUERY_LIMIT = 5;
const STORAGE_KEY = 'slipshark_query_data';

interface QueryData {
  queryCount: number;
  lastReset: string;
}

export class RateLimitService {
  private static getStoredData(): QueryData {
    const defaultData: QueryData = {
      queryCount: 0,
      lastReset: new Date().toISOString(),
    };

    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (!storedData) {
        return defaultData;
      }

      const data = JSON.parse(storedData) as QueryData;
      
      // Check if we need to reset the daily count
      const lastReset = new Date(data.lastReset);
      const now = new Date();
      if (lastReset.getDate() !== now.getDate() || 
          lastReset.getMonth() !== now.getMonth() || 
          lastReset.getFullYear() !== now.getFullYear()) {
        return defaultData;
      }

      return data;
    } catch {
      return defaultData;
    }
  }

  private static updateStoredData(data: QueryData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  public static getRemainingQueries(): number {
    const data = this.getStoredData();
    return Math.max(0, DAILY_QUERY_LIMIT - data.queryCount);
  }

  public static async incrementQueryCount(): Promise<boolean> {
    const data = this.getStoredData();
    
    if (data.queryCount >= DAILY_QUERY_LIMIT) {
      return false;
    }

    data.queryCount += 1;
    this.updateStoredData(data);
    return true;
  }

  public static getQueryCount(): number {
    return this.getStoredData().queryCount;
  }
} 