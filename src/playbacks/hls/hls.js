// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import HTML5VideoPlayback from 'playbacks/html5_video'
import HLSJS from 'hls.js'
import Events from 'base/events'
import Playback from 'base/playback'
import Browser from 'components/browser'

export default class HLS extends HTML5VideoPlayback {
  get name() { return 'hls' }

  get levels() { return (this.hls && this.hls.levels) || [] }
  get currentLevel() { return (this.hls && this.hls.currentLevel) || -1 }
  set currentLevel(level) { this.hls && (this.hls.currentLevel = level) }

  // for hls streams which have dvr with a sliding window,
  // the content at the start of the playlist is removed as new
  // content is appended at the end.
  // this means the actual playable start time will increase as the
  // start content is deleted
  // For streams with dvr where the entire recording is kept from the
  // beginning this should always return 0
  getPlayableStartTime() {
    // TODO this should probably just return video.seekable.start(0)
    // but looks like this might have a bug/not been implemented at the moment
    // https://github.com/dailymotion/hls.js/issues/65

    // for now return this even though it's wrong as it works ok
    // super.getDuration() should never be used for reasons
    // described in https://github.com/clappr/clappr/issues/668#issuecomment-157036678
    return super.getDuration() - this.playableRegionDuration
  }

  constructor(options) {
    super(options)
    this.minDvrSize = options.hlsMinimumDvrSize ? options.hlsMinimumDvrSize : 60
    this.playbackType = Playback.VOD
    this.dvrInUse = false
    this.playableRegionDuration = 0
  }

  setupHls() {
    this.hls = new HLSJS(this.options.hlsjsConfig || {})
    this.hls.on(HLSJS.Events.MSE_ATTACHED, () => this.hls.loadSource(this.options.src))
    this.hls.on(HLSJS.Events.MANIFEST_PARSED, () => { this.options.autoPlay && this.play() })
    this.hls.on(HLSJS.Events.LEVEL_LOADED, (evt, data) => {
      this.updateDuration(evt, data)
      this.updatePlaybackType(evt, data)
    })
    this.hls.on(HLSJS.Events.LEVEL_UPDATED, (evt, data) => this.updateDuration(evt, data))
    this.hls.on(HLSJS.Events.LEVEL_SWITCH, (evt,data) => this.onLevelSwitch(evt, data))
    this.hls.on(HLSJS.Events.FRAG_LOADED, (evt, data) => this.onFragmentLoaded(evt, data))
    this.hls.attachVideo(this.el)
  }

  // the duration on the video element itself should not be used
  // as this does not necesarily represent the duration of the stream
  // https://github.com/clappr/clappr/issues/668#issuecomment-157036678
  getDuration() {
    return this.playableRegionDuration
  }

  getCurrentTime() {
    return this.el.currentTime - this.getPlayableStartTime()
  }

  seek(seekBarValue) {
    var seekTo = this.playableRegionDuration
    if (seekBarValue > 0) {
      seekTo = this.playableRegionDuration * (seekBarValue / 100)
    }
    var onDvr = this.dvrEnabled && seekBarValue > 0 && seekBarValue < 100
    seekTo += this.getPlayableStartTime()
    super.seekSeconds(seekTo)
    this.updateDvr(onDvr)
  }

  updateDvr(status) {
    this.dvrInUse = status
    this.trigger(Events.PLAYBACK_DVR, this.dvrInUse)
    this.trigger(Events.PLAYBACK_STATS_ADD, {'dvr': this.dvrInUse})
  }

  durationChange() {
    if (this.playbackType === Playback.VOD) {
      this.settings.left = ["playpause", "position", "duration"]
    } else if (this.dvrEnabled) {
      this.settings.left = ["playpause"]
    } else {
      this.settings.left = ["playstop"]
    }
    this.settings.seekEnabled = this.isSeekEnabled()
    this.timeUpdated()
    this.trigger(Events.PLAYBACK_SETTINGSUPDATE)
  }

  timeUpdated() {
    this.trigger(Events.PLAYBACK_TIMEUPDATE, this.getCurrentTime(), this.getDuration(), this.name)
  }

  play() {
    if (!this.hls) {
      this.setupHls()
    }
    super.play()
  }

  pause() {
    super.pause()
    if (this.dvrEnabled) {
      this.updateDvr(true)
    }
  }

  stop() {
    if (this.hls) {
      this.hls.destroy()
      delete this.hls
    }
  }

  updatePlaybackType(evt, data) {
    this.playbackType = data.details.live ? Playback.LIVE : Playback.VOD
  }

  updateDuration(evt, data) {
    this.playableRegionDuration = data.details.totalduration
    this.durationChange()
  }

  onFragmentLoaded(evt, data) {
    this.trigger(Events.PLAYBACK_FRAGMENT_LOADED, data)
  }

  onLevelSwitch(evt, data) {
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH, data)
    var currentLevel = this.levels[data.level]
    if (currentLevel) {
      this.highDefinition = (currentLevel.height >= 720 || (currentLevel.bitrate / 1000) >= 2000);
      this.trigger(Events.PLAYBACK_HIGHDEFINITIONUPDATE)
      this.trigger(Events.PLAYBACK_BITRATE, {
        height: currentLevel.height,
        width: currentLevel.width,
        bandwidth: currentLevel.bandwidth,
        bitrate: currentLevel.bitrate,
        level: data.level
      })
    }
  }

  get dvrEnabled() {
    return (this.playableRegionDuration >= this.minDvrSize && this.getPlaybackType() === Playback.LIVE)
  }

  getPlaybackType() {
    return this.playbackType
  }

  isSeekEnabled() {
    return (this.playbackType === Playback.VOD || this.dvrEnabled)
  }
}

HLS.canPlay = function(resource, mimeType) {
  var resourceParts = resource.split('?')[0].match(/.*\.(.*)$/) || []
  var isHls = ((resourceParts.length > 1 && resourceParts[1] === "m3u8") ||
        mimeType === 'application/x-mpegURL' || mimeType === 'application/vnd.apple.mpegurl')
  var ignoredBrowser = Browser.isSafari || Browser.isFirefox

  return !!(HLSJS.isSupported() && isHls && !ignoredBrowser)
}
