#!/usr/bin/env python3
"""
Semantic comparison predictions for GlitchWitcher
"""

import sys
import os
import pandas as pd
import numpy as np
import joblib
from REPD_Impl import REPD
from autoencoder_tf2 import AutoEncoder
from load_semantic_model import load_semantic_model

# Suppress TensorFlow progress bars
import tensorflow as tf
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
tf.get_logger().setLevel('ERROR')

def predict_semantic(csv_file, model_dir):
    """Predict semantic analysis results for a CSV file"""
    # Load dataset
    df = pd.read_csv(csv_file)
    
    # Load model and scaler with robust error handling
    try:
        repd_model, scaler = load_semantic_model(model_dir)
        # Try to load training results
        try:
            training_results = joblib.load(f"{model_dir}/training_results.pkl")
        except:
            try:
                training_results = joblib.load(f"{model_dir}/model_config.pkl")
            except:
                training_results = {"feature_columns": ["wmc", "rfc", "loc", "max_cc", "avg_cc", "cbo", "ca", "ce", "ic", "cbm", "lcom", "lcom3", "dit", "noc", "mfa", "npm", "dam", "moa", "cam", "amc"]}
        print("Successfully loaded models using robust loader", file=sys.stderr)
    except Exception as e:
        print(f"Model loading error: {e}", file=sys.stderr)
        print("Training new model with available autoencoder...", file=sys.stderr)
        # Retrain the model using available autoencoder
        from sklearn.preprocessing import StandardScaler
        
        # Try to find a suitable dataset for training
        dataset_paths = [
            "data/openj9_metrics.csv",
            "data/cargotracker_metrics.csv",
            "seantic_trained_models/training_results.pkl"
        ]
        
        dataset_path = None
        for path in dataset_paths:
            if os.path.exists(path) and path.endswith('.csv'):
                dataset_path = path
                break
        
        if not dataset_path:
            raise Exception("No suitable dataset found for training")
            
        df_train = pd.read_csv(dataset_path)
        feature_columns = ["wmc", "rfc", "loc", "max_cc", "avg_cc", "cbo", "ca", "ce", "ic", "cbm", "lcom", "lcom3", "dit", "noc", "mfa", "npm", "dam", "moa", "cam", "amc"]
        X_train = df_train[feature_columns].fillna(0).values
        y_train = df_train["bug"].values
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        input_dim = X_train_scaled.shape[1]
        layers = [input_dim, max(50, input_dim//2), max(25, input_dim//4), max(10, input_dim//8)]
        autoencoder = AutoEncoder(layers, lr=0.01, epoch=50, batch_size=32)
        autoencoder.fit(X_train_scaled, print_progress=False)
        repd_model = REPD(autoencoder)
        repd_model.fit(X_train_scaled, y_train)
        training_results = {"feature_columns": feature_columns}
        print("Successfully trained new model", file=sys.stderr)
    
    # Prepare features
    feature_columns = training_results["feature_columns"]
    X = df[feature_columns].fillna(0).values
    X_scaled = scaler.transform(X)
    
    # Get predictions
    predictions = repd_model.predict(X_scaled)
    
    # Get probability densities
    test_errors = repd_model.calculate_reconstruction_error(X_scaled)
    p_nd = repd_model.get_non_defect_probability(test_errors)
    p_d = repd_model.get_defect_probability(test_errors)
    
    results = []
    for i, (_, row) in enumerate(df.iterrows()):
        results.append({"file": row["class_name"], "p_defective": p_d[i], "p_non_defective": p_nd[i]})
    
    return results

def format_results_for_comparison(file_names, base_data, head_data):
    """Format results for comparison display"""
    output = []
    output.append("### 📊 **Bug Prediction Analysis Results**")
    output.append("")
    
    # Create a summary table first
    output.append("| File | Outcome | Risk Change |")
    output.append("|------|---------|-------------|")
    
    for i, file_name in enumerate(file_names):
        if i < len(base_data) and i < len(head_data):
            base_defective = base_data[i]["p_defective"]
            base_non_defective = base_data[i]["p_non_defective"]
            head_defective = head_data[i]["p_defective"]
            head_non_defective = head_data[i]["p_non_defective"]
            
            base_outcome = "Defective" if base_defective > base_non_defective else "Non-Defective"
            head_outcome = "Defective" if head_defective > head_non_defective else "Non-Defective"
            outcome = f"{base_outcome} → {head_outcome}"
            
            # Calculate risk change
            if base_defective > 0:
                risk_change = ((head_defective - base_defective) / base_defective * 100)
                risk_change = max(-99.99, min(999.99, risk_change))
            else:
                risk_change = 0.0
            
            # Determine risk indicator
            if risk_change > 10:
                risk_indicator = "🔴 High Risk"
            elif risk_change > 0:
                risk_indicator = "🟡 Medium Risk"
            elif risk_change > -10:
                risk_indicator = "🟢 Low Risk"
            else:
                risk_indicator = "🟢 Risk Reduced"
            
            # Extract just the class name from the full path
            class_name = file_name.split(".")[-1] if "." in file_name else file_name
            output.append(f"| `{class_name}.java` | `{outcome}` | {risk_indicator} ({risk_change:+.1f}%) |")
    
    output.append("")
    output.append("### 📈 **Detailed Metrics**")
    output.append("")
    
    for i, file_name in enumerate(file_names):
        if i < len(base_data) and i < len(head_data):
            base_defective = base_data[i]["p_defective"]
            base_non_defective = base_data[i]["p_non_defective"]
            head_defective = head_data[i]["p_defective"]
            head_non_defective = head_data[i]["p_non_defective"]
            
            base_outcome = "Defective" if base_defective > base_non_defective else "Non-Defective"
            head_outcome = "Defective" if head_defective > head_non_defective else "Non-Defective"
            outcome = f"{base_outcome} → {head_outcome}"
            
            # Extract just the class name from the full path
            class_name = file_name.split(".")[-1] if "." in file_name else file_name
            output.append(f"**📄 {class_name}.java**")
            output.append(f"**Outcome**: `{outcome}`")
            output.append("")
            output.append("| Metric | BEFORE PR | AFTER PR | % Change |")
            output.append("|--------|-----------|----------|----------|")
            
            # Calculate percentage changes with better handling of edge cases
            if base_defective > 0:
                pct_change_defective = ((head_defective - base_defective) / base_defective * 100)
                pct_change_defective = max(-99.99, min(999.99, pct_change_defective))  # Limit to reasonable range
            else:
                pct_change_defective = 0.0
            
            if base_non_defective > 0:
                pct_change_non_defective = ((head_non_defective - base_non_defective) / base_non_defective * 100)
                pct_change_non_defective = max(-99.99, min(999.99, pct_change_non_defective))  # Limit to reasonable range
            else:
                pct_change_non_defective = 0.0
            
            output.append(f"| PDF(Defective) | `{base_defective:.6e}` | `{head_defective:.6e}` | `{pct_change_defective:+.2f}%` |")
            output.append(f"| PDF(Non-Defective) | `{base_non_defective:.6e}` | `{head_non_defective:.6e}` | `{pct_change_non_defective:+.2f}%` |")
            output.append("")
    
    return "\n".join(output)

def main():
    """Main function to run comparison"""
    # Determine model directory
    model_dir = "seantic_trained_models" if os.path.exists("seantic_trained_models/repd_model_DA.pkl") else "trained_models"
    
    # Run predictions
    base_results = predict_semantic("metrics_output_base/summary_metrics.csv", model_dir)
    head_results = predict_semantic("metrics_output_head/summary_metrics.csv", model_dir)
    
    # Extract data
    file_names = [r["file"] for r in base_results]
    base_data = [{"p_defective": r["p_defective"], "p_non_defective": r["p_non_defective"]} for r in base_results]
    head_data = [{"p_defective": r["p_defective"], "p_non_defective": r["p_non_defective"]} for r in head_results]
    
    # Format results
    comparison_output = format_results_for_comparison(file_names, base_data, head_data)
    
    # Limit output length to prevent GitHub Actions output issues
    max_length = 10000  # GitHub Actions output limit
    if len(comparison_output) > max_length:
        lines = comparison_output.split("\n")
        truncated_output = []
        current_length = 0
        for line in lines:
            if current_length + len(line) + 1 > max_length - 100:  # Leave some buffer
                truncated_output.append("\n*... Output truncated due to length limits ...*")
                break
            truncated_output.append(line)
            current_length += len(line) + 1
        comparison_output = "\n".join(truncated_output)
    
    print(comparison_output)

if __name__ == "__main__":
    main() 