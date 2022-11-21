from email.mime import audio
from flask import Flask, jsonify, request, render_template
from torch_utils import get_prediction, set_using_model, audio_to_numpy_mfcc
import shutil
import os
import time
import subprocess
import mimetypes
from SpeechRecognizer import * #語者辨識function
import pymysql #資料庫需要
from flask_sqlalchemy import SQLAlchemy #資料庫需要

mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

db = SQLAlchemy()#db宣告

app = Flask(__name__)
#---------------------------------------- 資料庫連接設定 -----------------------------------------------

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SQLALCHEMY_DATABASE_URI'] = 連接方法://資料庫帳號:資料庫密碼@127.0.0.1:3306/資料庫名稱
app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://root:CSIEa1083334jane@127.0.0.1:3306/speech"
db.init_app(app)#初始化flask-SQLAlchemy

#------------------------------------------------------------------------------------------------------


file_source = 'C:/Users/Alice/Downloads/'
file_destination = 'D:/Codes/graduate_project/speech_detect'
enroll_save_destination = 'D:/Codes/graduate_project/speech_detect/static/speech_file/recording/flac/'

# file_source = 'C:/Users/wyes9/Downloads/'
# file_destination = 'D:/speech_detect_web'
# enroll_save_destination = 'D:/speech_detect_web/static/speech_file/recording/flac/'

@app.route('/')
@app.route('/login')
def home():
    #======================================= 語者資料讀取 ====================================================
    for db in os.listdir(dataset_path):
        for lab in os.listdir(dataset_path / db):
            print("Read dataset...")
            for speaker_label in os.listdir(dataset_path / db / lab):
                speaker_dataset[lab + speaker_label] = []
                speaker_datasetV[lab + speaker_label] = []
                speaker_dir = os.listdir(dataset_path / db / lab / speaker_label)
                random.shuffle(speaker_dir)
                flag = 0
                for corpus in speaker_dir:
                    signal, sample_rate = librosa.load(dataset_path / db / lab / speaker_label / corpus)
                    corpus_feature =  preprocessing(signal, sample_rate)
                    if flag == 3:
                        speaker_datasetV[lab + speaker_label].append(corpus_feature)
                    else:
                        speaker_dataset[lab + speaker_label].append(corpus_feature)
                        flag += 1
    #===========================================================================================================
    return render_template('login.html')


@app.route('/predict', methods=['POST'])
def predict():
    time.sleep(1)
    if request.method == 'POST':
        verify_model = request.form['verify_model']
        set_using_model(verify_model)
        audio_file = request.form['audio_file']
        shutil.move(file_source + audio_file,file_destination)
        subprocess.run("ffmpeg -i " + audio_file + " -c:v copy -c:a flac transfer.flac")
        time.sleep(1)
        audio_to_numpy_mfcc("transfer.flac")
        prediction = get_prediction()
        # data = {'prediction': prediction.item(), 'verify':verify_model, 'audio':audio_file}

        #==========================================================================================================

        speaker_recoginzer = SpeechRecognizer("SpeakerRecognizer", speaker_dataset)

        signal, sample_rate = librosa.load("transfer.flac")
        speaker_result=speaker_recoginzer.recognize(preprocessing(signal, sample_rate))
        print("語者預測: ",speaker_result)

        #==========================================================================================================

    #辨識完後刪除檔案
    try:
        os.remove(file_destination + '/' + audio_file)
        os.remove(file_destination + '/transfer.flac')
    except OSError as e:
        print(e)
    else:
        print("File is deleted successfully")

    
    return prediction

    # return render_template('predict.html', data=('虛假語音','真實語音')[prediction.item()==1])

    # # try:
    # #     prediction = get_prediction()
    # #     data = {'prediction': prediction.item()}
    # #     return jsonify(data)
    # # except:
    # return jsonify({'error': 'error during prediction'})


@app.route('/chat')
def chat():
    return render_template('chat.html')


@app.route('/moveto/<folder_num>/<train_data_num>', methods=['POST'])
def moveto(folder_num, train_data_num):
    path = enroll_save_destination + folder_num

    if not os.path.isdir(path):  # 不存在就建立
        os.makedirs(path)
    elif train_data_num == '1':  # 存在且不是現在這個人的資料就刪掉後再建立
        print("existinnnnnnnnng")
        try:
            shutil.rmtree(path)
        except OSError as e:
            print(e)
        else:
            print("The directory is deleted successfully")
        os.makedirs(path)

    time.sleep(2)
    audio_file = request.form['audio_file']
    shutil.move(file_source + audio_file, enroll_save_destination + folder_num)

    return 'success'


@app.route('/count_people_num', methods=['POST'])
# 統計資料夾內有幾個檔案，並回傳當作註冊人的編號
def count():
    DIR = enroll_save_destination  # 要統計的資料夾
    return str(len([name for name in os.listdir(DIR) if os.path.isdir(os.path.join(DIR, name))]))


@app.route('/delete/<folder_num>/<train_data_num>', methods=['POST'])
def delete(folder_num, train_data_num):
    DIR = enroll_save_destination
    try:
        os.remove(DIR + folder_num + '/train' + train_data_num + '.flac')
    except:
        return 'delete error'
    else:
        return 'delete success'


@app.route('/register/<register_id>/<pass_word>', methods=['POST'])
def register(register_id,pass_word):
    sql_cmd = """INSERT INTO user(speaker_id,user_password) VALUES (%s,%s)"""
    tuple1 = (register_id,pass_word)
    try:
        query_data = db.engine.execute(sql_cmd,tuple1)
    except:
        return 'register error'
    else:
        return 'register success'
    
    
