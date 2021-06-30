import re


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

def extract_jenkins_link_and_testname(content):
    jenkins_links = []
    test_names = []

    pattern = r"(https:\/\/.+\/job\/Test_openjdk\d+.+\/\d+)"
    adoptium_jenkins_links = re.findall(pattern, content)
    jenkins_links += adoptium_jenkins_links

    pattern2 = r"(?<=\`)Test_openjdk\d+.+?\/?(?=\`)"
    internal_jenkins_job_names = re.findall(pattern2, content)
    extracted_internal_links = [''.join(('https://internal_jenkins/job/',x)) for x in internal_jenkins_job_names]
    jenkins_links += extracted_internal_links

    pattern3 = r"[a-zA-Z].+\d+(?=_FAILED)" # For "testname_FAILED" to testname
    splitted_content = content.split()
    for string in splitted_content:
        extracted_test = re.findall(pattern3, string)
        test_names += extracted_test

    pattern4 = r"(?<=Test Name: ).+_\d+" # "Test Name: HCRLateAttachWorkload_0" to HCRLateAttachWorkload_0
    special_test_names = re.findall(pattern4, content)
    test_names += special_test_names

    return jenkins_links, test_names
