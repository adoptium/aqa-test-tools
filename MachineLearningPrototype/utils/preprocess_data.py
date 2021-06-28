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

def get_test_output(jenkins_url, test_name, config_file_path="./config.json"):
    #Get servers to query
    with open(config_file_path) as config_file:
        config = json.loads(config_file.read())
        if "servers" not in config:
            raise Exception("No servers in config file")
            return ""
        servers = config["servers"]
    
    #Get build info from TRSS
    query_url = "https://trss.adoptium.net/api/parseJenkinsUrl"
    query_params = {"jenkinsUrl": jenkins_url}
    output = requests.get(query_url, query_params)
    output_dict = json.loads(output.content)

    if "output" not in output_dict:
        raise Exception("Invalid jenkins Url")
        return ""
    
    output_dict = output_dict["output"]
    success = (output_dict["errorMsg"] == "")
    
    if not success:
        raise Exception("Failed to parse Jenkins Url")
        return ""

    url = output_dict["serverUrl"]
    build_name = output_dict["buildName"]
    build_num = output_dict["buildNum"]

    for server in servers:
        query_url = f"{server}/api/getOutputByTestInfo"
        query_params = {"url": url,
                        "buildName": build_name,
                        "buildNum": build_num,
                        "testName": test_name,}

        output = requests.get(query_url, query_params)
        data = json.loads(output.content)

        if "output" in data:
            return data["output"]
    
    print("Couldn't find data for test")
    return ""

data = get_test_output("https://ci.adoptopenjdk.net/job/Test_openjdk8_bisheng_sanity.openjdk_aarch64_linux/22", "jdk_math_1") 
print(data)