#!/usr/bin/env python3
"""
Robust model loader that can handle different serialization approaches
"""

import pandas as pd
import numpy as np
import joblib
import os
from sklearn.preprocessing import StandardScaler
from REPD_Impl import REPD
from autoencoder_tf2 import AutoEncoder

def load_semantic_model(model_dir="trained_model"):
    """Load semantic model with fallback approaches"""
    
    # Try to load the full REPD model first
    repd_model_path = os.path.join(model_dir, "repd_model_DA.pkl")
    scaler_path = os.path.join(model_dir, "scaler.pkl")
    
    # Load scaler (this should always work)
    if not os.path.exists(scaler_path):
        raise FileNotFoundError(f"Scaler not found at {scaler_path}")
    
    scaler = joblib.load(scaler_path)
    print("✅ Scaler loaded")
    
    # Try to load full REPD model
    if os.path.exists(repd_model_path):
        try:
            repd_model = joblib.load(repd_model_path)
            print("✅ Full REPD model loaded")
            return repd_model, scaler
        except Exception as e:
            print(f"⚠️ Could not load full REPD model: {e}")
    
    # Fallback: reconstruct model from components
    print("🔄 Reconstructing model from components...")
    
    # Load model configuration
    config_path = os.path.join(model_dir, "model_config.pkl")
    if not os.path.exists(config_path):
        config_path = os.path.join(model_dir, "training_results.pkl")
    
    if os.path.exists(config_path):
        config = joblib.load(config_path)
        layers = config.get('layers')
        print(f"✅ Model configuration loaded: {layers}")
    else:
        # Use default configuration
        layers = [20, 50, 25, 10]  # Default fallback
        print("⚠️ Using default model configuration")
    
    # Recreate autoencoder
    autoencoder = AutoEncoder(layers, lr=0.01, epoch=100, batch_size=32)
    
    # Try to load autoencoder weights
    weights_path = os.path.join(model_dir, "autoencoder_weights.h5")
    if os.path.exists(weights_path):
        try:
            autoencoder.autoencoder.load_weights(weights_path)
            print("✅ Autoencoder weights loaded")
        except Exception as e:
            print(f"⚠️ Could not load autoencoder weights: {e}")
    
    # Create REPD model
    repd_model = REPD(autoencoder)
    
    # Try to load REPD distributions
    distributions_path = os.path.join(model_dir, "repd_distributions.pkl")
    if os.path.exists(distributions_path):
        try:
            repd_data = joblib.load(distributions_path)
            repd_model.dnd = repd_data.get('dnd')
            repd_model.dnd_pa = repd_data.get('dnd_pa')
            repd_model.dd = repd_data.get('dd')
            repd_model.dd_pa = repd_data.get('dd_pa')
            print("✅ REPD distributions loaded")
        except Exception as e:
            print(f"⚠️ Could not load REPD distributions: {e}")
    
    return repd_model, scaler

if __name__ == "__main__":
    # Test loading
    try:
        model, scaler = load_semantic_model()
        print("✅ Model loading test successful")
    except Exception as e:
        print(f"❌ Model loading test failed: {e}")
