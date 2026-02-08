import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import os from 'os';

/**
 * Enhanced Health Check Service (P1-006)
 * 
 * Provides comprehensive health monitoring for the application
 * including database connectivity, memory usage, and service status.
 */

class HealthCheckService {
    constructor() {
        this.startTime = Date.now();
        this.checks = {
            database: this.checkDatabase.bind(this),
            memory: this.checkMemory.bind(this),
            disk: this.checkDisk.bind(this),
            services: this.checkServices.bind(this)
        };
    }

    /**
     * Check database connectivity and performance
     */
    async checkDatabase() {
        try {
            const start = Date.now();
            const result = await pool.query('SELECT NOW() as current_time, version() as version');
            const responseTime = Date.now() - start;

            // Get connection pool stats
            const poolStats = {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            };

            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                currentTime: result.rows[0].current_time,
                version: result.rows[0].version.split(' ')[0], // Just PostgreSQL version number
                pool: poolStats
            };
        } catch (error) {
            logger.error('[HEALTH-CHECK] Database check failed:', error);
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Check memory usage
     */
    async checkMemory() {
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const rssMB = Math.round(memUsage.rss / 1024 / 1024);
        const systemUsedGB = Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10;
        const systemTotalGB = Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10;

        const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
        const systemUsagePercent = Math.round((usedMem / totalMem) * 100);

        // Consider unhealthy if heap usage > 90% or system memory > 95%
        const status = (heapUsagePercent > 90 || systemUsagePercent > 95) ? 'warning' : 'healthy';

        return {
            status,
            process: {
                heapUsed: `${heapUsedMB}MB`,
                heapTotal: `${heapTotalMB}MB`,
                heapUsage: `${heapUsagePercent}%`,
                rss: `${rssMB}MB`
            },
            system: {
                used: `${systemUsedGB}GB`,
                total: `${systemTotalGB}GB`,
                usage: `${systemUsagePercent}%`
            }
        };
    }

    /**
     * Check disk space (if available)
     */
    async checkDisk() {
        try {
            // Note: This is a simplified check
            // For production, consider using a library like 'check-disk-space'
            return {
                status: 'healthy',
                note: 'Disk monitoring not implemented (requires additional dependencies)'
            };
        } catch (error) {
            return {
                status: 'unknown',
                error: error.message
            };
        }
    }

    /**
     * Check critical services status
     */
    async checkServices() {
        const services = {};

        // Check if WhatsApp service is available
        try {
            const whatsappService = await import('./whatsapp.service.js');
            services.whatsapp = {
                status: whatsappService.default.isClientReady() ? 'connected' : 'disconnected',
                available: true
            };
        } catch (error) {
            services.whatsapp = {
                status: 'unavailable',
                available: false
            };
        }

        // Check token blacklist service
        try {
            const tokenBlacklist = await import('./tokenBlacklist.service.js');
            const stats = tokenBlacklist.default.getStats();
            services.tokenBlacklist = {
                status: 'healthy',
                stats
            };
        } catch (error) {
            services.tokenBlacklist = {
                status: 'unavailable'
            };
        }

        return {
            status: 'healthy',
            services
        };
    }

    /**
     * Get system uptime
     */
    getUptime() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        return {
            seconds: uptimeSeconds,
            formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`
        };
    }

    /**
     * Run all health checks
     * @param {boolean} detailed - Include detailed checks (slower)
     */
    async runHealthChecks(detailed = false) {
        const results = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: this.getUptime(),
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            checks: {}
        };

        // Always run database check
        results.checks.database = await this.checkDatabase();

        if (detailed) {
            // Run all checks for detailed health report
            results.checks.memory = await this.checkMemory();
            results.checks.disk = await this.checkDisk();
            results.checks.services = await this.checkServices();

            // Determine overall status
            const statuses = Object.values(results.checks).map(check => check.status);
            if (statuses.includes('unhealthy')) {
                results.status = 'unhealthy';
            } else if (statuses.includes('warning')) {
                results.status = 'warning';
            }
        } else {
            // Quick check - just database
            results.status = results.checks.database.status;
        }

        return results;
    }

    /**
     * Get liveness probe (simple check that server is running)
     */
    async getLiveness() {
        return {
            status: 'alive',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get readiness probe (check if server is ready to accept traffic)
     */
    async getReadiness() {
        const dbCheck = await this.checkDatabase();

        return {
            status: dbCheck.status === 'healthy' ? 'ready' : 'not_ready',
            timestamp: new Date().toISOString(),
            database: dbCheck.status
        };
    }
}

// Export singleton instance
export default new HealthCheckService();
