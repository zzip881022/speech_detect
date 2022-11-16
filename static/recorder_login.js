const recordBtn = document.querySelector("#record-btn");
const player = document.querySelector(".audio-player");
const icon_not_rec = document.querySelector("#icon_not_rec");
const icon_rec = document.querySelector("#icon_rec");

recordBtn.classList.add("notRec");

if (navigator.mediaDevices.getUserMedia) {
    var chunks = [];
    const constraints = {
        audio: true
    };
    navigator.mediaDevices.getUserMedia(constraints).then(
        stream => {
            console.log("授權成功！");

            const mediaRecorder = new MediaRecorder(stream);

            recordBtn.onclick = () => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                    recordBtn.classList.remove("Rec");
                    recordBtn.classList.add("notRec");
                    console.log("錄音结束");
                    icon_not_rec.style.display = "inline-block";
                    icon_rec.style.display = "none";

                    // show the modal
                    var ele = document.getElementsByClassName("modal")[0];
                    ele.style.visibility = "visible";
                    ele.style.opacity = "1";

                    // show backdrop effect
                    var backdrop = document.getElementsByClassName("backdrop")[0];
                    backdrop.style.opacity = "1";
                    backdrop.style.visibility = "visible";
                } else {
                    mediaRecorder.start();
                    console.log("錄音中...");
                    recordBtn.classList.remove("notRec");
                    recordBtn.classList.add("Rec");
                    icon_not_rec.style.display = "none";
                    icon_rec.style.display = "inline-block";
                }
                console.log("錄音器狀態：", mediaRecorder.state);
            };

            mediaRecorder.ondataavailable = e => {
                chunks.push(e.data);
            };

            mediaRecorder.onstop = e => {
                var blob = new Blob(chunks, {
                    type: "audio/flac; codecs=opus"
                });
                chunks = [];
                var audioURL = window.URL.createObjectURL(blob);
                player.src = audioURL;
            };
        },
        () => {
            console.error("授權失敗！");
        }
    );
} else {
    console.error("瀏覽器不支持 getUserMedia");
}