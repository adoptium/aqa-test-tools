import numpy as np
from stat_util import get_best_distribution
import scipy.stats as st
import os

class REPD:
    
    def __init__(self,dim_reduction_model,error_func=lambda x: np.linalg.norm(x,ord=2,axis=1)):
        self.dim_reduction_model = dim_reduction_model
        
        self.dnd = None #Distribution non defect
        self.dnd_pa = None #Distribution non defect parameters

        self.dd = None #Distribution defect
        self.dd_pa = None #Distribution defect parameters

        self.error_func = error_func
        
    '''
    X should be a N*M matrix of data instances
    y should be a binary vector where 1 indicates a defect instance and 0 a normal instance 
    '''
    def fit(self,X,y):
        #Prepare data
        X_nd = X[y==0]
        X_d = X[y==1]

        #Dim reduction model initialization
        self.dim_reduction_model.fit(X_nd)
        
        #Calculate reconstruction errors for train defective and train non-defective
        nd_errors = self.calculate_reconstruction_error(X_nd)
        d_errors = self.calculate_reconstruction_error(X_d)
        
        #Determine distribution
        best_distribution_nd = get_best_distribution(nd_errors)
        best_distribution_d = get_best_distribution(d_errors)

        #Initialize distributions
        self.dnd = getattr(st, best_distribution_nd[0])
        self.dnd_pa = best_distribution_nd[1]
        
        self.dd = getattr(st, best_distribution_d[0])
        self.dd_pa = best_distribution_d[1]
        
    def predict(self,X):
        #Test model performance
        test_errors = self.calculate_reconstruction_error(X)
        
        p_nd = self.get_non_defect_probability(test_errors)
        p_d = self.get_defect_probability(test_errors)
        
        # Fix: Create pairs of (p_nd[i], p_d[i]) for each sample i
        # Instead of repeating the same values for all samples
        predictions = []
        for i in range(len(X)):
            # Handle both scalar and array cases
            if np.isscalar(p_nd):
                pred_nd = p_nd
                pred_d = p_d
            else:
                pred_nd = p_nd[i] if i < len(p_nd) else p_nd[0]
                pred_d = p_d[i] if i < len(p_d) else p_d[0]
            
            predictions.append((pred_d, pred_nd))  # Note: switched order to match your expected format
        
        return np.asarray(predictions)
    
    def get_non_defect_probability(self,errors):
        return self.__get_data_probability__(errors,self.dnd,self.dnd_pa)
    
    def get_defect_probability(self,errors):
        return self.__get_data_probability__(errors,self.dd,self.dd_pa)
    
    def calculate_reconstruction_error(self,X):
        t = self.dim_reduction_model.transform(X)
        r = self.dim_reduction_model.inverse_transform(t)
        x_diff = r-X
        return self.error_func(x_diff)
    
    def get_probability_data(self):
        example_errors = np.linspace(0,3000,100)
        nd_p = self.get_non_defect_probability(example_errors)
        d_p = self.get_defect_probability(example_errors)
        return example_errors,nd_p,d_p
        
    def __get_data_probability__(self,data,distribution,distribution_parameteres):
        parameter_count = len(distribution_parameteres)
        probability = None
        if parameter_count==1:
            probability = distribution.pdf(data,distribution_parameteres[0])
        elif parameter_count==2:
            probability = distribution.pdf(data,distribution_parameteres[0],distribution_parameteres[1])
        elif parameter_count==3:
            probability = distribution.pdf(data,distribution_parameteres[0],distribution_parameteres[1],distribution_parameteres[2])
        elif parameter_count==4:
            probability = distribution.pdf(data,distribution_parameteres[0],distribution_parameteres[1],distribution_parameteres[2],distribution_parameteres[3])
        elif parameter_count==5:
            probability = distribution.pdf(data,distribution_parameteres[0],distribution_parameteres[1],distribution_parameteres[2],distribution_parameteres[3],distribution_parameteres[4])
        return probability
    
    def save(self, directory):
        """Save the REPD model"""
        if not os.path.exists(directory):
            os.makedirs(directory)
        
        # Save autoencoder
        self.autoencoder.save(os.path.join(directory, "autoencoder"))
        
        # Save any other trained parameters
        # (depending on your implementation)
    
    def load(self, directory):
        """Load the REPD model"""
        # Load autoencoder
        self.autoencoder.load(os.path.join(directory, "autoencoder"))