import logger from '../utils/logger.js';
import { pool } from '../config/database.js';

/**
 * Monitoring Service for Security Alerts and Webhook Pattern Analysis
 * 
 * This service tracks suspicious activity and provides alerting capabilities
 * for the security team to respond to potential threats.
 */
class MonitoringService {
    constructor() {
        this.alertQueue = [];
        this.isProcessing = false;
    }

    /**
     * Alert security team about suspicious webhook activity
     * @param {string} alertType - Type of security alert
     * @param {object} details - Details about the security incident
     */
    async alertSecurityTeam(alertType, details) {
        logger.error(`[SECURITY-ALERT] ${alertType}`, details);

        try {
            // Store alert in database for review
            await pool.query(
                `INSERT INTO security_alerts 
                 (alert_type, details, created_at) 
                 VALUES ($1, $2, NOW())`,
                [alertType, JSON.stringify(details)]
            );

            logger.info(`[SECURITY-ALERT] Alert stored in database: ${alertType}`);

            // TODO: Integrate with notification services
            // Examples:
            // - Send email to security team
            // - Send Slack notification
            // - Trigger PagerDuty alert
            // - Send SMS for critical alerts
            // - Integrate with Sentry

            // For now, we'll just log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.error('\n🚨 SECURITY ALERT 🚨');
                console.error(`Type: ${alertType}`);
                console.error('Details:', JSON.stringify(details, null, 2));
                console.error('');
            }

        } catch (error) {
            logger.error('[SECURITY-ALERT] Failed to store security alert:', error);
            // Don't throw - we don't want to break the webhook flow
        }
    }

    /**
     * Track webhook patterns for fraud detection
     * @param {object} webhookData - The webhook payload
     * @param {string} clientIP - IP address of the webhook source
     */
    async trackWebhookPattern(webhookData, clientIP) {
        const reference = webhookData.transaction_reference ||
            webhookData.reference ||
            webhookData.transaction_id ||
            webhookData.correlator_id;

        try {
            // Count webhooks from this IP in the last hour
            const { rows } = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM webhook_logs 
                 WHERE client_ip = $1 
                 AND created_at > NOW() - INTERVAL '1 hour'`,
                [clientIP]
            );

            const hourlyCount = parseInt(rows[0]?.count || 0);

            // Alert if unusual volume detected
            if (hourlyCount > 100) {
                await this.alertSecurityTeam('High webhook volume from single IP', {
                    ip: clientIP,
                    count: hourlyCount,
                    reference,
                    threshold: 100
                });
            }

            // Log this webhook for pattern analysis
            await pool.query(
                `INSERT INTO webhook_logs 
                 (reference, client_ip, payload, created_at) 
                 VALUES ($1, $2, $3, NOW())`,
                [reference, clientIP, JSON.stringify(webhookData)]
            );

            // Check for duplicate webhooks (possible replay attack)
            const { rows: duplicates } = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM webhook_logs 
                 WHERE reference = $1 
                 AND created_at > NOW() - INTERVAL '1 hour'`,
                [reference]
            );

            const duplicateCount = parseInt(duplicates[0]?.count || 0);

            if (duplicateCount > 3) {
                await this.alertSecurityTeam('Duplicate webhook detected (possible replay attack)', {
                    reference,
                    ip: clientIP,
                    count: duplicateCount,
                    threshold: 3
                });
            }

        } catch (error) {
            logger.error('[MONITORING] Failed to track webhook pattern:', error);
            // Don't throw - we don't want to break the webhook flow
        }
    }

    /**
     * Get security alert statistics
     * @param {number} hours - Number of hours to look back
     * @returns {Promise<object>} Alert statistics
     */
    async getAlertStats(hours = 24) {
        try {
            const { rows } = await pool.query(
                `SELECT 
                    alert_type,
                    COUNT(*) as count,
                    MAX(created_at) as last_occurrence
                 FROM security_alerts 
                 WHERE created_at > NOW() - INTERVAL '${hours} hours'
                 GROUP BY alert_type
                 ORDER BY count DESC`,
                []
            );

            return {
                period: `${hours} hours`,
                alerts: rows,
                total: rows.reduce((sum, row) => sum + parseInt(row.count), 0)
            };
        } catch (error) {
            logger.error('[MONITORING] Failed to get alert stats:', error);
            return { period: `${hours} hours`, alerts: [], total: 0 };
        }
    }

    /**
     * Get webhook pattern analysis
     * @param {number} hours - Number of hours to analyze
     * @returns {Promise<object>} Pattern analysis
     */
    async getWebhookPatterns(hours = 24) {
        try {
            const { rows } = await pool.query(
                `SELECT 
                    client_ip,
                    COUNT(*) as webhook_count,
                    COUNT(DISTINCT reference) as unique_transactions,
                    MIN(created_at) as first_seen,
                    MAX(created_at) as last_seen
                 FROM webhook_logs 
                 WHERE created_at > NOW() - INTERVAL '${hours} hours'
                 GROUP BY client_ip
                 ORDER BY webhook_count DESC
                 LIMIT 20`,
                []
            );

            return {
                period: `${hours} hours`,
                patterns: rows
            };
        } catch (error) {
            logger.error('[MONITORING] Failed to get webhook patterns:', error);
            return { period: `${hours} hours`, patterns: [] };
        }
    }

    /**
     * Mark security alert as reviewed
     * @param {number} alertId - ID of the alert
     * @param {number} reviewedBy - User ID who reviewed it
     */
    async markAlertReviewed(alertId, reviewedBy) {
        try {
            await pool.query(
                `UPDATE security_alerts 
                 SET reviewed = true, 
                     reviewed_by = $1, 
                     reviewed_at = NOW() 
                 WHERE id = $2`,
                [reviewedBy, alertId]
            );

            logger.info(`[MONITORING] Alert ${alertId} marked as reviewed by user ${reviewedBy}`);
        } catch (error) {
            logger.error('[MONITORING] Failed to mark alert as reviewed:', error);
            throw error;
        }
    }

    /**
     * Clean up old webhook logs (data retention)
     * Call this periodically via cron job
     * @param {number} daysToKeep - Number of days to retain logs
     */
    async cleanupOldLogs(daysToKeep = 30) {
        try {
            const { rowCount } = await pool.query(
                `DELETE FROM webhook_logs 
                 WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
            );

            logger.info(`[MONITORING] Cleaned up ${rowCount} old webhook logs (older than ${daysToKeep} days)`);

            return { deleted: rowCount };
        } catch (error) {
            logger.error('[MONITORING] Failed to cleanup old logs:', error);
            throw error;
        }
    }
}

// Export singleton instance
export default new MonitoringService();
