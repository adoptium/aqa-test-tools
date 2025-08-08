#determine the best distribution for the data- test if betta is really the best candidate
import scipy.stats as st
from numpy import std, mean, sqrt
from scipy.stats import normaltest
from scipy.stats import chisquare
from scipy.stats import ttest_ind


def get_best_distribution(data,print_info=False):
    dist_names = ["norm", "exponweib", "weibull_max", "weibull_min", "pareto", "genextreme", 'gamma', 'beta', 'rayleigh', 'lognorm']
    dist_results = []
    params = {}
    for dist_name in dist_names:
        dist = getattr(st, dist_name)
        param = dist.fit(data)

        params[dist_name] = param
        # Applying the Kolmogorov-Smirnov test
        D, p = st.kstest(data, dist_name, args=param)
        dist_results.append((dist_name, p))

    # select the best fitted distribution
    best_dist, best_p = (max(dist_results, key=lambda item: item[1]))
    # store the name of the best fit and its p value
    
    if print_info:
        print("Best fitting distribution: "+str(best_dist))
        print("Parameters for the best fit: "+ str(params[best_dist]))

    return best_dist, params[best_dist]

def cohen_d(x,y):
    nx = len(x)
    ny = len(y)
    dof = nx + ny - 2
    return (mean(x) - mean(y)) / sqrt(((nx-1)*std(x, ddof=1) ** 2 + (ny-1)*std(y, ddof=1) ** 2) / dof)

def get_cohen_d_interpretation(d_value,trivial_bound=0.2,small_bound=0.5,moderate_bound=0.8):
    if d_value < trivial_bound:
        return "trivial"
    elif d_value >= trivial_bound and d_value < small_bound:
        return "small"
    elif d_value >= small_bound and d_value < moderate_bound:
        return "moderate"
    else:
        return "large"

'''
Method assumes there is a column Model which model specific data can be identified by. 
measure - indicates the column name of the performance whose samples we wish to test
'''
def normal_test_all_model_samples(results_df, measure, alpha=0.001):
    normal_test_results = []
    for model_type in results_df.Model.unique():
        model_results = results_df[results_df['Model']==model_type][measure].values

        k2, p = normaltest(model_results)
        is_normal = "no" if p < alpha else "yes" 
        normal_test_results.append((model_type,is_normal,p,k2))
    
    return normal_test_results    

'''
Performs a t-test between samples of the given model and samples of other models (model by model).
It assumes results_df has a column "Model"
'''
def t_test_model_samples_against_other_model_samples(results_df,model,measure,alpha=0.01):
    t_test_results = []

    model_results = results_df[results_df['Model']==model][measure].values

    for model_type in results_df.Model.unique():
        if model_type != model:
            other_model_results = results_df[results_df['Model']==model_type][measure].values

            t_test_params = ttest_ind(model_results,other_model_results)
            different_means = 'no' if t_test_params[1] >= alpha else 'yes'
            
            
            t_test_result = [model_type,different_means,t_test_params[0],t_test_params[1]]
            t_test_results.append(t_test_result)
            
    return t_test_results    

'''
Performs a cohen-d-test between samples of the given model and samples of other models (model by model).
It assumes results_df has a column "Model"
'''
def cohen_d_test_model_samples_against_other_model_samples(results_df,model,measure):
    cohen_d_results = []

    model_results = results_df[results_df['Model']==model][measure].values

    for model_type in results_df.Model.unique():
        if model_type != model:
            other_model_results = results_df[results_df['Model']==model_type][measure].values

            effect_size = abs(cohen_d(model_results,other_model_results))
            effect_interpretation = get_cohen_d_interpretation(effect_size)
            cohen_d_result = [model_type,effect_size,effect_interpretation]
            cohen_d_results.append(cohen_d_result)
    
    return cohen_d_results
