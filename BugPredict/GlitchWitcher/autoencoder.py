#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Apr 19 14:06:01 2018

@author: paf
"""

import os
#
import tensorflow.compat.v1 as tf
tf.disable_v2_behavior()
import math

class AutoEncoder:
    
    def __init__(self, layers, lr=0.01, epoch=200, batch_size=512, transfer_function=tf.nn.relu, error_func = lambda x: tf.norm(x,axis=1), print_device=False):
        device = '/cpu:0'
            
        with tf.device(device):
            self.layers = layers
            self.lr = lr
            self.epoch = epoch
            self.batch_size = batch_size
     
            #      
            self.x = tf.placeholder("float", [None, self.layers[0]])
            #
            self.W = []
            #
            self.h = []
            self.b = []
            #
            self.g = []
            self.c = []
            #
            self.d = []
            
            for i in range(len(self.layers)-1):
                limit = 1.0 / math.sqrt(self.layers[i])
                Wi = tf.Variable(tf.random_uniform((self.layers[i], self.layers[i+1]), -limit, limit))
                self.W.append(Wi)
                #
                bi = tf.Variable(tf.zeros([self.layers[i+1]]))
                self.b.append(bi)
                #
                hi = None
                if i==0:
                    hi = transfer_function(tf.matmul(self.x,Wi) + bi)
                else:
                    hi = transfer_function(tf.matmul(self.h[-1],Wi) + bi)
                self.h.append(hi)         
    
            for i in reversed(range(len(self.layers)-1)):
                WiT = tf.transpose(self.W[i])
                #
                ci = tf.Variable(tf.zeros([self.layers[i]]))
                self.c.append(ci)
                #
                gi = None
                if i == len(self.layers)-2:
                    gi = transfer_function(tf.matmul(self.h[-1],WiT) + ci)
                elif i==0:
                    gi = tf.matmul(self.g[-1],WiT) + ci
                else:
                    gi = transfer_function(tf.matmul(self.g[-1],WiT) + ci)
                self.g.append(gi)
            self.g = list(reversed(self.g))
            self.c = list(reversed(self.c))
            #
            self.reduced = self.h[-1]
            
            # Objective functions
            self.meansq = tf.reduce_mean(error_func(self.x-self.g[0]))
            self.train_step = tf.train.AdamOptimizer(self.lr).minimize(self.meansq)
            
            #Decoder only
            self.y = tf.placeholder("float", [None, self.layers[-1]])
            self.decoder_input = self.h[-1]
            
    
            for i in reversed(range(len(self.layers)-1)):
                WiT = tf.transpose(self.W[i])
                #
                ci = self.c[i]            
                di = None
                if i == len(self.layers)-2:
                    di = transfer_function(tf.matmul(self.y,WiT) + ci)
                elif i==0:
                    di = tf.matmul(self.d[-1],WiT) + ci
                else:
                    di = transfer_function(tf.matmul(self.d[-1],WiT) + ci)
                self.d.append(di)
            self.d = list(reversed(self.d))
            
            self.sess = tf.Session()
            init = tf.global_variables_initializer()
            self.sess.run(init)
        
        
    def fit(self,X,print_progress=False):
        batch_count = math.ceil(len(X)/self.batch_size)
        for i in range(self.epoch):
            for j in range(batch_count):
                #creating batch
                start_index = j*self.batch_size
                end_index = (j+1)*self.batch_size
                batch = X[start_index:end_index]
                #train
                self.sess.run(self.train_step, feed_dict={self.x: batch})
            if print_progress:
                print(i,"Error:",self.sess.run(self.meansq, feed_dict={self.x: X}))
        return self
    
    def transform(self,X):
        return self.sess.run(self.reduced,feed_dict={self.x: X})
    
    def inverse_transform(self,X):
        it = self.sess.run(self.d[0],feed_dict={self.y: X})
        return it;
    
    def fit_transform(self,X):
        self.fit(X)
        self.transform(X)
        
    def close(self):
        tf.reset_default_graph()
        self.sess.close()
        
    def debugPrint(self):
        for i, Wi in enumerate(self.W):
            print("W"+str(i)+": ", Wi.shape)
        print()
        for i, bi in enumerate(self.b):
            print("b"+str(i)+": ", bi.shape)
        print()
        for i, hi in enumerate(self.h):
            print("h"+str(i)+": ", hi.shape)
        print()
        for i, ci in enumerate(self.c):
            print("c"+str(i)+": ", ci.shape)
        print()
        for i, gi in enumerate(self.g):
            print("g"+str(i)+": ", gi.shape)
        print()
    
    def save(self, path):
        """Save the autoencoder model"""
        saver = tf.train.Saver()
        saver.save(self.sess, path)

    def load(self, path):
        """Load the autoencoder model"""
        saver = tf.train.Saver()
        saver.restore(self.sess, path) 

        
def load_autoencoder(model_path):

    #Load model arhitecture
    location, model_name = os.path.split(model_path)
    architecture_path = os.path.join(location,model_name,'architecture.txt')
    architecture = None
    with open(architecture_path,'r') as architecture_file:
        architecture = [int(x.strip()) for x in architecture_file.readlines()]

    #Create model
    ae = AutoEncoder(architecture)
    
    #Initialize model
    model_path = model_path + '.ckpt'
    saver = tf.train.Saver()
    saver.restore(ae.sess,model_path)

    return ae   


def main(argv):
    #Determine directory
    #from config_read import HOME
    #model_directory = 'ae'
    #dir_path = os.path.join(HOME, model_directory,'test')
    #os.makedirs(dir_path, exist_ok=True)

    
    #Program
    X = [[1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0]]
    
    ae = AutoEncoder([20,18,14,8,4,2])
    ae.fit(X)
    
    #Save model
    #save_autoencoder(ae,dir_path+"/model")
    
    #Load model
    #ae = load_autoencoder(dir_path+'/2018:04:22_16/model')

    r = ae.transform(X)
    print(r)
    d = ae.inverse_transform(r)
    print(d)
    
    ae.sess.close()    
    

if __name__ == '__main__':
    main([])
