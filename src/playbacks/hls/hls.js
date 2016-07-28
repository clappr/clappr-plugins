// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import HTML5VideoPlayback from 'playbacks/html5_video'
import HLSJS from 'hls.js'
import isEqual from 'lodash.isequal'
import Events from 'base/events'
import Playback from 'base/playback'
import Browser from 'components/browser'
import {now} from 'base/utils'
import Log from 'plugins/log'

const AUTO = -1

export default class HLS extends HTML5VideoPlayback {
  get name() { return 'hls' }

  get levels() { return this._levels || [] }
  get currentLevel() {
    if (this._currentLevel === null || this._currentLevel === undefined) {
      return AUTO
    } else {
      return this._currentLevel //0 is a valid level ID
    }
  }
  set currentLevel(id) {
    this._currentLevel = id
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH_START)
    this._hls.currentLevel = this._currentLevel
  }

  get _duration() {
    return this._playableRegionDuration
  }

  get _startTime() {
    if (this._playbackType === Playback.LIVE && this._playlistType !== 'EVENT') {
      return this._extrapolatedStartTime
    }
    return this._playableRegionStartTime
  }

  get _now() {
    return now()
  }

  // the time in the video element which should represent the start of the sliding window
  // extrapolated to increase in real time (instead of jumping as the early segments are removed)
  get _extrapolatedStartTime() {
    if (!this._localStartTimeCorrelation) {
      return this._playableRegionStartTime
    }
    let corr = this._localStartTimeCorrelation
    let timePassed = this._now - corr.local
    let extrapolatedWindowStartTime = (corr.remote + timePassed) / 1000
    // cap at the end of the extrapolated window duration
    return Math.min(extrapolatedWindowStartTime, this._playableRegionStartTime + this._extrapolatedWindowDuration)
  }

  // Returns the duration (seconds) of the window that the extrapolated start time is allowed
  // to move in before being capped.
  // The extrapolated start time should never reach the cap at the end of the window as the
  // window should slide as chunks are removed from the start.
  //
  // If chunks aren't being removed for some reason that the start time will reach and remain fixed at
  // playableRegionStartTime + extrapolatedWindowDuration
  //
  //                                <-- window duration -->
  // I.e   playableRegionStartTime |-----------------------|
  //                               | -->   .       .       .
  //                               .   --> | -->   .       .
  //                               .       .   --> | -->   .
  //                               .       .       .   --> |
  //                               .       .       .       .
  //                                 extrapolatedStartTime
  get _extrapolatedWindowDuration() {
    if (this._segmentTargetDuration === null) {
      return 0
    }
    return this._extrapolatedWindowNumSegments * this._segmentTargetDuration
  }

  constructor(...args) {
    super(...args)
    // backwards compatibility (TODO: remove on 0.3.0)
    this.options.playback || (this.options.playback = this.options)
    this._minDvrSize = typeof(this.options.hlsMinimumDvrSize) === 'undefined' ? 60 : this.options.hlsMinimumDvrSize
    // The size of the start time extrapolation window measured as a multiple of segments.
    // Should be 2 or higher, or 0 to disable. Should only need to be increased above 2 if more than one segment is
    // removed from the start of the playlist at a time. E.g if the playlist is cached for 10 seconds and new chunks are
    // added/removed every 5.
    this._extrapolatedWindowNumSegments = !this.options.playback || typeof(this.options.playback.extrapolatedWindowNumSegments) === 'undefined' ? 2 :  this.options.playback.extrapolatedWindowNumSegments

    this._playbackType = Playback.VOD
    this._lastTimeUpdate = null
    // for hls streams which have dvr with a sliding window,
    // the content at the start of the playlist is removed as new
    // content is appended at the end.
    // this means the actual playable start time will increase as the
    // start content is deleted
    // For streams with dvr where the entire recording is kept from the
    // beginning this should stay as 0
    this._playableRegionStartTime = 0
    // {local, remote} remote is the time in the video element that should represent 0
    //                 local is the system time when the 'remote' measurment took place
    this._localStartTimeCorrelation = null
    // if content is removed from the beginning then this empty area should
    // be ignored. "playableRegionDuration" does not consider this
    this._playableRegionDuration = 0
    // true when the actual duration is longer than hlsjs's live sync point
    // when this is false playableRegionDuration will be the actual duration
    // when this is true playableRegionDuration will exclude the time after the sync point
    this._durationExcludesAfterLiveSyncPoint = false
    // #EXT-X-TARGETDURATION
    this._segmentTargetDuration = null
    // #EXT-X-PLAYLIST-TYPE
    this._playlistType = null
    this._recoverAttemptsRemaining = this.options.hlsRecoverAttempts || 16
    this._startTimeUpdateTimer()
  }

  _setupHls() {
    this._hls = new HLSJS(this.options.playback.hlsjsConfig || {})
    this._hls.on(HLSJS.Events.MEDIA_ATTACHED, () => this._hls.loadSource(this.options.src))
    this._hls.on(HLSJS.Events.LEVEL_LOADED, (evt, data) => this._updatePlaybackType(evt, data))
    this._hls.on(HLSJS.Events.LEVEL_UPDATED, (evt, data) => this._onLevelUpdated(evt, data))
    this._hls.on(HLSJS.Events.LEVEL_SWITCH, (evt,data) => this._onLevelSwitch(evt, data))
    this._hls.on(HLSJS.Events.FRAG_LOADED, (evt, data) => this._onFragmentLoaded(evt, data))
    this._hls.on(HLSJS.Events.ERROR, (evt, data) => this._onHLSJSError(evt, data))
    this._hls.attachMedia(this.el)
  }

  _recover(evt, data) {
    if (!this._recoveredDecodingError) {
      this._recoveredDecodingError = true
      this._hls.recoverMediaError()
    } else if (!this._recoveredAudioCodecError) {
      this._recoveredAudioCodecError = true
      this._hls.swapAudioCodec()
      this._hls.recoverMediaError()
    } else {
      Log.error('hlsjs: failed to recover')
      this.trigger(Events.PLAYBACK_ERROR, `hlsjs: could not recover from error, evt ${evt}, data ${data} `, this.name)
    }
  }

  // override
  _setupSrc(srcUrl) { // eslint-disable-line no-unused-vars
    // this playback manages the src on the video element itself
  }

  _startTimeUpdateTimer() {
    this._timeUpdateTimer = setInterval(() => {
      this._onTimeUpdate()
    }, 100)
  }

  _stopTimeUpdateTimer() {
    clearInterval(this._timeUpdateTimer)
  }

  // the duration on the video element itself should not be used
  // as this does not necesarily represent the duration of the stream
  // https://github.com/clappr/clappr/issues/668#issuecomment-157036678
  getDuration() {
    return this._duration
  }

  getCurrentTime() {
    // e.g. can be < 0 if user pauses near the start
    // eventually they will then be kicked to the end by hlsjs if they run out of buffer
    // before the official start time
    return Math.max(0, this.el.currentTime - this._startTime)
  }

  // the time that "0" now represents relative to when playback started
  // for a stream with a sliding window this will increase as content is
  // removed from the beginning
  getStartTimeOffset() {
    return this._startTime
  }

  seekPercentage(percentage) {
    let seekTo = this._playableRegionDuration
    if (percentage > 0) {
      seekTo = this._duration * (percentage / 100)
    }
    this.seek(seekTo)
  }

  seek(time) {
    if (time < 0) {
      Log.warn('Attempt to seek to a negative time. Resetting to live point. Use seekToLivePoint() to seek to the live point.')
      time = this.getDuration()
    }
    // assume live if time within 3 seconds of end of stream
    this.dvrEnabled && this._updateDvr(time < this.getDuration()-3)
    time += this._startTime
    super.seek(time)
  }

  seekToLivePoint() {
    this.seek(this.getDuration())
  }

  _updateDvr(status) {
    this.trigger(Events.PLAYBACK_DVR, status)
    this.trigger(Events.PLAYBACK_STATS_ADD, {'dvr': status})
  }

  _updateSettings() {
    if (this._playbackType === Playback.VOD) {
      this.settings.left = ['playpause', 'position', 'duration']
    } else if (this.dvrEnabled) {
      this.settings.left = ['playpause']
    } else {
      this.settings.left = ['playstop']
    }
    this.settings.seekEnabled = this.isSeekEnabled()
    this.trigger(Events.PLAYBACK_SETTINGSUPDATE)
  }

  _onHLSJSError(evt, data) {
    // only report/handle errors if they are fatal
    // hlsjs should automatically handle non fatal errors
    if (data.fatal) {
      if (this._recoverAttemptsRemaining > 0) {
        this._recoverAttemptsRemaining -= 1
        switch (data.type) {
        case HLSJS.ErrorTypes.NETWORK_ERROR:
          Log.warn(`hlsjs: trying to recover from network error, evt ${evt}, data ${data} `)
          this._hls.startLoad()
          break
        case HLSJS.ErrorTypes.MEDIA_ERROR:
          Log.warn(`hlsjs: trying to recover from media error, evt ${evt}, data ${data} `)
          this._recover(evt, data)
          break
        default:
          Log.error(`hlsjs: trying to recover from error, evt ${evt}, data ${data} `)
          this.trigger(Events.PLAYBACK_ERROR, `hlsjs: could not recover from error, evt ${evt}, data ${data} `, this.name)
          break
        }
      } else {
        Log.error(`hlsjs: could not recover from error after maximum number of attempts, evt ${evt}, data ${data} `)
        this.trigger(Events.PLAYBACK_ERROR, {evt, data}, this.name)
      }
    }
    else {
      Log.warn(`hlsjs: non-fatal error occurred, evt ${evt}, data ${data} `)
    }
  }

  _onTimeUpdate() {
    let update = {current: this.getCurrentTime(), total: this.getDuration()}
    if (isEqual(update, this._lastTimeUpdate)) {
      return
    }
    this._lastTimeUpdate = update
    this.trigger(Events.PLAYBACK_TIMEUPDATE, update, this.name)
  }

  _onProgress() {
    if (!this.el.buffered.length) {
      return
    }
    let buffered = []
    let bufferedPos = 0
    for (let i = 0; i < this.el.buffered.length; i++) {
      buffered = [...buffered, {
        // for a stream with sliding window dvr something that is buffered my slide off the start of the timeline
        start: Math.max(0, this.el.buffered.start(i) - this._playableRegionStartTime),
        end: Math.max(0, this.el.buffered.end(i) - this._playableRegionStartTime)
      }]
      if (this.el.currentTime >= buffered[i].start && this.el.currentTime <= buffered[i].end) {
        bufferedPos = i
      }
    }
    const progress = {
      start: buffered[bufferedPos].start,
      current: buffered[bufferedPos].end,
      total: this.getDuration()
    }
    this.trigger(Events.PLAYBACK_PROGRESS, progress, buffered)
  }

  play() {
    if (!this._hls) {
      this._setupHls()
    }
    super.play()
  }

  pause() {
    if (!this._hls) {
      return
    }
    super.pause()
    if (this.dvrEnabled) {
      this._updateDvr(true)
    }
  }

  stop() {
    if (this._hls) {
      super.stop()
      this._hls.destroy()
      delete this._hls
    }
  }

  destroy() {
    this._stopTimeUpdateTimer()
    super.destroy()
  }

  _updatePlaybackType(evt, data) {
    this._playbackType = data.details.live ? Playback.LIVE : Playback.VOD
    this._fillLevels()
    this._onLevelUpdated(evt, data)
  }

  _fillLevels() {
    this._levels = this._hls.levels.map((level, index) => {
      return {id: index, level: level, label: `${level.bitrate/1000}Kbps`
    }})
    this.trigger(Events.PLAYBACK_LEVELS_AVAILABLE, this._levels)
  }

  _onLevelUpdated(evt, data) {
    this._segmentTargetDuration = data.details.targetduration
    this._playlistType = data.details.type || null

    let startTimeChanged = false
    let durationChanged = false
    let fragments = data.details.fragments
    let previousPlayableRegionStartTime = this._playableRegionStartTime

    if (fragments.length > 0 && this._playableRegionStartTime !== fragments[0].start) {
      startTimeChanged = true
      this._playableRegionStartTime = fragments[0].start
    }

    if (fragments.length > 0 && startTimeChanged) {
      if (!this._localStartTimeCorrelation) {
        // set the correlation to map to middle of the extrapolation window
        this._localStartTimeCorrelation = {
          local: this._now,
          remote: (fragments[0].start + (this._extrapolatedWindowDuration/2)) * 1000
        }
      }
      else {
        // check if the start time correlation still works
        let corr = this._localStartTimeCorrelation
        let timePassed = this._now - corr.local
        // this should point to a time within the extrapolation window
        let startTime = (corr.remote + timePassed) / 1000
        if (startTime < fragments[0].start) {
          // our start time is now earlier than the first chunk
          // (maybe the chunk was removed early)
          // reset correlation so that it sits at the beginning of the first available chunk
          this._localStartTimeCorrelation = {
            local: this._now,
            remote: fragments[0].start * 1000
          }
        }
        else if (startTime > previousPlayableRegionStartTime + this._extrapolatedWindowDuration) {
          // start time was past the end of the old extrapolation window
          // see if now that time would be inside the window, and if it would be set the correlation
          // so that it resumes from the time it was at at the end of the old window
          // update the correlation so that the time starts counting again from the value it's on now
          this._localStartTimeCorrelation = {
            local: this._now,
            remote: Math.max(fragments[0].start, previousPlayableRegionStartTime + this._extrapolatedWindowDuration) * 1000
          }
        }
      }
    }

    let newDuration = data.details.totalduration
    // if it's a live stream then shorten the duration to remove access
    // to the area after hlsjs's live sync point
    // seeks to areas after this point sometimes have issues
    if (this._playbackType === Playback.LIVE) {
      let fragmentTargetDuration = data.details.targetduration
      let hlsjsConfig = this.options.playback || {}
      let liveSyncDurationCount = hlsjsConfig.liveSyncDurationCount || HLSJS.DefaultConfig.liveSyncDurationCount
      let hiddenAreaDuration = fragmentTargetDuration * liveSyncDurationCount
      // as the start time moves to the end of the window the user is able to seek closer to the live point
      // this makes sure if the start time reaches the end of the window the live point is hlsjs's live sync point and not past it
      hiddenAreaDuration += this._extrapolatedWindowDuration
      if (hiddenAreaDuration <= newDuration) {
        newDuration -= hiddenAreaDuration
        this._durationExcludesAfterLiveSyncPoint = true
      }
      else {
        this._durationExcludesAfterLiveSyncPoint = false
      }
    }

    if (newDuration !== this._playableRegionDuration) {
      durationChanged = true
      this._playableRegionDuration = newDuration
    }

    // now that the values have been updated call any methods that use on them so they get the updated values
    // immediately
    durationChanged && this._onDurationChange()
    startTimeChanged && this._onProgress()
  }

  _onFragmentLoaded(evt, data) {
    this.trigger(Events.PLAYBACK_FRAGMENT_LOADED, data)
  }

  _onLevelSwitch(evt, data) {
    if (!this.levels.length) {
      this._fillLevels()
    }
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH_END)
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH, data)
    let currentLevel = this._hls.levels[data.level]
    if (currentLevel) {
      // TODO should highDefinition be private and maybe have a read only accessor if it's used somewhere
      this.highDefinition = (currentLevel.height >= 720 || (currentLevel.bitrate / 1000) >= 2000)
      this.trigger(Events.PLAYBACK_HIGHDEFINITIONUPDATE, this.highDefinition)
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
    // enabled when:
    // - the duration does not include content after hlsjs's live sync point
    // - the playable region duration is longer than the configured duration to enable dvr after
    // - the playback type is LIVE.
    return (this._durationExcludesAfterLiveSyncPoint && this._duration >= this._minDvrSize && this.getPlaybackType() === Playback.LIVE)
  }

  getPlaybackType() {
    return this._playbackType
  }

  isSeekEnabled() {
    return (this._playbackType === Playback.VOD || this.dvrEnabled)
  }
}

HLS.canPlay = function(resource, mimeType) {
  const resourceParts = resource.split('?')[0].match(/.*\.(.*)$/) || []
  const isHls = ((resourceParts.length > 1 && resourceParts[1].toLowerCase() === 'm3u8') ||
        mimeType === 'application/x-mpegURL' || mimeType === 'application/vnd.apple.mpegurl')

  return !!(HLSJS.isSupported() && isHls && !Browser.isSafari)
}
