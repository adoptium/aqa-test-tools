# MongoDB Backup Scripts

This directory contains scripts for backing up MongoDB to JFrog Artifactory.

## mongodb-backup.sh

Automated MongoDB backup script that backs up directly to JFrog Artifactory via WebDAV mount.

### Features

- ✅ Direct backup to Artifactory (no local storage required)
- ✅ Automatic compression with gzip
- ✅ Date-based naming: `mongodb-backup-YYYY-MM-DD_HH-MM-SS.archive`
- ✅ Automatic cleanup of backups older than 30 days
- ✅ Comprehensive logging to `/var/log/mongodb-backup.log`
- ✅ Error handling and mount verification

### Prerequisites

1. **Install required packages:**
   ```bash
   sudo apt update
   sudo apt install -y davfs2 mongodb-database-tools
   ```

2. **Configure WebDAV mount:**
   ```bash
   # Edit davfs2 secrets file
   sudo nano /etc/davfs2/secrets
   
   # Add your Artifactory credentials:
   https://yourartfactory.com/artifactory/TRSS_Backups <your-username> <your-token>
   
   # Secure the file
   sudo chmod 600 /etc/davfs2/secrets
   ```

3. **Create mount point:**
   ```bash
   sudo mkdir -p /mnt/artifactory
   ```

4. **Configure fstab for automatic mounting:**
   ```bash
   sudo nano /etc/fstab
   
   # Add this line:
 https://yourartfactory.com/artifactory/TRSS_Backups /mnt/artifactory davfs user,noauto,uid=0,gid=0 0 0
   ```

### Installation

1. **Copy the script to system location:**
   ```bash
   sudo cp mongodb-backup.sh /usr/local/bin/
   sudo chmod +x /usr/local/bin/mongodb-backup.sh
   ```

2. **Create log file:**
   ```bash
   sudo touch /var/log/mongodb-backup.log
   sudo chmod 644 /var/log/mongodb-backup.log
   ```

3. **Test the script:**
   ```bash
   # Mount Artifactory first
   sudo mount /mnt/artifactory
   
   # Run the backup script
   sudo /usr/local/bin/mongodb-backup.sh
   
   # Check the log
   tail -f /var/log/mongodb-backup.log
   ```

### Automated Backups with Cron

To schedule daily backups at 2:00 AM:

```bash
# Edit root's crontab
sudo crontab -e

# Add this line:
0 2 * * * /usr/local/bin/mongodb-backup.sh >> /var/log/mongodb-backup.log 2>&1
```

### Configuration

Edit the script to customize:

- `MOUNT_POINT`: Artifactory mount point (default: `/mnt/artifactory`)
- `RETENTION_DAYS`: How long to keep backups (default: 30 days)
- `MONGO_HOST`: MongoDB host (default: `localhost`)
- `MONGO_PORT`: MongoDB port (default: `27017`)
- MongoDB authentication (uncomment and set if needed)

### Monitoring

```bash
# View recent logs
sudo tail -50 /var/log/mongodb-backup.log

# List backups in Artifactory
ls -lh /mnt/artifactory/mongodb-backup-*.archive

# Check disk space
df -h /mnt/artifactory
```

### Restoration

To restore from a backup:

```bash
# Restore all databases
mongorestore --archive=/mnt/artifactory/mongodb-backup-2026-05-29_02-00-00.archive --gzip

# Restore specific database
mongorestore --archive=/mnt/artifactory/mongodb-backup-2026-05-29_02-00-00.archive \
  --gzip \
  --nsInclude="mydb.*"
```

### Troubleshooting

**Mount fails:**
```bash
# Check if davfs2 is installed
dpkg -l | grep davfs2

# Try manual mount
sudo mount -v /mnt/artifactory

# Check logs
sudo tail -f /var/log/syslog | grep davfs
```

**Backup fails:**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Test mongodump manually
mongodump --host=localhost --port=27017 --archive=/tmp/test.archive --gzip
```

## Support

For issues or questions, please refer to the main repository documentation or contact the infrastructure team.