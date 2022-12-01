import warnings
warnings.filterwarnings('ignore')
import os
import wave
import numpy as np
from hmmlearn import hmm
from sklearn.cluster import KMeans
from sklearn.metrics import confusion_matrix
from scipy.io import wavfile
from scipy.io.wavfile import read
from python_speech_features import mfcc
from mlxtend.plotting import plot_confusion_matrix
import matplotlib.pyplot as plt
from scipy.fftpack import dct
import time
from PyEMD import EMD
import tensorflow as tf
import tensorflow_io as tfio
import librosa
import librosa.display
import statistics
import numpy
import seaborn as sns
import pickle
import shutil

test_audio_HMM_Real ='static/synthesis_file/test_audio_HMM_Real/' #測資


test_audio_HMM_Real_Npy ='static/synthesis_file/test_audio_HMM_Real_Npy/'
test_audio_HMM_Real_Emd ='static/synthesis_file/test_audio_HMM_Real_Emd/'
test_audio_HMM_Real_mfcc_mod ='static/synthesis_file/test_audio_HMM_Real_mfcc_mod/'

REAL_model ='static/synthesis_file/HMM_Models_real.pkl'
FAKE_model ='static/synthesis_file/HMM_Models_fake.pkl'
REAL_centers ='static/synthesis_file/centers_Real.npy'
FAKE_centers ='static/synthesis_file/centers_Fake.npy'

#================================================================================================================#
def test(fileName):
    shutil.rmtree(test_audio_HMM_Real_Npy)
    os.mkdir(test_audio_HMM_Real_Npy)
    shutil.rmtree(test_audio_HMM_Real_Emd)
    os.mkdir(test_audio_HMM_Real_Emd)
    shutil.rmtree(test_audio_HMM_Real_mfcc_mod)
    os.mkdir(test_audio_HMM_Real_mfcc_mod)

    testDir = test_audio_HMM_Real

    fileList = [f for f in os.listdir(testDir) if os.path.splitext(f)[1] == '.wav']
    tmp = fileName.split('.')[0]
    #print(tmp)
    audio = tfio.audio.AudioIOTensor(testDir+fileName)
    audio_slice = audio[0:]
    audio_tensor=(audio_slice[:,0])

    tensor = tf.cast(audio_tensor, tf.float64)/32768.0
    data = tensor.numpy()
    np.save(test_audio_HMM_Real_Npy+tmp+'.npy',data)

    emd=EMD()
    emd.FIXE_H = 6
    EMD_Dir = test_audio_HMM_Real_Npy

    fileList = [f for f in os.listdir(EMD_Dir) if os.path.splitext(f)[1] == '.npy']
    for fileName in fileList:
        #print(fileName)
        tmp = fileName.split('.')[0]
        print(tmp)
        data=np.load(EMD_Dir+fileName)
        t=np.linspace(0,1,len(data))
        IMFs = emd.emd(data,t)
        np.save(test_audio_HMM_Real_Emd+tmp+'.npy',IMFs)


    trainDir_Real_Emd = test_audio_HMM_Real_Emd

    fileList = [f for f in os.listdir(trainDir_Real_Emd) if os.path.splitext(f)[1] == '.npy']

    for fileName in fileList:
        tmp = fileName.split('.')[0]
        #print(tmp)

        imf=np.load(trainDir_Real_Emd+fileName)
        imf=imf.tolist()
        sum=np.array(imf[0])+np.array(imf[1])+np.array(imf[5])

        #mfcc=extract_mfcc(sum)
        mfcc=librosa.feature.mfcc(y=sum,sr=16000,n_mfcc=60,hop_length=137) #要調整

        #修 mfcc 長度

        if mfcc.shape[1]<600:
            while mfcc.shape[1]<600:
                mfcc=np.append(mfcc,[[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0]
                              ,[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0]
                              ,[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0]], axis=1)

        elif mfcc.shape[1]>600:
            while mfcc.shape[1]>600:
                mfcc=np.delete(mfcc,(mfcc.shape[1]-1), axis=1)

        np.save(test_audio_HMM_Real_mfcc_mod+tmp+".npy", mfcc)


    testDir_Real = test_audio_HMM_Real_mfcc_mod
    fileList = [f for f in os.listdir(testDir_Real) if os.path.splitext(f)[1] == '.npy']

    testDataSet_Real = {}
    for fileName in fileList:

        mfcc=np.load(testDir_Real+fileName)
        feature=mfcc

        tmp = fileName.split('.')[0]
        #print(tmp)
        label = tmp

        if label not in testDataSet_Real.keys():
            testDataSet_Real[label] = []
            testDataSet_Real[label].append(feature)
            #print
        else:
            exist_feature = testDataSet_Real[label]
            exist_feature.append(feature)
            testDataSet_Real[label] = exist_feature


    print("Finish prepare the training data_Real")

    states_num = 6
    hmm.MultinomialHMM(n_components=states_num)      #<----------------------------------

    score_cnt = 0
    true = []
    pred = []

    score_tmp=0
    total_data=0
    predict_correct=0
    predict_real_data=0

    score_tmp_List=[]
    sum=0.0

    score_real=-1000
    score_fake=-1000

    #print(testDataSet_Real)

    HMM_Models_real = pickle.load(open(REAL_model, 'rb'))
    HMM_Models_fake = pickle.load(open(FAKE_model, 'rb'))

    centers_Real = np.load(REAL_centers)
    centers_Fake = np.load(FAKE_centers)

    for i in testDataSet_Real.keys():
        score_real=-1000
        score_fake=-1000
        print(str(i)+":")

        #print("Real"+i)
        feature = testDataSet_Real[i]

        testData_Real_label = []
        for j in range(len(feature[0])):
            dic_min = np.linalg.norm(feature[0][j]-centers_Real[0])
            label = 0
            for k in range(len(centers_Real)):    
                if np.linalg.norm(feature[0][j]-centers_Real[k])<dic_min:
                    dic_min = np.linalg.norm(feature[0][j]-centers_Real[k])
                    label = k
            testData_Real_label.append(label)   
        scoreList_Real = {}
        scoreList_Fake = {}
        testData_Real_label = np.array([testData_Real_label])


        for model_label in HMM_Models_real.keys():
            #print(model_label)
            model = HMM_Models_real[model_label]
            score = model.score(testData_Real_label)
            scoreList_Real[model_label] = score
            #print(score)
            if(score>score_real):
                score_real=score   

        testData_Fake_label = []
        for j in range(len(feature[0])):
            dic_min = np.linalg.norm(feature[0][j]-centers_Fake[0])
            label = 0
            for k in range(len(centers_Fake)):    
                if np.linalg.norm(feature[0][j]-centers_Fake[k])<dic_min:
                    dic_min = np.linalg.norm(feature[0][j]-centers_Fake[k])
                    label = k
            testData_Fake_label.append(label)
        testData_Fake_label = np.array([testData_Fake_label])

        for model_label in HMM_Models_fake.keys():
            model = HMM_Models_fake[model_label]
            score = model.score(testData_Fake_label)
            scoreList_Fake[model_label] = score
            #print(score)
            if(score>score_fake):
                score_fake=score

        if(score_real>score_fake):
            #predict = max(scoreList_Real, key=scoreList_Real.get)
    #         predict_correct=predict_correct+1
            print("real")
            return "real"
        elif(score_real==score_fake):
            print("unknow")
            return "unknow"
        else:
    #         predict_correct=predict_correct+1
            print("fake")
            return "fake"

        total_data=total_data+1

    # print('辨識率：',predict_correct/total_data*100)