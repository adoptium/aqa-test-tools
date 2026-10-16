#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TensorFlow 2.x compatible AutoEncoder for GlitchWitcher Semantic Analysis
"""

import os
import tensorflow as tf
import math
import numpy as np

# Suppress TensorFlow progress bars and logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
tf.get_logger().setLevel('ERROR')

def default_error_function(x):
    """Default error function for AutoEncoder"""
    return tf.norm(x, axis=1)

class AutoEncoder:
    
    def __init__(self, layers, lr=0.01, epoch=200, batch_size=512, transfer_function=tf.nn.relu, error_func=None, print_device=False):
        if error_func is None:
            error_func = default_error_function
            
        self.layers = layers
        self.lr = lr
        self.epoch = epoch
        self.batch_size = batch_size
        self.transfer_function = transfer_function
        self.error_func = error_func
        
        # Check for GPU
        device = '/CPU:0'
        if tf.config.list_physical_devices('GPU'):
            if print_device:
                print("\nUsing GPU\n")
            device = '/GPU:0'
        
        # Build the model
        self._build_model()
        
    def _build_model(self):
        """Build the autoencoder model using TensorFlow 2.x"""
        # Encoder
        encoder_input = tf.keras.Input(shape=(self.layers[0],))
        x = encoder_input
        
        for i in range(len(self.layers) - 1):
            limit = 1.0 / math.sqrt(self.layers[i])
            x = tf.keras.layers.Dense(
                self.layers[i + 1],
                activation=self.transfer_function,
                kernel_initializer=tf.keras.initializers.RandomUniform(-limit, limit),
                bias_initializer='zeros'
            )(x)
        
        # Encoder output (latent representation)
        self.encoded = x
        
        # Decoder
        decoder_input = tf.keras.Input(shape=(self.layers[-1],))
        y = decoder_input
        
        for i in reversed(range(len(self.layers) - 1)):
            limit = 1.0 / math.sqrt(self.layers[i])
            if i == 0:
                # Output layer - no activation for reconstruction
                y = tf.keras.layers.Dense(
                    self.layers[i],
                    kernel_initializer=tf.keras.initializers.RandomUniform(-limit, limit),
                    bias_initializer='zeros'
                )(y)
            else:
                y = tf.keras.layers.Dense(
                    self.layers[i],
                    activation=self.transfer_function,
                    kernel_initializer=tf.keras.initializers.RandomUniform(-limit, limit),
                    bias_initializer='zeros'
                )(y)
        
        # Create models
        self.encoder = tf.keras.Model(encoder_input, self.encoded)
        self.decoder = tf.keras.Model(decoder_input, y)
        
        # Autoencoder
        self.autoencoder = tf.keras.Model(encoder_input, self.decoder(self.encoded))
        
        # Compile
        self.autoencoder.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=self.lr),
            loss='mse'
        )
        
    def fit(self, X, print_progress=False):
        """Train the autoencoder"""
        batch_count = math.ceil(len(X) / self.batch_size)
        
        # Use fit method for training
        history = self.autoencoder.fit(
            X, X,
            epochs=self.epoch,
            batch_size=self.batch_size,
            verbose=1 if print_progress else 0,
            shuffle=True
        )
        
        return self
    
    def transform(self, X):
        """Encode the input data"""
        return self.encoder.predict(X, verbose=0)
    
    def inverse_transform(self, X):
        """Decode the encoded data"""
        return self.decoder.predict(X, verbose=0)
    
    def fit_transform(self, X):
        """Fit the model and transform the data"""
        self.fit(X)
        return self.transform(X)
    
    def close(self):
        """Clean up resources"""
        # TensorFlow 2.x doesn't need explicit session cleanup
        pass
    
    def debugPrint(self):
        """Print model architecture"""
        print("AutoEncoder Architecture:")
        self.autoencoder.summary()

def load_autoencoder(model_path):
    """Load a saved autoencoder model"""
    try:
        # Try to load as Keras model
        autoencoder = tf.keras.models.load_model(model_path)
        
        # Create wrapper
        ae = AutoEncoder([autoencoder.input_shape[1], autoencoder.output_shape[1]])
        ae.autoencoder = autoencoder
        
        return ae
    except Exception as e:
        print(f"Failed to load model: {e}")
        return None

def main():
    """Test the autoencoder"""
    # Create sample data
    X = np.random.rand(100, 20)
    
    # Create and train autoencoder
    ae = AutoEncoder([20, 18, 14, 8, 4, 2])
    ae.fit(X, print_progress=False)
    
    # Test transform
    encoded = ae.transform(X)
    decoded = ae.inverse_transform(encoded)
    
    print(f"Original shape: {X.shape}")
    print(f"Encoded shape: {encoded.shape}")
    print(f"Decoded shape: {decoded.shape}")
    print(f"Reconstruction error: {np.mean((X - decoded) ** 2)}")

if __name__ == '__main__':
    main() 