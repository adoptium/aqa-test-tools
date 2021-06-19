import requests
import argparse
from datetime import datetime
from datetime import date
from math import ceil
import time
from pprint import pprint
import pymongo
import sys
sys.path.append("../utils/")
from preprocess_data import extract_quotation_content

def store_in_db(data, collection_name, db, primary_key='url'):
	"""
	Store data in db.collection_name (update if exists using primary key)
	"""
	db_col = db[collection_name]
	record_id = {primary_key: data[primary_key]}
	db_col.update_one(record_id, {"$set": data}, upsert=True)

def store_on_fs(data, file_name):
	"""
	Store data in file named `file_name`
	"""
	if data:

		with open(file_name, "w") as f:
			f.write(str(data))
		return True

def get_collection_record(query_params, field_params, collection_name, db):
	"""
	Get a record of db.collection_name specified by query_params and field_params
	"""
	db_col = db[collection_name]
	return db_col.find_one(query_params, field_params)

def store_issue_details(issue, repo, db):
	"""
	Get issue details to be stored in DB and store issue text on filesystem
	"""
	issue_number = issue['number']
	repo_name = repo.split('/')[-1]
	issue_uid = f'{repo_name}_{issue_number}.txt'
	issue_content_path = f'./data/GitHubData/IssueContent/{issue_uid}'
	# test_output_path = f'./data/GitHubData/TestOutput/{issue_uid}'
	issue_content_quotation_path = f'./data/GitHubData/IssueContentQuote/{issue_uid}'
	#Get issue details
	issue_details = dict()
	issue_details['url'] = issue['html_url']
	issue_details['repository_url'] = issue['repository_url']
	issue_details['number'] = issue_number
	issue_details['state'] = issue['state']
	issue_details['title'] = issue['title']
	issue_details['created_at'] = issue['created_at']
	issue_details['updated_at'] = issue['updated_at']
	issue_details['issue_content_path'] = issue_content_path
	# issue_details['test_output_path'] = test_output_path
	issue_details['issue_content_quotation_path'] = issue_content_quotation_path
	#Store issue content at issue_content_path
	store_on_fs(issue['body'], issue_content_path)
	store_quotation_result = store_on_fs(extract_quotation_content(issue['body']), issue_content_quotation_path)
	if store_quotation_result:
		issue_details['issue_content_quotation_path'] = issue_content_quotation_path
	#Store issue details in db.Issues Table
	store_in_db(issue_details, "Issues", db, "url")

	#To do: Add issue_details['test_output_path'] and store test_output in filesystem


def fetch_new_issues(repo, since, auth_token, db):
	"""
	Fetch all new open issues in the repo since `since`
	"""
	page_number = 1
	num_open_issues = 0

	query_url = f'https://api.github.com/repos/{repo}/issues'
	params = {'accept': 'application/vnd.github.v3+json',
			  'state': 'open',
			  'since': since,
			  'per_page': 100,
			  'page': page_number,}

	headers = None
	if auth_token:
		headers = {'Authorization': f'token {auth_token}'}

	while True:
		params['page'] = page_number
		response = requests.get(query_url, headers=headers, params=params).json()

		# Break if no new issues are found on the page
		if not response:
			break

		for r in response:
			if 'pull_request' not in r:
				store_issue_details(r, repo, db)
				num_open_issues += 1

		page_number += 1

	pprint(f'Number of new issues found: {num_open_issues}')
	return num_open_issues

def fetch_github_issues(args, db):
	"""
	Track all new open issues in the repo with the given labels
	"""
	repos = args.github_repo
	auth_token = args.github_token
	wait_time = args.github_freq * 60

	while True:
		start = time.time()

		for repo in repos:

			#Get the last updated time for the repo
			since_info = get_collection_record({'repository': repo}, None, 'LastUpdatedInfo', db)

			num_issues = 0
			since = None

			#Get the last_updated time and total_issues_collected if the repo is found
			if since_info:
				since = since_info['last_updated_time']
				num_issues = since_info['total_issues_collected']

			pprint(f"Fetching open issues for {repo}")

			num_issues += fetch_new_issues(repo, since, auth_token, db)

			pprint(f'Total number of issues: {num_issues}')

			#Store the last updated time for the repo
			since = datetime.now().isoformat()
			since_record_to_store = {
				'repository': repo,
				'last_updated_time': since,
				'total_issues_collected': num_issues
			}
			store_in_db(since_record_to_store, "LastUpdatedInfo", db, primary_key='repository')

		end = time.time()
		pprint(f'Time taken to fetch issues: {end-start} seconds')

		time.sleep(wait_time)

def main():
	parser = argparse.ArgumentParser(description="Data collection for DeepAQAtik")

	parser.add_argument('--github_token', type=str, default=None, help='GitHub Auth token')
	parser.add_argument('--github_repo', type=str, default=['adoptium/aqa-tests', 'eclipse-openj9/openj9', 'adoptium/infrastructure'], nargs='+', help='Github repo to track')
	parser.add_argument('--github_freq', type=int, default=30, help='Frequency of querying for new issues (in minutes)')
	parser.add_argument('--db_connection_url', type=str, default='mongodb://localhost:27017', help='MongoDB Connection URL')
	args = parser.parse_args()

	#Initialize MongoDB client
	db_client = pymongo.MongoClient()
	db = db_client['DeepAQAtikData']

	fetch_github_issues(args, db)

if __name__ == '__main__':
	main()
