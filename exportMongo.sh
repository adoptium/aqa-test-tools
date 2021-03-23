#!/bin/sh

# find dump gzip that are older than 90 days and delete
find /home/mongoBackup -mtime 90 -type f -name "dump*" -delete

# export the whole db to gzip
mongodump --gzip --archive=/home/mongoBackup/dump_`date "+%Y-%m-%d-%T"`.gz --db=exampleDb

#restore using command   mongorestore --archive=<path to gzip> --db exampleDb --gzip