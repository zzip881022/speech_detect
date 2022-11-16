from typing import Any
from python_speech_features import mfcc
import numpy as np
from hmmlearn import hmm
from pathlib import Path
import os
import librosa
import random

def preprocessing(signal: np.ndarray, sample_rate: int) -> Any:
    """
    Utility:
            Converting audio signal to MFCC.
    Input:
            signal: the audio signal.
            sample_rate: the rate of sampling.
    Output:
            MFCC array.
    """
    return mfcc(signal, samplerate=sample_rate, nfft=2048)


class SpeechRecognizer:
    def __init__(self, model_name: str, train_dataset: dict):
        # model_name is not important.
        self.__model_name = model_name
        self.__hmm_models = {}
        self.__train(train_dataset)

    def __train(self, train_dataset):
        states_num = 6
        print('Training models...')
        for train_label in train_dataset:
            model = hmm.GMMHMM(
                n_components=states_num, n_iter=20, algorithm='viterbi', tol=0.01)
            # print(train_data_label)
            train_data = train_dataset[train_label]
            train_data = np.vstack(train_data)
            model.fit(train_data)
            self.__hmm_models[train_label] = model
        print('Train finished.')

    def recognize(self, corpus_features: np.ndarray):
        """
        Utility:
                    return the label by given a feature
        Input:
                    corpus_features: MFCC feature
        Output:
                    the recognized label
        """
        score_list = {}
        for model_label in self.__hmm_models:
            model = self.__hmm_models[model_label]
            score_list[model_label] = model.score(corpus_features)
        recoginzed_label = max(score_list, key=score_list.get)
        return recoginzed_label

    def validate(self, test_dataset: dict) -> float:
        """
        Utility:
                    return the accuracy by given a test dataset
        Input:
                    test_dataset: a dictionary (label, corpus feature)
                        
                        key is the label, value is the array of corresponding feature.
        Output:     
                    the accuracy of the model
        """
        true = []
        pred = []
        score_cnt = 0
        corpus_num = 0
        for test_label in test_dataset:
            feature = test_dataset[test_label]
            corpus_num += len(feature)
            for corpus_idx in range(len(feature)):

                # print(test_data_label)
                score_list = {}
                for model_label in self.__hmm_models:
                    model = self.__hmm_models[model_label]
                    score_list[model_label] = model.score(feature[corpus_idx])
                predict_label = max(score_list, key=score_list.get)
                if test_label == predict_label:
                    score_cnt += 1
                else:
                    #print(score_list)
                    #print("Test on true label ", test_label,
                    #      ": predict result label is ", predict_label)
                    pass
                true.append(test_label)
                pred.append(predict_label)
        #print("true:", true, "pred:", pred, sep='\n')
        rate = 100.0 * score_cnt/corpus_num
        return rate

    def getModelName(self):
        return self.__model_name


