// 模块类型声明

// 声明项目根目录模块

declare module 'config' {
  const config: {
    port: number;
    storage: {
      directory: string;
      backupDirectory: string;
    };
    api: {
      prefix: string;
    };
    stats: {
      saveInterval: number;
      historyDays: number;
    };
    security: {
      maxTrackRequests: number;
      maxQueryRequests: number;
      maxQueryAllRequests: number;
      trustProxy: boolean;
      allowedDomains: string[];
    };
    logging: {
      saveDir: string;
      console: boolean;
      maxDays: number;
    };
  };
  export default config;
}

declare module 'logger' {
  const logger: {
    info: (message: string) => Promise<void>;
    error: (message: string) => Promise<void>;
    warn: (message: string) => Promise<void>;
  };
  export default logger;
}

declare module 'models/stats' {
  import { DomainStats } from 'models/stats';
  const stats: {
    getDomainStats: (domain: string) => DomainStats;
    saveAllData: () => Promise<void>;
  };
  export default stats;
}

declare module 'routes/api' {
  import express from 'express';
  const router: express.Router;
  export default router;
}

declare module 'routes/clientFinger' {
  // import express from 'express';
  // const router: express.Router;
  export default clientFinger;
}
