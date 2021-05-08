import requests
import argparse
from datetime import datetime
from datetime import date
from math import ceil
import time
from pprint import pprint

def get_num_pages(repo):
	"""
	Fetch the number of pages that store issues
	"""
	repo_query_url = f'https://api.github.com/repos/{repo}'
	num_issues = requests.get(repo_query_url).json()['open_issues_count']
	num_pages = ceil(num_issues/100)
	return num_pages

def fetch_all_new_issues(repo, since, auth_token, labels):
	"""
	Fetch all new open issues in the repo
	"""
	num_pages = get_num_pages(repo)
	pprint(f'Need to query {num_pages} pages')

	page_number = 1

	open_issues = []
	
	query_url = f'https://api.github.com/repos/{repo}/issues'
	params = {'accept': 'application/vnd.github.v3+json',
			  'state': 'open',
			  'since': since,
			  'per_page': 100,
			  'page': page_number,}

	headers = None
	if auth_token:
		headers = {'Authorization': f'token {auth_token}'}

	while page_number <= num_pages:
		params['page'] = page_number
		response = requests.get(query_url, headers=headers, params=params).json()
		open_issues.extend([r for r in response if 'pull_request' not in r])
		pprint(f'Found {len(open_issues)} open issues')
		page_number += 1
	
	pprint(f'Found {len(open_issues)} open issues in total')
	since = datetime.now().isoformat()
	
	return since

def fetch_issues_with_label(query_url, headers, params, label):
	"""
	Fetch all new open issues in the repo with a given label
	"""
	open_issues = []
	page_number = 1
	params['labels'] = label
		
	while True:
		params['page'] = page_number
		response = requests.get(query_url, headers=headers, params=params).json()
		open_issues_on_page = [r for r in response if 'pull_request' not in r]
		
		if len(open_issues_on_page) == 0:
			break
		
		open_issues.extend(open_issues_on_page)
		pprint(f'Found {len(open_issues_on_page)} open issues')
		page_number += 1	

	pprint(f'Found {len(open_issues)} open issues in total')
	
def fetch_issues_with_labels(repo, since, auth_token, labels):
	"""
	Fetch all new open issues in the repo with the given labels
	"""
	query_url = f'https://api.github.com/repos/{repo}/issues'
	params = {'accept': 'application/vnd.github.v3+json',
			  'state': 'open',
			  'since': since,
			  'per_page': 100,
			  'page': 1,
			  'labels': None,}

	headers = None
	if auth_token:
		headers = {'Authorization': f'token {auth_token}'}

	for label in labels:
		fetch_issues_with_label(query_url, headers, params, label)

	return datetime.now().isoformat()

def fetch_github_issues(args):
	"""
	Track all new open issues in the repo with the given labels
	"""
	
	repo = args.github_repo
	since = args.github_since
	auth_token = args.github_token
	wait_time = args.github_freq * 60
	# labels = args.github_issue_labels
	labels = ['release triage', 'triage required']

	while True:
		start = time.time()
		since = fetch_issues_with_labels(repo, None, auth_token, labels)
		end = time.time()
		pprint(f'Time taken to fetch issues: {end-start} seconds')

		time.sleep(wait_time)

def main():
	parser = argparse.ArgumentParser(description="Data collection for DeepAQAtik")

	parser.add_argument('--github_token', type=str, default=None, help='GitHub Auth token')
	parser.add_argument('--github_repo', type=str, default='adoptium/aqa-tests', help='Github repo to track')
	parser.add_argument('--github_since', type=date.fromisoformat, default=None, help='Since parameter (ISO format)')
	parser.add_argument('--github_freq', type=int, default=30, help='Frequency of querying for new issues (in minutes)')
	parser.add_argument('--github_issue_labels', type=str, default=None, help='Labels of issues to be fetched')
	args = parser.parse_args()

	fetch_github_issues(args)

if __name__ == '__main__':
	main()




