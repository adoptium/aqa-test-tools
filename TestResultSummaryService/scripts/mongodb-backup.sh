#!/bin/bash

#############################################
# MongoDB Backup to JFrog Artifactory
# Backs up directly to mounted Artifactory
# No local storage required
#############################################

# Configuration
MOUNT_POINT="/mnt/artifactory"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="mongodb-backup-${DATE}"
RETENTION_DAYS=30

# MongoDB connection details
MONGO_HOST="localhost"
MONGO_PORT="27017"
# Uncomment if authentication is required:
# MONGO_USER="backup_user"
# MONGO_PASS="backup_password"
# MONGO_AUTH_DB="admin"

# Function to log messages (output goes to stdout, cron handles logging)
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if Artifactory is mounted
check_mount() {
    if ! mountpoint -q "$MOUNT_POINT"; then
        log_message "ERROR: Artifactory not mounted at $MOUNT_POINT"
        log_message "Attempting to mount..."
        sudo mount "$MOUNT_POINT"
        sleep 2
        if ! mountpoint -q "$MOUNT_POINT"; then
            log_message "ERROR: Failed to mount Artifactory. Exiting."
            exit 1
        fi
        log_message "Successfully mounted Artifactory"
    fi
}

# Start backup process
log_message "=========================================="
log_message "=== Starting MongoDB Backup ==="
log_message "Backup name: $BACKUP_NAME"
log_message "=========================================="

# Check mount
check_mount

# Build mongodump command
MONGODUMP_CMD="mongodump --host=$MONGO_HOST --port=$MONGO_PORT"

# Add authentication if configured
if [ ! -z "$MONGO_USER" ]; then
    MONGODUMP_CMD="$MONGODUMP_CMD --username=$MONGO_USER --password=$MONGO_PASS --authenticationDatabase=$MONGO_AUTH_DB"
fi

# Backup directly to Artifactory with compression
MONGODUMP_CMD="$MONGODUMP_CMD --archive=${MOUNT_POINT}/${BACKUP_NAME}.archive --gzip"

# Execute backup
log_message "Backing up directly to Artifactory..."
if $MONGODUMP_CMD 2>&1; then
    log_message "✓ MongoDB backup completed successfully"
    
    # Verify file exists
    if [ -f "${MOUNT_POINT}/${BACKUP_NAME}.archive" ]; then
        BACKUP_SIZE=$(du -h "${MOUNT_POINT}/${BACKUP_NAME}.archive" | cut -f1)
        log_message "✓ Backup verified: ${BACKUP_NAME}.archive ($BACKUP_SIZE)"
    else
        log_message "⚠ WARNING: Could not verify backup file"
    fi
else
    log_message "✗ ERROR: MongoDB backup failed"
    exit 1
fi

# Clean up old backups (older than RETENTION_DAYS)
log_message "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$MOUNT_POINT" -name "mongodb-backup-*.archive" -type f -mtime +$RETENTION_DAYS -delete 2>&1

log_message "=========================================="
log_message "=== Backup Process Completed Successfully ==="
log_message "=========================================="
log_message ""

exit 0
