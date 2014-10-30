//Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

var ContainerPlugin = require('container_plugin')

class ClickToPausePlugin extends ContainerPlugin {
  get name() { return 'click_to_pause' }

  bindEvents() {
    this.listenTo(this.container, 'container:click', this.click)
    this.listenTo(this.container, 'container:settingsupdate', this.settingsUpdate)
  }

  click() {
    if (this.container.getPlaybackType() !== 'live' || this.container.isDvrEnabled()) {
      if (this.container.isPlaying()) {
        this.container.pause()
      } else {
        this.container.play()
      }
    }
  }

  settingsUpdate() {
    this.container.$el.removeClass('pointer-enabled')
    if (this.container.getPlaybackType() !== 'live' || this.container.isDvrEnabled()) {
      this.container.$el.addClass('pointer-enabled')
    }
  }
}

module.exports = ClickToPausePlugin
