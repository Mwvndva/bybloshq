import logger from '../utils/logger.js';
import SecurityAlert from '../models/securityAlert.model.js';
import WebhookLog from '../models/webhookLog.model.js';

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
            await SecurityAlert.insert(alertType, details);

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
            throw error; // Always surface — missing security_alerts table must be caught early
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
            const hourlyCount = await WebhookLog.getIpCount(clientIP, 1);

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
            await WebhookLog.insert(reference, clientIP, webhookData);

            // Check for duplicate webhooks (possible replay attack)
            const duplicateCount = await WebhookLog.getReferenceCount(reference, 1);

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
            const alerts = await SecurityAlert.getStats(hours);

            return {
                period: `${hours} hours`,
                alerts: alerts,
                total: alerts.reduce((sum, row) => sum + Number.parseInt(row.count), 0)
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
            const patterns = await WebhookLog.getPatterns(hours);

            return {
                period: `${hours} hours`,
                patterns: patterns
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
            await SecurityAlert.markReviewed(alertId, reviewedBy);

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
            const rowCount = await WebhookLog.deleteOld(daysToKeep);

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

