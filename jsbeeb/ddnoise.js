define(['utils', 'underscore', 'promise'], function (utils, _) {
    "use strict";

    var IDLE = 0, SPIN_UP = 1, SPINNING = 2;
    var VOLUME = 0.3;

    function DdNoise(context) {
        this.context = context;
        this.sounds = {};
        this.state = IDLE;
        this.motor = null;
        this.gain = context.createGain();
        this.gain.gain.value = VOLUME;
        this.gain.connect(context.destination);
    }

    function loadSounds(context, sounds) {
        return Promise.all(_.map(sounds, function (sound) {
            // Safari doesn't support the Promise stuff directly, so we create
            // our own Promise here.
            return utils.loadData(sound).then(function (data) {
                return new Promise(function (resolve, reject) {
                    context.decodeAudioData(data.buffer, function (decodedData) {
                        resolve(decodedData);
                    });
                });
            });
        })).then(function (loaded) {
            var keys = _.keys(sounds);
            var result = {};
            for (var i = 0; i < keys.length; ++i) {
                result[keys[i]] = loaded[i];
            }
            return result;
        });
    }

    DdNoise.prototype.initialise = function () {
        var self = this;
        return loadSounds(self.context, {
            motorOn: 'sounds/disc525/motoron.wav',
            motorOff: 'sounds/disc525/motoroff.wav',
            motor: 'sounds/disc525/motor.wav',
            step: 'sounds/disc525/step.wav',
            seek: 'sounds/disc525/seek.wav',
            seek2: 'sounds/disc525/seek2.wav',
            seek3: 'sounds/disc525/seek3.wav'
        }).then(function (sounds) {
            self.sounds = sounds;
        });
    };

    DdNoise.prototype.oneShot = function (sound) {
        var source = this.context.createBufferSource();
        source.buffer = sound;
        source.connect(this.gain);
        source.start();
        return sound.duration;
    };

    DdNoise.prototype.play = function (sound, loop) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var source = self.context.createBufferSource();
            source.buffer = sound;
            source.loop = !!loop;
            source.connect(self.gain);
            if (!source.loop) {
                source.onended = resolve;
            }
            source.start();
            if (source.loop) {
                resolve(source);
            }
        });
    };

    DdNoise.prototype.spinUp = function () {
        if (this.state == SPINNING || this.state == SPIN_UP) return;
        this.state = SPIN_UP;
        var self = this;
        self.play(self.sounds.motorOn).then(function () {
            self.play(self.sounds.motor, true).then(function (source) {
                self.motor = source;
                self.state = SPINNING;
            });
        });
    };

    DdNoise.prototype.spinDown = function () {
        if (this.state == IDLE) return;
        this.state = IDLE;
        if (this.motor) {
            this.motor.stop();
            this.motor = null;
            this.oneShot(this.sounds.motorOff);
        }
    };

    DdNoise.prototype.seek = function (diff) {
        var dir;
        if (diff < 0) {
            dir = true;
            diff = -diff;
        }
        if (diff === 0) return 0;
        else if (diff === 1) return this.oneShot(this.sounds.step);
        else if (diff < 7) return this.oneShot(this.sounds.seek);
        else if (diff < 30) return this.oneShot(this.sounds.seek2);
        else return this.oneShot(this.sounds.seek3);
    };

    DdNoise.prototype.mute = function () {
        this.gain.gain.value = 0;
    };
    DdNoise.prototype.unmute = function () {
        this.gain.gain.value = VOLUME;
    };

    function FakeDdNoise() {
    }

    FakeDdNoise.prototype.spinUp = FakeDdNoise.prototype.spinDown =
        FakeDdNoise.prototype.mute = FakeDdNoise.prototype.unmute = FakeDdNoise.prototype.seek = utils.noop;
    FakeDdNoise.prototype.initialize = function () {
        return Promise.resolve();
    };

    return {
        DdNoise: DdNoise,
        FakeDdNoise: FakeDdNoise
    };
});