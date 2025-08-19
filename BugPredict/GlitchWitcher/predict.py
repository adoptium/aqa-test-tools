import pandas as pd
from REPD_Impl import REPD
from autoencoder import AutoEncoder
import warnings
import tensorflow.compat.v1 as tf
import numpy as np
import json
import sys
import os
import scipy.stats as st

# Suppress warnings
tf.disable_v2_behavior()
warnings.simplefilter("ignore")

def format_predictions(predictions):
    """Format PDF predictions for display"""
    results = []
    try:
        print(f"Predictions shape: {predictions.shape}", file=sys.stderr)
        print(f"Predictions content: {predictions}", file=sys.stderr)
    except Exception:
        pass

    for i in range(predictions.shape[0]):
        pred = predictions[i]
        print(f"Processing prediction {i}: {pred}", file=sys.stderr)
        if isinstance(pred, np.ndarray) and len(pred) >= 2:
            p_defective = float(pred[0])
            p_non_defective = float(pred[1])
        else:
            print(f"Warning: Unexpected prediction format for {i}: {pred}", file=sys.stderr)
            p_defective = 0.0
            p_non_defective = 0.0
        results.append({
            'p_defective': p_defective,
            'p_non_defective': p_non_defective
        })
        print(f"File {i} - P(Defective): {p_defective}, P(Non-Defective): {p_non_defective}", file=sys.stderr)
    return results

def format_results_for_comparison(file_names, base_data, head_data):
    """Format results as tables comparing BEFORE and AFTER for each file"""
    file_changes = []
    for i, file_name in enumerate(file_names):
        if i < len(base_data) and i < len(head_data):
            base_defective = base_data[i]['p_defective']
            base_non_defective = base_data[i]['p_non_defective']
            head_defective = head_data[i]['p_defective']
            head_non_defective = head_data[i]['p_non_defective']

            if base_defective != 0:
                defective_change = ((head_defective - base_defective) / abs(base_defective)) * 100
            else:
                defective_change = 0 if head_defective == 0 else float('inf')

            if base_non_defective != 0:
                non_defective_change = ((head_non_defective - base_non_defective) / abs(base_non_defective)) * 100
            else:
                non_defective_change = 0 if head_non_defective == 0 else float('inf')

            max_change = max(abs(defective_change), abs(non_defective_change))
            file_changes.append({
                'index': i,
                'file_name': file_name,
                'max_change': max_change,
                'defective_change': defective_change,
                'non_defective_change': non_defective_change,
                'base_defective': base_defective,
                'base_non_defective': base_non_defective,
                'head_defective': head_defective,
                'head_non_defective': head_non_defective
            })
        else:
            file_changes.append({
                'index': i,
                'file_name': file_name,
                'max_change': 0,
                'error': True
            })

    file_changes.sort(key=lambda x: x['max_change'], reverse=True)

    output = ["## 📊 Bug Prediction Analysis\n"]
    for file_data in file_changes:
        file_name = file_data['file_name']
        output.append(f"#### File: `{file_name}`\n")
        if 'error' in file_data:
            output.append("| Status |")
            output.append("|--------|")
            output.append("| Error: Prediction data not available |")
            output.append("")
        else:
            base_defective = file_data['base_defective']
            base_non_defective = file_data['base_non_defective']
            head_defective = file_data['head_defective']
            head_non_defective = file_data['head_non_defective']
            defective_change = file_data['defective_change']
            non_defective_change = file_data['non_defective_change']

            def format_change(change_val):
                if change_val == float('inf'):
                    return "∞%"
                elif change_val == float('-inf'):
                    return "-∞%"
                else:
                    return f"{change_val:+.2f}%"

            before = "Defective" if base_defective > base_non_defective else "Non-Defective"
            after = "Defective" if head_defective > head_non_defective else "Non-Defective"
            output.append("Outcome: " + before + " -> " + after)
            output.append("| Metric | BEFORE PR | AFTER PR | % Change |")
            output.append("|--------|-----------|----------|----------|")
            output.append(f"| PDF(Defective \\| Reconstruction Error) | {base_defective} | {head_defective} | {format_change(defective_change)} |")
            output.append(f"| PDF(Non-Defective \\| Reconstruction Error) | {base_non_defective} | {head_non_defective} | {format_change(non_defective_change)} |")
            output.append("")
    return "\n".join(output)

def get_distribution_class(dist_name):
    if dist_name is None:
        return None
    try:
        return getattr(st, dist_name)
    except Exception:
        return None

def load_trained_model(model_dir="trained_model"):
    if not os.path.exists(model_dir):
        raise FileNotFoundError(f"Trained model not found at {model_dir}. Please ensure the model is trained and saved.")

    metadata_path = os.path.join(model_dir, "metadata.json")
    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"Model metadata not found at {metadata_path}")
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    classifier_params_path = os.path.join(model_dir, "classifier_params.json")
    if not os.path.exists(classifier_params_path):
        raise FileNotFoundError(f"Classifier parameters not found at {classifier_params_path}")
    with open(classifier_params_path, 'r') as f:
        classifier_params = json.load(f)

    autoencoder = AutoEncoder(
        metadata['architecture'],
        metadata['learning_rate'],
        metadata['epochs'],
        metadata['batch_size']
    )
    autoencoder_path = os.path.join(model_dir, "autoencoder")
    autoencoder.load(autoencoder_path)

    classifier = REPD(autoencoder)
    classifier.dnd = get_distribution_class(classifier_params.get('dnd_name'))
    classifier.dnd_pa = tuple(classifier_params.get('dnd_params', []))
    classifier.dd = get_distribution_class(classifier_params.get('dd_name'))
    classifier.dd_pa = tuple(classifier_params.get('dd_params', []))

    if classifier.dnd is None:
        raise ValueError("Failed to get non-defective distribution class")
    if classifier.dd is None:
        raise ValueError("Failed to get defective distribution class")

    return classifier

def predict(features_file, model_dir="trained_model"):
    classifier = load_trained_model(model_dir)
    df_test = pd.read_csv(features_file)
    if len(df_test) == 0:
        print("No files to analyze.")
        return []

    file_names_raw = df_test["File"].astype(str).values
    file_names = [os.path.basename(p.replace('\\', '/')) for p in file_names_raw]
    
    X_test = df_test.drop(columns=["File"]).values

    print(f"Processing {len(file_names)} files", file=sys.stderr)
    print(f"File names: {file_names}", file=sys.stderr)
    print(f"X_test shape: {X_test.shape}", file=sys.stderr)

    pdf_predictions = classifier.predict(X_test)
    print(f"Predictions shape: {pdf_predictions.shape}", file=sys.stderr)
    print(f"Predictions type: {type(pdf_predictions)}", file=sys.stderr)

    prediction_data = format_predictions(pdf_predictions)
    results = []
    for i, file_name in enumerate(file_names):
        if i < len(prediction_data):
            results.append({
                'file': file_name,
                'p_defective': prediction_data[i]['p_defective'],
                'p_non_defective': prediction_data[i]['p_non_defective']
            })
        else:
            results.append({'file': file_name, 'error': 'No prediction available'})

    classifier.dim_reduction_model.close()
    return results

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python predict.py <path_to_features.csv>")
        print("Make sure the trained model exists in the 'trained_model' directory.")
        sys.exit(1)

    features_csv_path = sys.argv[1]
    results = predict(features_csv_path)
    for result in results:
        if 'error' in result:
            print(f"File: {result['file']}")
            print(f"Error: {result['error']}")
        else:
            print(f"File: {result['file']}")
            print(f"PDF(Defective | Reconstruction Error): {result['p_defective']}")
            print(f"PDF(Non-Defective | Reconstruction Error): {result['p_non_defective']}")
        print()