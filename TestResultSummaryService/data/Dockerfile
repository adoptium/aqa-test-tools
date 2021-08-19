FROM mongo:4.0.9

COPY sampleData.gz /sampleData.gz
CMD mongorestore --host=mongo --archive=/sampleData.gz --db exampleDb --gzip  --stopOnError