// 多因子指纹识别 的算法识别ClientId
import express from 'express';
import crypto from 'crypto';
import logger from '#logger';


class ClientFinger {
    generate(req: express.Request): string {
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
        const text = crypto.createHash('sha256')
            .update(fingerprintString)
            .digest('hex');
        // logger.info(`text: ${text}, size: ${text.length}`);
        return text.substring(0, 32); // 取前32位
    }
    
    getClientIP(req: express.Request): string {
        // 考虑代理链的情况
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (typeof xForwardedFor === 'string') {
            return xForwardedFor.split(',')[0]?.trim() || '0.0.0.0';
        }
        
        const xRealIP = req.headers['x-real-ip'];
        // logger.info(`xRealIP: ${xRealIP}`);
        if (typeof xRealIP === 'string') {
            return xRealIP;
        }
        
        // logger.info(`ip: ${req.ip}, remoteAddress1: ${req.connection.remoteAddress} remoteAddress2: ${req.socket.remoteAddress}`);
        return req.ip || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               '0.0.0.0';
    }
}

export default new ClientFinger();
// export default ClientFingerprint;