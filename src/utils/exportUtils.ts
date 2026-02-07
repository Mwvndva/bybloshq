import { Order } from '@/types/order';
import { format } from 'date-fns';

interface WithdrawalRequest {
    id: string;
    amount: number;
    mpesaNumber: string;
    mpesaName: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
    createdAt: string;
    processedAt?: string;
    updatedAt?: string;
    processedBy?: string;
    failureReason?: string;
}

/**
 * Convert array of objects to CSV string
 */
const convertToCSV = (data: any[], headers: string[]): string => {
    if (data.length === 0) return '';

    const csvRows = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            const escaped = ('' + value).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
};

/**
 * Trigger browser download of CSV file
 */
const downloadCSV = (csvContent: string, filename: string): void => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

/**
 * Format orders data for CSV export
 */
export const formatOrdersForExport = (orders: Order[]) => {
    return orders.map(order => ({
        'Order ID': order.id,
        'Date': format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        'Buyer Name': order.buyerName || 'N/A',
        'Product': order.productName || 'N/A',
        'Quantity': order.quantity,
        'Price': `KSh ${order.price}`,
        'Total': `KSh ${order.totalAmount}`,
        'Status': order.status,
        'Payment Status': order.paymentStatus || 'N/A',
        'Delivery Method': order.deliveryMethod || 'N/A',
    }));
};

/**
 * Format withdrawals data for CSV export
 */
export const formatWithdrawalsForExport = (withdrawals: WithdrawalRequest[]) => {
    return withdrawals.map(withdrawal => ({
        'Request ID': withdrawal.id,
        'Date': format(new Date(withdrawal.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        'Amount': `KSh ${withdrawal.amount}`,
        'M-Pesa Number': withdrawal.mpesaNumber,
        'M-Pesa Name': withdrawal.mpesaName || 'N/A',
        'Status': withdrawal.status,
        'Processed Date': withdrawal.updatedAt
            ? format(new Date(withdrawal.updatedAt), 'yyyy-MM-dd HH:mm:ss')
            : 'Pending',
    }));
};

/**
 * Export orders to CSV file
 */
export const exportOrdersToCSV = (orders: Order[], filename?: string): void => {
    const formattedData = formatOrdersForExport(orders);
    const headers = Object.keys(formattedData[0] || {});
    const csvContent = convertToCSV(formattedData, headers);
    const defaultFilename = `orders_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
    downloadCSV(csvContent, filename || defaultFilename);
};

/**
 * Export withdrawals to CSV file
 */
export const exportWithdrawalsToCSV = (
    withdrawals: WithdrawalRequest[],
    filename?: string
): void => {
    const formattedData = formatWithdrawalsForExport(withdrawals);
    const headers = Object.keys(formattedData[0] || {});
    const csvContent = convertToCSV(formattedData, headers);
    const defaultFilename = `withdrawals_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
    downloadCSV(csvContent, filename || defaultFilename);
};
