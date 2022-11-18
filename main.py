from email.mime import audio
from flask import Flask, jsonify, request, render_template
app = Flask(__name__)
from torch_utils import get_prediction, set_using_model, audio_to_numpy_mfcc
import mimetypes
mimetypes.add_type('text/css', '.css')
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
        data = {'prediction': prediction.item(), 'verify':verify_model, 'audio':audio_file}
        return render_template('predict.html', data=('虛假語音','真實語音')[prediction.item()==1])
        # # try:
        # #     prediction = get_prediction()
        # #     data = {'prediction': prediction.item()}
        # #     return jsonify(data)
        # # except:
        # return jsonify({'error': 'error during prediction'})

@app.route('/chat')
def chat():
    return render_template('chat.html')