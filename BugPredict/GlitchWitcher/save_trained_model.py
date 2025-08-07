import pandas as pd
from REPD_Impl import REPD
from autoencoder import AutoEncoder
import warnings
import tensorflow.compat.v1 as tf
import json
import os
import numpy as np
import urllib.request
from urllib.parse import urlparse

# Suppress warnings
tf.disable_v2_behavior()
warnings.simplefilter("ignore")

def extract_distribution_info(dist, params_tuple):
    """Extract distribution name and parameters from scipy distribution"""
    if dist is None:
        return None, []
    
    try:
        # Get distribution name
        if hasattr(dist, 'name'):
            dist_name = dist.name
        else:
            print(f"Unknown distribution type: {type(dist)}")
            return None, []
        
        # Use the fitted parameters from the params_tuple
        if params_tuple is not None:
            params = [float(p) for p in params_tuple]  # Convert numpy types to float
        else:
            params = []
        
        print(f"Extracted distribution: {dist_name} with {len(params)} parameters: {params}")
        return dist_name, params
        
    except Exception as e:
        print(f"Error extracting distribution info: {e}")
        return None, []

def convert_to_json_serializable(obj):
    """Convert numpy/complex objects to JSON serializable format"""
    if obj is None:
        return None
    elif isinstance(obj, (list, tuple)):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.integer, np.floating)):
        return float(obj)
    elif isinstance(obj, (int, float, str, bool)):
        return obj
    else:
        # Try to convert to string as fallback
        return str(obj)

def is_url(string):
    """Check if the string is a valid URL"""
    try:
        result = urlparse(string)
        return all([result.scheme, result.netloc])
    except:
        return False

def load_training_data(data_source):
    """Load training data from either a local file or URL"""
    if is_url(data_source):
        print(f"Downloading training data from URL: {data_source}")
        try:
            # Download the file
            temp_filename = "temp_training_data.csv"
            urllib.request.urlretrieve(data_source, temp_filename)
            df = pd.read_csv(temp_filename)
            # Clean up temporary file
            os.remove(temp_filename)
            print(f"Successfully downloaded and loaded data from {data_source}")
            return df
        except Exception as e:
            raise Exception(f"Failed to download data from {data_source}: {e}")
    else:
        print(f"Loading training data from local file: {data_source}")
        if not os.path.exists(data_source):
            raise FileNotFoundError(f"Local file not found: {data_source}")
        return pd.read_csv(data_source)

def train_and_save_model(training_data_path="https://github.com/adoptium/aqa-triage-data/GlitchWitcher/Traditional%20Dataset/OpenJ9_Traditional_Dataset.csv", model_save_dir="trained_model"):
    """Train the REPD model and save it for later use
    
    Args:
        training_data_path: Local file path or URL to the training CSV file
        model_save_dir: Directory to save the trained model
    """
    
    # Remove existing model directory to ensure clean save
    if os.path.exists(model_save_dir):
        import shutil
        shutil.rmtree(model_save_dir)
    
    # Create model directory
    os.makedirs(model_save_dir)
    
    # Load training data (from file or URL)
    print("Loading training data...")
    df_train = load_training_data(training_data_path)
    
    # Validate required columns
    required_columns = ["File", "defects"]
    missing_columns = [col for col in required_columns if col not in df_train.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in training data: {missing_columns}")
    
    print(f"Training data shape: {df_train.shape}")
    print(f"Columns: {list(df_train.columns)}")
    
    # Prepare training data
    X_train = df_train.drop(columns=["File", "defects"]).values
    y_train = df_train['defects'].values
    
    print(f"Features shape: {X_train.shape}")
    print(f"Labels shape: {y_train.shape}")
    print(f"Defective samples: {sum(y_train)} / {len(y_train)} ({100*sum(y_train)/len(y_train):.1f}%)")
    
    print("Training model...")
    
    # Initialize and train the model
    autoencoder = AutoEncoder([20, 17, 7], 0.001, 500, 128)
    classifier = REPD(autoencoder)
    classifier.fit(X_train, y_train)
    
    print("Saving model...")
    
    # Save the autoencoder weights
    autoencoder_save_path = os.path.join(model_save_dir, "autoencoder")
    autoencoder.save(autoencoder_save_path)
    
    # Debug the distributions before extraction
    print("\nDebugging distributions:")
    print(f"classifier.dnd: {type(classifier.dnd)} = {classifier.dnd}")
    print(f"classifier.dd: {type(classifier.dd)} = {classifier.dd}")
    
    if hasattr(classifier, 'dnd_pa'):
        print(f"classifier.dnd_pa: {type(classifier.dnd_pa)} = {classifier.dnd_pa}")
    if hasattr(classifier, 'dd_pa'):
        print(f"classifier.dd_pa: {type(classifier.dd_pa)} = {classifier.dd_pa}")
    
    # Extract distribution information WITH their fitted parameters
    print("\nExtracting distribution info...")
    dnd_name, dnd_params = extract_distribution_info(classifier.dnd, getattr(classifier, 'dnd_pa', None))
    dd_name, dd_params = extract_distribution_info(classifier.dd, getattr(classifier, 'dd_pa', None))
    
    # Save classifier parameters as JSON
    classifier_params = {
        'dnd_name': dnd_name,
        'dnd_params': dnd_params,  # These now contain the actual fitted parameters
        'dd_name': dd_name,
        'dd_params': dd_params     # These now contain the actual fitted parameters
    }
    
    print(f"\nSaving classifier params: {classifier_params}")
    
    # Save as JSON
    with open(os.path.join(model_save_dir, "classifier_params.json"), 'w') as f:
        json.dump(classifier_params, f, indent=2)
    
    # Save training metadata as JSON
    metadata = {
        'input_shape': int(X_train.shape[1]),
        'architecture': [20, 17, 7],
        'learning_rate': 0.001,
        'epochs': 500,
        'batch_size': 128,
        'training_data_source': training_data_path,
        'training_samples': int(len(y_train)),
        'defective_samples': int(sum(y_train))
    }
    
    with open(os.path.join(model_save_dir, "metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Model saved to {model_save_dir}")
    print("Training completed!")
    
    # Close TensorFlow session
    autoencoder.close()

if __name__ == "__main__":
    import sys
    
    # Allow command line argument for data source
    if len(sys.argv) > 1:
        data_source = sys.argv[1]
    else:
        data_source = "https://github.com/adoptium/aqa-triage-data/GlitchWitcher/Traditional%20Dataset/OpenJ9_Traditional_Dataset.csv"
    
    print(f"Using data source: {data_source}")
    train_and_save_model(data_source)