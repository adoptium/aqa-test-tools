import re
import requests
import json

def remove_time_stamp(content):
    if not content:
        return content
    # Remove time stamp
    new_content = re.sub(r"\d{2}:\d{2}:\d{2}", "", content)
    new_content = re.sub(r"\[\d{4}-\d{2}-\d{2}.*?\]", "", new_content)
    return new_content

def extract_quotation_content(content):
    pattern = "\`\`\`([\s\S]*?)\`\`\`"
    substring = re.findall(pattern, content)
    if (len(substring) >= 1):
        result=' '.join(substring)
        return result

def query_trss_for_jenkins_output(jenkins_url, test_name, trss_servers=["https://trss.adoptium.net"]):
    #Get build info from TRSS
    query_url = "https://trss.adoptium.net/api/parseJenkinsUrl"
    query_params = {"jenkinsUrl": jenkins_url}
    output = requests.get(query_url, query_params)
    output_dict = json.loads(output.content)

    if "output" not in output_dict:
        raise Exception("No response received from TRSS while parsing Jenkins Url")
        return ""

    output_dict = output_dict["output"]

    if output_dict["errorMsg"]:
        raise Exception("Failed to parse Jenkins Url with error message: " + output_dict["errorMsg"])
        return ""

    url = output_dict["serverUrl"]
    build_name = output_dict["buildName"]
    build_num = output_dict["buildNum"]

    query_params = {"url": url,
                    "buildName": build_name,
                    "buildNum": build_num,
                    "testName": test_name,}

    print("Query parameters:")
    print(query_params)

    for server in trss_servers:
        #Try to fetch test data from server
        query_url = f"{server}/api/getOutputByTestInfo"
        print(f"\nQuerying url: {query_url}")

        output = requests.get(query_url, query_params)
        data = json.loads(output.content)

        if "output" in data:
            return data["output"]


    print("Couldn't find data for test")
    return ""

def extract_jenkins_link_and_testname(content):
    jenkins_links = []
    test_names = []

    splitted_content = content.split()
    pattern = r"(https:\/\/.+\/job\/Test_openjdk\d+.+\/\d+)"
    for word in splitted_content:
        adoptium_jenkins_links = re.findall(pattern, word)
        jenkins_links += adoptium_jenkins_links

    pattern2 = r"(?<=\`)Test_openjdk\d+.+?\/?(?=\`)"
    internal_jenkins_job_names = re.findall(pattern2, content)
    extracted_internal_links = [''.join(('https://internal_jenkins/job/',x)) for x in internal_jenkins_job_names]
    jenkins_links += extracted_internal_links

    pattern3 = r"[a-zA-Z].+\d+(?=_FAILED)" # For "testname_FAILED" to testname
    for word in splitted_content:
        extracted_test = re.findall(pattern3, word)
        test_names += extracted_test

    pattern4 = r"(?<=Test Name: ).+_\d+" # "Test Name: HCRLateAttachWorkload_0" to "HCRLateAttachWorkload_0"
    special_test_names = re.findall(pattern4, content)
    test_names += special_test_names

    return jenkins_links, test_names
