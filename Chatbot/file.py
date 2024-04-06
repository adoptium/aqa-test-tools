from llama_index import GPTVectorStoreIndex, SimpleDirectoryReader
from llama_index import StorageContext, load_index_from_storage
import os

dataDir = 'data_2'
storageDir = "./storage"
try:
    storage_content = StorageContext.from_defaults(persist_dir=storageDir)
    print("loaded from persist data: ", storageDir)
    index = load_index_from_storage(storage_content)
except:
    documents = SimpleDirectoryReader(dataDir).load_data()
    print("loaded from data: ", dataDir)
    index = GPTVectorStoreIndex.from_documents(documents)
    index.storage_context.persist()

query_engine = index.as_query_engine()

# question = "Which companies joined Adoptium?"
question = "Please give a summary?"
# question = "Could you suggest a fix?"
# question = "What is the next step I should take to fix this defect?"
print(question)
response = query_engine.query(question)
print(response)