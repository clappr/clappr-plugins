// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

const Browser = {}

const hasLocalstorage = function(){
  try {
    localStorage.setItem('clappr', 'clappr')
    localStorage.removeItem('clappr')
    return true
  } catch(e) {
    return false
  }
}

const hasFlash = function() {
  try {
    const fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash')
    return !!fo
  } catch (e) {
    return !!(navigator.mimeTypes && navigator.mimeTypes['application/x-shockwave-flash'] !== undefined &&
        navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin)
  }
}

const getBrowserInfo = function() {
  const ua = navigator.userAgent
  let parts = ua.match(/\b(playstation 4|nx|opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [],
    extra
  if (/trident/i.test(parts[1])) {
    extra = /\brv[ :]+(\d+)/g.exec(ua) || []
    return { name: 'IE', version: parseInt(extra[1] || '') }
  } else if (parts[1] === 'Chrome') {
    extra = ua.match(/\bOPR\/(\d+)/)
    if (extra != null) {
      return { name: 'Opera', version: parseInt(extra[1]) }
    }
    extra = ua.match(/\bEdge\/(\d+)/)
    if (extra != null) {
      return { name: 'Edge', version: parseInt(extra[1]) }
    }
  }
  parts = parts[2] ? [parts[1], parts[2]] : [navigator.appName, navigator.appVersion, '-?']

  if ((extra = ua.match(/version\/(\d+)/i))) {
    parts.splice(1, 1, extra[1])
  }
  return { name: parts[0], version: parseInt(parts[1]) }
}

const browserInfo = getBrowserInfo()

Browser.isEdge = /edge/i.test(navigator.userAgent)
Browser.isChrome = /chrome|CriOS/i.test(navigator.userAgent) && !Browser.isEdge
Browser.isSafari = /safari/i.test(navigator.userAgent) && !Browser.isChrome && !Browser.isEdge
Browser.isFirefox = /firefox/i.test(navigator.userAgent)
Browser.isLegacyIE = !!(window.ActiveXObject)
Browser.isIE = Browser.isLegacyIE || /trident.*rv:1\d/i.test(navigator.userAgent)
Browser.isIE11 = /trident.*rv:11/i.test(navigator.userAgent)
Browser.isChromecast = Browser.isChrome && /CrKey/i.test(navigator.userAgent)
Browser.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|IEMobile|Mobile Safari|Opera Mini/i.test(navigator.userAgent)
Browser.isiOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
Browser.isAndroid = /Android/i.test(navigator.userAgent)
Browser.isWindowsPhone = /Windows Phone/i.test(navigator.userAgent)
Browser.isWin8App = /MSAppHost/i.test(navigator.userAgent)
Browser.isWiiU = /WiiU/i.test(navigator.userAgent)
Browser.isPS4 = /PlayStation 4/i.test(navigator.userAgent)
Browser.hasLocalstorage = hasLocalstorage()
Browser.hasFlash = hasFlash()

Browser.name = browserInfo.name
Browser.version = browserInfo.version

export default Browser
