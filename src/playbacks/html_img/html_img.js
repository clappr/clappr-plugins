// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import Playback from 'base/playback'
import Styler from 'base/styler'
import imgStyle from './public/style.scss'
import Events from 'base/events'

export default class HTMLImg extends Playback {
  get name() { return 'html_img' }
  get tagName() { return 'img' }
  get attributes() {
    return {
      'data-html-img': ''
    }
  }

  get events() {
    return {
      'load': 'onLoad',
      'abort': 'onError',
      'error': 'onError'
    }
  }

  getPlaybackType() {
    return Playback.NO_OP
  }

  constructor(params) {
    super(params)
    this.el.src = params.src
  }

  render() {
    var style = Styler.getStyleFor(imgStyle)
    this.$el.append(style)
    this.trigger(Events.PLAYBACK_READY, this.name)
    return this
  }

  onLoad(evt) {
    this.trigger(Events.PLAYBACK_ENDED, this.name)
  }

  onError(evt) {
    var m = (evt.type === 'error') ? 'load error' : 'loading aborted';
    this.trigger(Events.PLAYBACK_ERROR, {message: m}, this.name)
  }
}

HTMLImg.canPlay = function(resource) {
  return /\.(png|jpg|jpeg|gif|bmp|tiff|pgm|pnm)(|\?.*)$/i.test(resource)
}
