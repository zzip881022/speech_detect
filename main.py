from email.mime import audio
from flask import Flask, jsonify, request, render_template
app = Flask(__name__)
from torch_utils import get_prediction, set_using_model, audio_to_numpy_mfcc
from SpeechRecognizer import *
import mimetypes
mimetypes.add_type('text/css', 'css')
mimetypes.add_type('application/javascript', '.js')

@app.route('/')
@app.route('/login')
def home():
    return render_template('login.html')


@app.route('/predict', methods=['POST'])
def predict():
    if request.method == 'POST':

        verify_model = request.form['verify_model']
        set_using_model(verify_model)
        audio_file = request.form['audio_file']
        audio_to_numpy_mfcc(audio_file)
        prediction = get_prediction()

        

        #==========================================================================================================
        dataset_path = Path("speech_file/")
        speaker_dataset, speaker_datasetV = {}, {}
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
                        if flag == 2:
                            speaker_datasetV[lab + speaker_label].append(corpus_feature)
                        else:
                            speaker_dataset[lab + speaker_label].append(corpus_feature)
                            flag += 1

        speaker_recoginzer = SpeechRecognizer("SpeakerRecognizer", speaker_dataset)

        signal, sample_rate = librosa.load(audio_file)
        speaker_result=speaker_recoginzer.recognize(preprocessing(signal, sample_rate))

        #==========================================================================================================

        data = {'prediction': prediction.item(), 'verify':verify_model, 'audio':audio_file,'speaker':speaker_result}

        return render_template('predict.html', data=data)
        # # try:
        # #     prediction = get_prediction()
        # #     data = {'prediction': prediction.item()}
        # #     return jsonify(data)
        # # except:
        # return jsonify({'error': 'error during prediction'})

@app.route('/chat')
def chat():
    return render_template('chat.html')