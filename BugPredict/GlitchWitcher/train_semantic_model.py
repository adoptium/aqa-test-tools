#!/usr/bin/env python3
"""
Train semantic models for GlitchWitcher
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from REPD_Impl import REPD
from autoencoder_tf2 import AutoEncoder
import os

# Suppress TensorFlow progress bars
import tensorflow as tf
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
tf.get_logger().setLevel('ERROR')

def train_semantic_model(dataset_path):
    """Train semantic model for bug prediction"""
    # Load dataset
    df = pd.read_csv(dataset_path)
    
    # Prepare features
    feature_columns = ["wmc", "rfc", "loc", "max_cc", "avg_cc", "cbo", "ca", "ce", "ic", "cbm", "lcom", "lcom3", "dit", "noc", "mfa", "npm", "dam", "moa", "cam", "amc"]
    X = df[feature_columns].fillna(0).values
    y = df["bug"].values
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Create autoencoder
    input_dim = X_scaled.shape[1]
    layers = [input_dim, max(50, input_dim//2), max(25, input_dim//4), max(10, input_dim//8)]
    autoencoder = AutoEncoder(layers, lr=0.01, epoch=100, batch_size=32)
    
    # Train autoencoder
    autoencoder.fit(X_scaled, print_progress=False)
    
    # Create REPD model
    repd_model = REPD(autoencoder)
    repd_model.fit(X_scaled, y)
    
    # Save models
    os.makedirs("trained_model", exist_ok=True)
    
    try:
        # Save the REPD model (this might have serialization issues)
        joblib.dump(repd_model, "trained_model/repd_model_DA.pkl")
        print("✅ REPD model saved successfully")
    except Exception as e:
        print(f"⚠️ Warning: Could not save REPD model: {e}")
        # Try saving just the autoencoder weights and REPD parameters separately
        try:
            # Save autoencoder weights
            autoencoder.autoencoder.save_weights("trained_model/autoencoder_weights.h5")
            
            # Save REPD parameters that can be serialized
            repd_params = {
                'class_weights': getattr(repd_model, 'class_weights', None),
                'feature_columns': feature_columns,
                'input_dim': input_dim,
                'layers': layers
            }
            joblib.dump(repd_params, "trained_model/repd_params.pkl")
            print("✅ Autoencoder weights and REPD parameters saved separately")
        except Exception as e2:
            print(f"❌ Error saving model components: {e2}")
            return False
    
    joblib.dump(scaler, "trained_model/scaler.pkl")
    
    # Save training results
    training_results = {
        "feature_columns": feature_columns, 
        "input_dim": input_dim, 
        "layers": layers, 
        "dataset_shape": X.shape
    }
    joblib.dump(training_results, "trained_model/training_results.pkl")
    
    print("Model training completed successfully")
    return True

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python train_semantic_model.py <dataset_path>")
        sys.exit(1)
    
    success = train_semantic_model(sys.argv[1])
    if not success:
        sys.exit(1) 