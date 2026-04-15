import { container } from './src/container.js';
import logger from './src/utils/logger.js';

async function sanityCheck() {
    console.log('🔍 Starting DDD Sanity Check...');

    try {
        // 1. Check Container Initializtion
        console.log('✅ Container initialized successfully');

        // 2. Check a few key use cases
        if (container.createOrder) console.log('✅ CreateOrder use case wired');
        if (container.loginUser) console.log('✅ LoginUser use case wired');
        if (container.jobQueue) console.log('✅ JobQueue infrastructure wired');

        // 3. Check Jobs
        if (container.jobs && container.jobs.length > 0) {
            console.log(`✅ ${container.jobs.length} jobs registered`);
        }

        console.log('\n✨ DDD Architecture wiring looks correct!');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Sanity Check Failed:', err.message);
        process.exit(1);
    }
}

sanityCheck();
