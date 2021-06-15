import re
import os
from pathlib import Path
import sys
sys.path.append("../utils/")
from preprocess_data import remove_time_stamp #scriptName without .py extension
import pymongo

if os.path.isfile('./data/GitHubData/IssueContentQuote/new_file.txt') :
    open('./data/GitHubData/IssueContentQuote/new_file.txt', "w").close()  ##Have to clear the file if it already exists before using it

def store_on_files(data, file_name):
    ##Store data in file named `file_name`
    if data:
        try:
            with open(file_name, "a") as f:
                f.write(str(data))
        except:
            return

def regexify(s):
    pattern = "\`\`\`([\s\S]*?)\`\`\`"
    substring = re.findall(pattern, s)
    result=''.join(substring)
    if result:
        try:
            return remove_time_stamp(result)
        except:
            return ' '

client = pymongo.MongoClient("mongodb://localhost:27017/")

# Database Name
db = client["DeepAQAtikData"]
#
# # Collection Name
col = db["Issues"]

# Fields with values as 1 will
# only appear in the result
x = col.find({},{'_id': 0, "issue_content_path": 1})

for data in x:
   # f = open(data["issue_content_path"], "r")
   print(data["issue_content_path"])

# directory = 'C:/Codes/testdirectory' ##enter directory address
#
# for filename in os.listdir(directory):
#     f = os.path.join(directory, filename)
#     if os.path.isfile(f):
#         with open(f,'r') as file:
#             s=file.read()
#             res=regexify(s)
#             print(res)

def data_storage_func():
    dir = './data/GitHubData/IssueContent' ##enter directory address
    for filename in os.listdir(dir):
        f = os.path.join(dir, filename)
        if os.path.isfile(f):
            with open(f,'r') as file:
                s=file.read()
                res=regexify(s)
                #print(res)
                store_on_files(res, './data/GitHubData/IssueContentQuote/new_file.txt') #Enter result file and use in loop to prevent unexplained behaviour
                # store_in_db(issue_details, "Issues", db, "url")


if __name__ == '__main__':
	data_storage_func()
