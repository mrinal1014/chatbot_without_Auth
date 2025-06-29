document.addEventListener("DOMContentLoaded", function () {
    const API_KEY = 'AIzaSyBWaQeqtmP45OLUzs-suD3qmo9oslIggCI'; // ⛔ Use proxy in production
const langSelect = document.getElementById("lang-select");
const selectedLang = document.getElementById('langSelect')?.value || 'en-IN';
const mode = document.getElementById('assistant-mode')?.value || 'friendly';

    const botVideo = document.getElementById("botVideo");
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const webcamBtn = document.getElementById("webcam-btn");
    const webcamVideo = document.getElementById("webcam");

    let webcamStream = null;
    let handCamera = null;
    let hands = null;
    let webcamActive = false;
    let gestureCooldown = false;
    let currentRecognition = null;
let availableVoices = [];

window.speechSynthesis.onvoiceschanged = () => {
    // Trigger once to ensure voices are loaded
    speechSynthesis.getVoices();
};


    const gestureCanvas = document.createElement('canvas');
    gestureCanvas.width = 320;
    gestureCanvas.height = 240;
    gestureCanvas.style.position = 'absolute';
    gestureCanvas.style.zIndex = '10';
    document.body.appendChild(gestureCanvas);
    const gestureCtx = gestureCanvas.getContext('2d');

    const updateCanvasPosition = () => {
        const rect = webcamVideo.getBoundingClientRect();
        gestureCanvas.style.top = rect.top + 'px';
        gestureCanvas.style.left = rect.left + 'px';
    };
    window.addEventListener("resize", updateCanvasPosition);
    updateCanvasPosition();

    function createHands() {
        const newHands = new Hands({
            locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        newHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        newHands.onResults(results => {
            try {
                gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
                if (results.multiHandLandmarks?.length > 0) {
                    const lm = results.multiHandLandmarks[0];
                    drawConnectors(gestureCtx, lm, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                    drawLandmarks(gestureCtx, lm, { color: '#FF0000', lineWidth: 1 });
                    const gesture = detectGesture(lm);
                    if (gesture) handleGesture(gesture);
                }
            } catch (e) {
                console.error("Gesture detection error:", e);
            }
        });

        return newHands;
    }

    hands = createHands();

    function detectGesture(lm) {
        const y = i => lm[i].y;
        const isUp = (tip, dip) => y(tip) < y(dip);
        const fingers = [
            isUp(4, 3), isUp(8, 6), isUp(12, 10),
            isUp(16, 14), isUp(20, 18)
        ];
        const [thumb, index, middle, ring, pinky] = fingers;

        if (!index && !middle && !ring && !pinky) return 'fist';
        if (index && !middle && !ring && !pinky) return 'point';
        if (index && middle && !ring && !pinky) return 'peace';
        if (index && middle && ring && !pinky) return 'three';
        if (index && !middle && !ring && pinky) return 'rock';
        if (index && middle && ring && pinky) return 'open';
        return null;
    }

    async function handleGesture(gesture) {
        if (gestureCooldown) return;
        gestureCooldown = true;
        console.log("Gesture:", gesture);

        switch (gesture) {
            case 'open':
                stopSpeaking();
                userInput.value = "Hello!";
                handleSendMessage();
                break;
            case 'point':
                stopSpeaking();
                currentRecognition = startVoiceRecognition();
                break;
            case 'peace':
                stopSpeaking();
                const coolPrompts = [
                    "Tell me a cool fact about space!",
                    "What's a fun science trick?",
                    "Share a weird and awesome animal fact!",
                    "Give me a creative idea for a robot!",
                    "Tell me a cool myth or legend!"
                ];
                userInput.value = coolPrompts[Math.floor(Math.random() * coolPrompts.length)];
                handleSendMessage();
                break;
            case 'fist':
                stopSpeaking();
                if (webcamActive) {
                    await shutdownWebcam();
                    appendMessage("System", "Webcam stopped via gesture.");
                } else {
                    chatBox.innerHTML = '';
                }
                break;
            case 'rock':
                stopSpeaking();
                await restartWebcam();
                break;
            case 'stopMic':
                if (currentRecognition) {
                    currentRecognition.stop();
                    currentRecognition = null;
                    appendMessage("System", "Microphone stopped via gesture.");
                }
                break;
        }

        setTimeout(() => gestureCooldown = false, 4000);
    }
async function startWebcam() {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
    webcamVideo.srcObject = webcamStream;
    webcamVideo.play();
    webcamBtn.textContent = "🎥 Stop Webcam";
    webcamActive = true;

    const localHands = hands;  // ✅ capture the new instance safely

    handCamera = new Camera(webcamVideo, {
  onFrame: async () => {
    try {
      if (webcamActive && hands && typeof hands.send === "function") {
        await hands.send({ image: webcamVideo });
      }
    } catch (e) {
      if (e.message.includes("deleted object") || e.message.includes("SolutionWasm")) {
        console.warn("🛑 Skipping frame: hands instance already closed.");
      } else {
        console.error("❌ Unexpected hands.send error:", e);
      }
    }
  },
  width: 320,
  height: 240
});


    handCamera.start();
  } catch (err) {
    alert('Unable to access webcam: ' + err.message);
  }
}

    async function shutdownWebcam() {
        webcamActive = false;

        if (handCamera) {
            await handCamera.stop();
            handCamera = null;
        }

        if (hands && typeof hands.close === 'function') {
            try {
                await hands.close();
            } catch (e) {
                console.warn("Error closing hands:", e);
            }
            hands = null; // ⛔ Prevent future use of closed instance
        }

        if (webcamStream) {
            webcamStream.getTracks().forEach(t => t.stop());
            webcamStream = null;
        }

        webcamVideo.srcObject = null;
        webcamBtn.textContent = "🎥 Start Webcam";
        hands = createHands(); // ✅ Fresh instance
    }

    async function restartWebcam() {
        await shutdownWebcam();
        await startWebcam();
        appendMessage("System", "Webcam restarted via gesture.");
    }

    function toggleWebcam() {
        if (webcamActive) shutdownWebcam();
        else startWebcam();
    }

    function stopSpeaking() {
        if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    }

    function speakText(text) {
        stopSpeaking();
        const langMap = {
            'hi-IN': /[ऀ-ॿ]+/,
            'bn-IN': /[অ-ঌ঍-ৡৠ-৾]/,
            'es-ES': /[áéíóúñ¿¡]/i,
            'fr-FR': /[éèêàçâùœ]/i,
            'de-DE': /[äöüß]/i
        };

        let lang = 'en-IN';
        for (const [code, regex] of Object.entries(langMap)) {
            if (regex.test(text)) lang = code;
        }

        const utterance = new SpeechSynthesisUtterance(text.trim());
        utterance.lang = lang;
        const voices = speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang === lang && /female|google/i.test(v.name)) || null;
        speechSynthesis.speak(utterance);
    }
async function getGeminiResponse(prompt) {
    const selectedLang = document.getElementById('langSelect').value || 'en-IN';
    const mode = document.getElementById('assistant-mode').value || 'friendly';

    const langNameMap = {
        'en-IN': 'English', 'hi-IN': 'Hindi', 'bn-IN': 'Bengali',
        'es-ES': 'Spanish', 'fr-FR': 'French', 'de-DE': 'German'
    };

    const personalityPromptMap = {
        friendly: "Speak like a kind and warm-hearted friend. Encourage and smile through your words.",
        funny: "Use witty and playful language. Make light jokes when possible.",
        wise: "Be like a wise mentor or old friend with deep insights and calm words.",
        therapist: "Speak gently, like a therapist. Be calm, comforting, and supportive, especially if the user is sad or stressed."
    };

    const time = new Date().getHours();
    const timeContext = time < 12 ? "It's morning" : time < 18 ? "It's afternoon" : "It's evening";

    const safePrompt = `
You are a caring and intelligent assistant. Respond in ${langNameMap[selectedLang]}.
${personalityPromptMap[mode]}
Avoid symbols like *, _, ~, /, or markdown unless asked.

${timeContext}, so match the mood.

User says: "${prompt}"
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: safePrompt }] }] })
        });
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini had nothing to say.";
    } catch (e) {
        console.error("Gemini error:", e);
        return "Oops! Gemini failed.";
    }
}
function speakText(text) {
    stopSpeaking();
    const cleaned = text.replace(/[*_~`/#\\]/g, ''); // Clean markdown

    const selectedLang = document.getElementById('langSelect')?.value || 'en-IN';
    const mode = document.getElementById('assistant-mode')?.value || 'friendly';

    const utterance = new SpeechSynthesisUtterance(cleaned.trim());
    utterance.lang = selectedLang;

    // 🎭 Tone variation
    const tones = {
        therapist: { pitch: 0.8, rate: 0.9 },
        funny: { pitch: 1.3, rate: 1.1 },
        wise: { pitch: 0.9, rate: 0.95 },
        friendly: { pitch: 1.0, rate: 1.0 }
    };
    Object.assign(utterance, tones[mode] || tones.friendly);

    const voices = speechSynthesis.getVoices();
    let voice = voices.find(v => v.lang === selectedLang && /female|google/i.test(v.name));

    // Fallbacks
    if (!voice) voice = voices.find(v => v.lang === selectedLang);
    if (!voice) voice = voices.find(v => /en/.test(v.lang) && /female|google/i.test(v.name));
    if (!voice) voice = voices[0];

    utterance.voice = voice;
    speechSynthesis.speak(utterance);
}


    function handleSendMessage() {
        const text = userInput.value.trim();
        if (!text) return;
        appendMessage("You", text);
        userInput.value = '';
        appendMessage("Gemini", "Typing...");
        getGeminiResponse(text).then(reply => {
            chatBox.lastChild.remove();
            appendMessage("Gemini", reply);
            speakText(reply);
        });
    }

    function appendMessage(sender, message) {
        const div = document.createElement('div');
        div.className = `message ${sender === 'You' ? 'user' : 'bot'}`;
        div.innerHTML = `<span class="avatar">${sender === 'You' ? '🧑' : '🤖'}</span><div class="text">${escapeHtml(message)}</div>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, tag => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag]
        ));
    }

    function startVoiceRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return alert("Speech recognition not supported");
        const recognition = new SR();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = e => {
            userInput.value = e.results[0][0].transcript.trim();
            sendBtn.click();
        };
        recognition.onerror = e => alert("Mic error: " + e.error);
        recognition.start();
        return recognition;
    }

    sendBtn?.addEventListener("click", handleSendMessage);
    userInput?.addEventListener("keydown", e => e.key === "Enter" && handleSendMessage());
    voiceBtn?.addEventListener("click", startVoiceRecognition);
    webcamBtn?.addEventListener("click", toggleWebcam);
    window.addEventListener("beforeunload", stopSpeaking);
});
