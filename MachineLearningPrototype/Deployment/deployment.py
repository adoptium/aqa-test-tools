from flask import Flask
from flask import request
from flask import jsonify
from flask_cors import CORS

import os
import sys
import pandas as pd
import numpy as np
import joblib
import pickle

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.preprocess_data import remove_time_stamp

app = Flask(__name__)
CORS(app, supports_credentials=True)


@app.route('/')
def deploy_ml_model():
    return 'TRSS ML model deployed!'


@app.route('/predict', methods=['POST'])
def predict_with_ml_model():
    console_output = request.json['console_content']

    # pre-process input data to fit ml model
    console_output_df = pd.DataFrame([console_output]).T
    console_output_df.columns = ['received_content']
    
    # pre-process: remove time stamp
    console_output_df['received_content'] = [remove_time_stamp(content) for content in console_output_df['received_content']]

    # pre-process: vectorize input data with vectorizer from training
    ml_prototype_path = os.path.dirname(os.path.dirname(app.instance_path))
    vectorizer_file_path = os.path.join(ml_prototype_path, 'data/TempData/vectorizer_file.pk')
    with open(vectorizer_file_path, "rb") as vectorizer_file:
        vectorizer = pickle.load(vectorizer_file)
    test_df = pd.DataFrame.sparse.from_spmatrix(vectorizer.transform(console_output_df.pop('received_content')), columns=vectorizer.get_feature_names())
    test_features = np.array(test_df)

    # pre-process: normalize the input features using the sklearn StandardScaler from training
    standardScaler_file_path = os.path.join(ml_prototype_path, 'data/TempData/standardScaler_file.pk')
    with open(standardScaler_file_path, "rb") as standardScaler_file:
        standardScaler = pickle.load(standardScaler_file)
    test_features_standardScaler = standardScaler.transform(test_features)

    # predict with saved ML model
    # parent_dir_path = os.path.abspath(os.path.join(os.getcwd(), os.pardir))
    # ml_model_path = parent_dir_path + '/MLModel.joblib'
    ml_model_path = os.path.join(ml_prototype_path, 'MLModel.joblib')
    savedModel = joblib.load(ml_model_path)
    predicted_label = savedModel.predict(test_features_standardScaler)
    print("savedModel Sample 0 predict label: ", predicted_label[0])

    # transform predicted lable number in to text with num2name dict from training
    # num2name_file_path = parent_dir_path + '/data/TempData/num2name_file'
    num2name_file_path = os.path.join(ml_prototype_path, 'data/TempData/num2name_file')
    with open(num2name_file_path, "rb") as num2name_file:
        label_dict_num2name = pickle.load(num2name_file)
    predicted_result = label_dict_num2name[predicted_label[0]]
    print("savedModel Sample 0 predict label name: ", predicted_result)

    # return result in json format
    output = {}
    output['result'] = predicted_result
    return jsonify(output)

if __name__ == "__main__":
    app.run(host='0.0.0.0')
