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
