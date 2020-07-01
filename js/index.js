/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
const applyConstraintsButton = document.getElementById('applyConstraints');
const overApplyConstraintsButton = document.getElementById('overApplyConstraints');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);
applyConstraintsButton.addEventListener('click', trackApplyConstraints);
overApplyConstraintsButton.addEventListener('click', overApplyConstraints);

var constraintsValue = document.querySelector('textarea#getConstraints');
var defaultCon = {
    "frameRate": {
        "max": 30,
        "ideal": 15
    },
    "aspectRatio": {
        "min": 1.777,
        "max": 1.778
    },
    "width": {
        "min": 0,
        "ideal": 1280,
        "max": 1280
    },
    "height": {
        "min": 0,
        "ideal": 720,
        "max": 720
    }
};
constraintsValue.value = JSON.stringify(defaultCon, null, '    ' );

function editGetConstraints() {
    var constraints = { };
    if (constraintsValue.value) {
        constraints = JSON.parse(constraintsValue.value);
    }
    return constraints;
}


function trackApplyConstraints() {
    let constraints = editGetConstraints()
    let track = localStream.getVideoTracks()[0];
    console.info("applyConstraints success \n" + JSON.stringify(constraints, null, '    ') );
    track.applyConstraints(constraints).then(function () {
        console.warn("applyConstraints by set success");
    }).catch(function (error) {
        console.error(error)
    });
}

function overApplyConstraints() {
    let constraints = {
        "frameRate": {
            "max": 30,
            "ideal": 15
        },
        "aspectRatio": {
            "min": 1.777,
            "max": 1.778
        },
        "width": {
            "min": 0,
            "ideal": 1920,
            "max": 1920
        },
        "height": {
            "min": 0,
            "ideal": 1080,
            "max": 1080
        }
    }
    console.info("overApplyConstraints \n" + JSON.stringify(constraints, null, '    ') );

    let track = localStream.getVideoTracks()[0];
    track.applyConstraints(constraints).then(function () {
        console.warn('ApplyConstraints 1080 success')
    }).catch(function (error) {
        console.error(error)
    });
}

let startTime;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

localVideo.addEventListener('loadedmetadata', function() {
    console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function() {
    console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

localVideo.addEventListener('resize', () => {
    console.log(`local video size changed to ${localVideo.videoWidth}x${localVideo.videoHeight}`);
});

remoteVideo.addEventListener('resize', () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
    // We'll use the first onsize callback as an indication that video has started
    // playing out.
    if (startTime) {
        const elapsedTime = window.performance.now() - startTime;
        console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
        startTime = null;
    }
});


var localVideoStatsDiv = document.querySelector('div#localVideoElem');
var remoteVideoStatsDiv = document.querySelector('div#remoteVideoElem');
// Display statistics
setInterval(function() {
    // Collect some stats from the video tags.
    if (localVideo.videoWidth) {
        localVideoStatsDiv.innerHTML = '<strong>Video dimensions:</strong> ' +
            localVideo.videoWidth + 'x' + localVideo.videoHeight + 'px';
    }
    if (remoteVideo.videoWidth) {
        remoteVideoStatsDiv.innerHTML = '<strong>Video dimensions:</strong> ' +
            remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight + 'px';
    }
}, 1000);

let localStream;
let pc1;
let pc2;
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

function getName(pc) {
    return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
    return (pc === pc1) ? pc2 : pc1;
}

async function start() {
    console.log('Requesting local stream');
    startButton.disabled = true;
    try {
        var constraints = {audio: true, video: true}
        console.warn("getUserMedia \n" + JSON.stringify(constraints, null, '    ') );
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Received local stream');
        localVideo.srcObject = stream;
        localStream = stream;
        callButton.disabled = false;
    } catch (e) {
        alert(`getUserMedia() error: ${e.name}`);
    }
}

async function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    console.log('Starting call');
    startTime = window.performance.now();
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    const configuration = {};
    console.log('RTCPeerConnection configuration:', configuration);
    pc1 = new RTCPeerConnection(configuration);
    console.log('Created local peer connection object pc1');
    pc1.addEventListener('icecandidate', e => onIceCandidate(pc1, e));
    pc2 = new RTCPeerConnection(configuration);
    console.log('Created remote peer connection object pc2');
    pc2.addEventListener('icecandidate', e => onIceCandidate(pc2, e));
    pc1.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc1, e));
    pc2.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc2, e));
    pc2.addEventListener('track', gotRemoteStream);

    localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
    console.log('Added local stream to pc1');

    try {
        console.log('pc1 createOffer start');
        const offer = await pc1.createOffer(offerOptions);
        await onCreateOfferSuccess(offer);
    } catch (e) {
        onCreateSessionDescriptionError(e);
    }
}

function onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(desc) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log('pc1 setLocalDescription start');
    try {
        await pc1.setLocalDescription(desc);
        onSetLocalSuccess(pc1);
    } catch (e) {
        onSetSessionDescriptionError();
    }

    console.log('pc2 setRemoteDescription start');
    try {
        await pc2.setRemoteDescription(desc);
        onSetRemoteSuccess(pc2);
    } catch (e) {
        onSetSessionDescriptionError();
    }

    console.log('pc2 createAnswer start');
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    try {
        const answer = await pc2.createAnswer();
        await onCreateAnswerSuccess(answer);
    } catch (e) {
        onCreateSessionDescriptionError(e);
    }
}

function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
    if (remoteVideo.srcObject !== e.streams[0]) {
        remoteVideo.srcObject = e.streams[0];
        console.log('pc2 received remote stream');
    }
}

async function onCreateAnswerSuccess(desc) {
    console.log(`Answer from pc2:\n${desc.sdp}`);
    console.log('pc2 setLocalDescription start');
    try {
        await pc2.setLocalDescription(desc);
        onSetLocalSuccess(pc2);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
    console.log('pc1 setRemoteDescription start');
    try {
        await pc1.setRemoteDescription(desc);
        onSetRemoteSuccess(pc1);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
}

async function onIceCandidate(pc, event) {
    try {
        await (getOtherPc(pc).addIceCandidate(event.candidate));
        onAddIceCandidateSuccess(pc);
    } catch (e) {
        onAddIceCandidateError(pc, e);
    }
    console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
    console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
    console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
    if (pc) {
        console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
        console.log('ICE state change event: ', event);
    }
}

function hangup() {
    console.log('Ending call');
    pc1.close();
    pc2.close();
    pc1 = null;
    pc2 = null;
    hangupButton.disabled = true;
    callButton.disabled = false;
    window.location.reload(true)
}
