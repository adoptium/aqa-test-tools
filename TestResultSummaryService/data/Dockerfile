FROM mongo:6.0.1

COPY sampleData.gz /sampleData.gz
CMD mongorestore --host=mongo --archive=/sampleData.gz --db exampleDb --gzip  --stopOnError