import { PaymentCompletionJob } from './PaymentCompletionJob.js';
import { ProcessPendingPaymentsJob } from './ProcessPendingPaymentsJob.js';
import { OrderDeadlineJob } from './OrderDeadlineJob.js';
import { PayoutCleanupJob } from './PayoutCleanupJob.js';
import { ReferralJob } from './ReferralJob.js';

export const registerJobs = (container, queue) => {
    const jobs = [
        new PaymentCompletionJob(queue),
        new ProcessPendingPaymentsJob(queue),
        new OrderDeadlineJob(queue),
        new PayoutCleanupJob(queue),
        new ReferralJob(queue)
    ];

    jobs.forEach(job => job.register());
    return jobs;
};
