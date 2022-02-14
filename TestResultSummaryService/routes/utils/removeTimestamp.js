function removeTimestamp(inputText) {
    if (!inputText) {
        throw 'No input for removing timestamp!';
    }
    return inputText.replace(/\[\d{4}-\d{2}-\d{2}.*?\] /g, '');
}

module.exports.removeTimestamp = removeTimestamp;
