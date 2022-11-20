import torch
from torch import nn
import torch.nn.functional as F
import torch.optim as optim
import tensorflow as tf
import tensorflow_io as tfio
import numpy as np
import librosa
import librosa.display
import matplotlib.pyplot as plt

#透過子類化定義神經網路 nn.Module => 繼承 nn.Module
class CNN_Model(nn.Module):
    #初始化神經網路
    def __init__(self):
        super().__init__()
        
        #第一層: 2D convolutional layer
        #input channels(輸入之維度)=1, output channels(輸出之維度)=16, kernel size(filter大小): 7x7, stride=1, zero-padding=6
        self.conv1 = nn.Conv2d(1, 16,7, padding=3)
#         CLASStorch.nn.Conv2d
#         (in_channels, out_channels, kernel_size, stride=1, padding=0, dilation=1, groups=1, bias=True, padding_mode='zeros', 
#          device=None, dtype=None)
        self.conv1_bn = nn.BatchNorm2d(16)  #batch normalization features 的個數 = 16
        self.relu1 = nn.ReLU() #activation function => ReLU
        
        #第二層: 2D convolutional layer
        #input channels=16, output channels=32, kernel size: 5x5, stride=1, zero-padding=4
        self.conv2 = nn.Conv2d(16, 32, 5, padding=2)
        self.conv2_bn = nn.BatchNorm2d(32)  #batch normalization features 的個數 = 32
        self.relu2 = nn.ReLU() #activation function => ReLU
        
        
        #第三層: 2D convolutional layer
        #input channels=32, output channels=64, kernel size: 3x3, stride=2, zero-padding=4
        self.conv3 = nn.Conv2d(32, 64, 3, stride=2, padding=2)
        self.conv3_bn = nn.BatchNorm2d(64)  #batch normalization features 的個數 = 64
        self.relu3 = nn.ReLU() #activation function => ReLU
        
        
        #第四層: fully connected layer
        #input size = 61504, output size = 64
        self.fc1 = nn.Linear(61504, 64)
        
        #第五層(最後一層): fully connected layer
        #input size = 64, output size = 2
        self.fc2 = nn.Linear(64, 2)
        self.fc2_Sig=nn.Sigmoid()
        
        
        
    
    #每個 nn.Module 子類都在 forward 函式中對 input data 做操作
    def forward(self, x):
        #第一層：捲積層
        out = self.conv1(x)
        out = self.conv1_bn(out)
        out = self.relu1(out)        
        #print(out.size())
        
        #第二層：捲積層
        out = self.conv2(out)
        out = self.conv2_bn(out)        
        out = self.relu2(out)
        #print(out.size())
        
        #第三層：捲積層
        out = self.conv3(out)
        out = self.conv3_bn(out)        
        out = self.relu3(out)
        #print(out.size())
   
        
        #第三層做完後做 flatten => 用 view 函式
        out = out.view(out.size(0), -1)
        #print(out.size())
        
        #第四層：全連接層
        out = self.fc1(out)
        
        #第五層(最後一層)：全連接層
        out = self.fc2(out) 
        out = self.fc2_Sig(out) 
        
        
        #最後出來的 output 有兩個，如果第一個比第二個大就代表是 spoof，反之則為真實語音        
        
        return out

using_model=CNN_Model()
using_model = using_model.double()
store_audio_file_path="temp"
audio_file_path=""

def set_using_model(model_path):
    global using_model
    using_model.load_state_dict(torch.load(model_path, map_location='cpu'))
    using_model = using_model.eval() #加薪加的

def audio_to_numpy_mfcc(audio_file):

    global store_audio_file_path
    global audio_file_path
    audio_file_path=audio_file
    
    #-------------------------------------- audio to numpy -------------------------------------------------------

    audio = tfio.audio.AudioIOTensor(audio_file)
    audio_slice = audio[0:]
    audio_tensor=(audio_slice[:,0])

    tensor = tf.cast(audio_tensor, tf.float64) / 32768.0 #張量轉成浮點數
    data = tensor.numpy()
    np.save(store_audio_file_path+"/"+audio_file,data) # 保存为.npy格式


    #--------------------------------------- MFCC  ----------------------------------------------------------------

    #取 MFCC
    data=np.load(store_audio_file_path+"/"+audio_file+'.npy')
    mfcc=librosa.feature.mfcc(y=data,sr=16000,n_mfcc=60,hop_length=137)

    #簡化樣本、調整數據長度
    if mfcc.shape[1]<600:
        while mfcc.shape[1]<600:
            mfcc=np.append(mfcc,[[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0]
                            ,[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0]
                            ,[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0],[0]], axis=1)

    elif mfcc.shape[1]>600:
        while mfcc.shape[1]>600:
            mfcc=np.delete(mfcc,(mfcc.shape[1]-1), axis=1)

    #縮小樣本數量，每 10 column取 一個column 丟進vstack
    mfcc_new=np.vstack((mfcc[:,0],mfcc[:,10]))
    count=20
    while count<600:
        mfcc_new=np.vstack((mfcc_new,mfcc[:,count]))
        count+=10

    #因為vstack的關係，此時的樣本column與row顛倒 60(length)*60
    #所以要將他轉回成 60*60(length)
    mfcc_new=mfcc_new.T

    np.save(store_audio_file_path+"/"+audio_file+"_MFCC.npy", mfcc_new)


def get_prediction():
    global audio_file_path
    # audio_to_numpy_mfcc(audio_file)
    data=np.load(store_audio_file_path+"/"+audio_file_path+"_MFCC.npy")
    data = torch.tensor(data)
    data =data.unsqueeze(0)
    data =data.unsqueeze(0)

    test_output=using_model(data)
    _,pred_y=torch.max(test_output,1)

    # return pred_y

    if pred_y.item()==1:
        print("真實語音")
        return '1'
    else:
        print("欺騙語音") 
        return '0'
