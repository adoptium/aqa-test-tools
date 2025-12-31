// Accept all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ArgParser = require('./ArgParser');
ArgParser.parse();

const EventHandler = require('./EventHandler');
const { logger } = require('./Utils');

// Add global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise);
    logger.error('Reason:', reason);
    if (reason instanceof Error) {
        logger.error('Stack trace:', reason.stack);
    }
    // Log but don't exit - allow the process to continue
    // In production, you might want to exit after logging
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    logger.error('Stack trace:', error.stack);
    // For uncaught exceptions, we should exit as the process is in an unknown state
    logger.error('Exiting process due to uncaught exception');
    process.exit(1);
});

// running processBuild() and monitorBuild() in parallel
setTimeout(async () => {
    try {
        const handler = new EventHandler();
        // Handle errors for both async functions
        handler.processBuild().catch((error) => {
            logger.error('Fatal error in processBuild():', error);
            logger.error('Stack trace:', error.stack);
            // Don't exit - let it retry in the next iteration
        });
        handler.monitorBuild().catch((error) => {
            logger.error('Fatal error in monitorBuild():', error);
            logger.error('Stack trace:', error.stack);
            // Don't exit - let it retry in the next iteration
        });
    } catch (error) {
        logger.error('Fatal error starting EventHandler:', error);
        logger.error('Stack trace:', error.stack);
        process.exit(1);
    }
}, 1 * 1000);
