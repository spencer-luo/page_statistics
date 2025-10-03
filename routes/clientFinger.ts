// utils/clientFingerprint.ts
import express from 'express';
import crypto from 'crypto';

// interface Request {
//     get(header: string): string | undefined;
//     headers: {
//         [key: string]: string | string[] | undefined;
//     };
//     connection?: {
//         remoteAddress?: string;
//         socket?: {
//             remoteAddress?: string;
//         };
//     };
//     socket?: {
//         remoteAddress?: string;
//     };
// }

class ClientFinger {
    static generate(req: express.Request): string {
        const components: string[] = [];
        
        // 1. IP 地址（考虑代理）
        const ip = this.getClientIP(req);
        components.push(ip);
        
        // 2. User-Agent
        const ua = req.get('User-Agent') || '';
        components.push(ua);
        
        // 3. Accept Headers
        const accept = req.get('Accept') || '';
        components.push(accept);
        
        // 4. Accept-Language
        const language = req.get('Accept-Language') || '';
        components.push(language);
        
        // 5. Accept-Encoding
        const encoding = req.get('Accept-Encoding') || '';
        components.push(encoding);
        
        // 6. 连接特征
        const connection = req.get('Connection') || '';
        components.push(connection);
        
        // 生成指纹
        const fingerprintString = components.join('|');
        return crypto
            .createHash('sha256')
            .update(fingerprintString)
            .digest('hex')
            .substring(0, 16); // 取前16位
    }
    
    private static getClientIP(req: express.Request): string {
        // 考虑代理链的情况
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (typeof xForwardedFor === 'string') {
            return xForwardedFor.split(',')[0]?.trim() || '0.0.0.0';
        }
        
        const xRealIP = req.headers['x-real-ip'];
        if (typeof xRealIP === 'string') {
            return xRealIP;
        }
        
        return req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.connection?.socket?.remoteAddress ||
               '0.0.0.0';
    }
}

export default new ClientFinger();
// export default ClientFingerprint;