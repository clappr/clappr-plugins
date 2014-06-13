// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

var BaseObject = require('../../base/base_object');
var $ = require("jquery");
var _ = require('underscore');

var Loading = require('../loading');

var PipPlugin = BaseObject.extend({
  name: 'pip',
  initialize: function(core) {
    this.core = core;
    this.pipStyle = {width: "24%",
                     height: "24%",
                     "z-index": 2000,
                     right: "23px",
                     "border-width": "2px",
                     "border-radius": "3px",
                     "border-style": "solid",
                     "border-color": "rgba(255,255,255, .25)",
                     "background-clip": "padding-box",
                     "-webkit-background-clip": "padding-box",
                     "cursor": "pointer"};

    this.masterStyle = {width: "100%",
                        height: "100%",
                        bottom: "0px",
                        right: "0px",
                        border: "none",
                        "cursor" : "default"};

    this.masterContainer = core.containers[0];
    this.loading = new Loading({message: 'Carregando...', style: {left:'25px', top: '15px', position: 'relative', 'float': 'left', 'z-index': 3001,color: 'white'}});
    this.core.$el.append(this.loading.render().el);
    if (core.containers.length === 2) {
      this.pipContainer = core.containers[1];
      this.pipContainer.setStyle(this.pipStyle);
      this.pipContainer.play();
      this.pipContainer.setVolume(0);
      this.listenToPipClick();
      this.core.mediaControl.setContainer(this.masterContainer);
      this.core.mediaControl.render();
    }
    this.listenTo(this.core.mediaControl, 'mediacontrol:show', this.onMediaControlShow);
    this.listenTo(this.core.mediaControl, 'mediacontrol:hide', this.onMediaControlHide);
  },
  getExternalInterface: function() {
    return {
      addPip: this.addPip,
      discardPip: this.discardPip,
      addMaster: this.addMaster,
      addMasterContainer: this.addMasterContainer,
      changeMaster: this.changeMaster,
      pipToMaster: this.pipToMaster,
      hasPip: this.hasPip
    };
  },
  hasPip: function() {
    return !!this.pipContainer;
  },
  addPip: function(source) {
    if (this.masterContainer.playback.name === "auditude") {
      if (this.core.params.onLoadPipFailed)
        this.core.params.onLoadPipFailed(source);
      return;
    }
    this.stopListening(this.pipContainer);
    this.discardPip();
    this.core.createContainer(source).then(this.addPipCallback.bind(this));
  },
  addPipCallback: function(container) {
    this.pipContainer = _(container).isArray() ? container[0] : container;
    this.onContainerReady();
    if (this.core.params.onPipLoaded)
      this.core.params.onPipLoaded(this.pipContainer.playback.src);
  },
  onContainerReady: function() {
    this.pipContainer.setVolume(0);
    this.pipContainer.setStyle(this.pipStyle);
    this.pipContainer.play();
    this.stopListening(this.pipContainer);
    this.listenToPipClick();
    this.listenTo(this.pipContainer, "container:ended", this.discardPip);
    this.pipContainer.trigger("container:pip", true);
  },
  discardPip: function() {
    if (this.pipContainer) {
      this.stopListening(this.pipContainer);
      this.discardContainer(this.pipContainer);
      this.pipContainer = undefined;
    }
  },
  discardMaster: function() {
    if (this.masterContainer) {
      this.stopListening(this.masterContainer);
      this.discardContainer(this.masterContainer);
      this.masterContainer = undefined;
    }
  },
  setMasterContainer: function(container) {
    this.discardContainer(this.masterContainer);
    this.masterContainer = container;
    this.masterContainer.setStyle(this.masterStyle);
    this.listenTo(this.masterContainer, "container:ended", this.pipToMaster);
    this.masterContainer.play();
  },
  addMaster: function(source) {
    if (this.masterContainer) {
      if (this.masterContainer.playback && this.masterContainer.playback.name === "auditude") {
        if (this.core.params.onLoadMasterFailed)
          this.core.params.onLoadMasterFailed(source);
        return;
      }
      this.loading.show();
      this.stopListening(this.masterContainer);
      this.tmpContainer = this.masterContainer;
      this.tmpContainer.setStyle({'z-index': 2000});
      this.core.createContainer(source).then(this.addMasterCallback.bind(this));
    }
  },
  addMasterContainer: function(container) {
    if (this.masterContainer) {
      if (this.masterContainer.playback && this.masterContainer.playback.name === "auditude") {
        if (this.core.params.onLoadMasterFailed)
          this.core.params.onLoadMasterFailed(source);
        return;
      }
      this.tmpContainer = this.masterContainer;
      this.tmpContainer.setStyle({'z-index': 2000});
      this.addMasterCallback(container);
    }
  },
  addMasterCallback: function(container) {
    this.masterContainer = container;
    if(this.pipContainer) {
      this.discardPip();
    }
    //this.listenToOnce(this.masterContainer, "container:play", this.animateMasterToPip);

    this.pipContainer = this.tmpContainer;
    this.masterContainer.play();
    this.animateMasterToPip();
    this.tmpContainer = undefined;
    this.pipContainer.setVolume(0);
    this.pipContainer.trigger("container:pip", true);
  },
  animateMasterToPip: function() {
    this.loading.hide();
    this.listenTo(this.masterContainer, "container:ended", this.pipToMaster);
    if (this.pipContainer.playback && this.pipContainer.playback.name === 'hls') { //flash breaks on animate
      this.pipContainer.setStyle(this.pipStyle);
      if (this.core.params.onMasterLoaded) {
        this.core.params.onMasterLoaded(this.masterContainer.getSource());
      }
    } else {
      this.pipContainer.animate(this.pipStyle, {
        complete: function() {
          if(this.pipContainer) {
            this.pipContainer.setStyle(this.pipStyle);
          }
          if (this.core.params.onMasterLoaded)
            this.core.params.onMasterLoaded(this.masterContainer.playback.params.src);
        }.bind(this)
      });
    }
    this.core.mediaControl.setContainer(this.masterContainer);
    this.listenToPipClick();
  },
  changeMaster: function(source) {
    if (this.masterContainer) {
      if (this.masterContainer.playback && this.masterContainer.playback.name === "auditude") {
        if (this.core.params.onLoadMasterFailed)
          this.core.params.onLoadMasterFailed(source);
        return;
      }
      this.stopListening(this.masterContainer);
      this.tmpContainer = this.masterContainer;
      this.tmpContainer.setStyle({'z-index': 2000});
      this.core.createContainer(source).then(this.changeMasterCallback.bind(this));
    }
  },
  changeMasterCallback: function(container) {
    this.masterContainer.destroy();
    this.masterContainer = container;
    this.masterContainer.play();
    this.tmpContainer = undefined;
    this.listenTo(this.masterContainer, "container:ended", this.pipToMaster);
    this.core.mediaControl.setContainer(this.masterContainer);
    if (this.core.params.onMasterLoaded)
      this.core.params.onMasterLoaded(this.masterContainer.playback.params.src);
  },
  listenToPipClick: function() {
    if (this.pipContainer) {
      this.stopListening(this.pipContainer);
      this.listenTo(this.pipContainer, "container:click", this.pipToMaster.bind(this));
    }
  },
  discardContainer: function(container) {
    container.destroy();
  },
  pipToMaster: function() {
    this.stopListening(this.masterContainer);
    if (this.pipContainer) {
      this.pipContainer.setStyle({ 'z-index': 998 });
      this.pipContainer.animate(this.masterStyle).then(this.pipToMasterCallback.bind(this));
    }
    return this;
  },
  pipToMasterCallback: function() {
    this.discardMaster();
    this.pipContainer.setVolume(100);
    this.pipContainer.trigger("container:pip", false);
    this.pipContainer.play();
    this.masterContainer = this.pipContainer;
    this.masterContainer.setStyle({"z-index": 20});
    this.pipContainer = undefined;
    this.core.mediaControl.setContainer(this.masterContainer);
    this.core.enableMediaControl();
    if (this.core.params.onPipToMaster)
      this.core.params.onPipToMaster(this.masterContainer.playback.params.src);
  },
  onMediaControlShow: function () {
    if (!this.pipContainer || this.pipContainer.$el.is(':animated')) return;
    this.pipContainer.animate({ bottom: 63 }, 400);
  },
  onMediaControlHide: function () {
    if (!this.pipContainer || this.pipContainer.$el.is(':animated')) return;
    this.pipContainer.animate({ bottom: 23 }, 400);
  }
});

module.exports = PipPlugin;
